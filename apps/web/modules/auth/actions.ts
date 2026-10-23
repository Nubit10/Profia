"use server";

import { headers } from "next/headers";
import { AuthError, CredentialsSignin } from "next-auth";
import { logger } from "@/lib/observability/logger";
import { authLimiters } from "@/lib/rate-limit";
import { signIn, signOut } from "./config";
import { clientIp } from "./request";
import { loginSchema, registerSchema } from "./schemas";
import { registerUser } from "./service";
import { getCurrentUser } from "./session";
import { dismissTutorial } from "./tutorial";
import type { ActionResult } from "./types";

const GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos";
const RATE_LIMITED_ERROR = "Demasiados intentos. Intenta de nuevo en unos minutos.";
const UNEXPECTED_ERROR = "No pudimos completar la operación. Intenta de nuevo.";

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_LOGIN_ERROR };

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
    return { ok: true };
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      const rateLimited = error.code === "rate_limited";
      return { ok: false, error: rateLimited ? RATE_LIMITED_ERROR : GENERIC_LOGIN_ERROR };
    }
    if (error instanceof AuthError) return { ok: false, error: GENERIC_LOGIN_ERROR };
    logger.error("auth.login.unexpected_error", { error });
    return { ok: false, error: UNEXPECTED_ERROR };
  }
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  const ip = clientIp(await headers());
  if (!(await authLimiters.register.consume(`register:${ip}`)).allowed) {
    return { ok: false, error: RATE_LIMITED_ERROR };
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del formulario",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await registerUser(parsed.data);
    if (!result.ok) {
      const message = "Ya existe una cuenta con ese correo";
      return { ok: false, error: message, fieldErrors: { email: [message] } };
    }
    logger.info("auth.register.succeeded", { userId: result.user.id });
    return { ok: true };
  } catch (error) {
    logger.error("auth.register.unexpected_error", { error });
    return { ok: false, error: UNEXPECTED_ERROR };
  }
}

export async function logoutAction(): Promise<ActionResult> {
  await signOut({ redirect: false });
  return { ok: true };
}

/** CA-0012-26: el tutorial cerrado no vuelve a aparecer solo. */
export async function dismissTutorialAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: UNEXPECTED_ERROR };
  await dismissTutorial(user.id);
  return { ok: true };
}
