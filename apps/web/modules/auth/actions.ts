"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { AuthError, CredentialsSignin } from "next-auth";
import { logger } from "@/lib/observability/logger";
import { authLimiters } from "@/lib/rate-limit";
import { signIn, signOut } from "./config";
import { clientIp } from "./request";
import { requestPasswordReset, resetPassword } from "./password-reset";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./schemas";
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

/**
 * SPEC-0013 RN-01: crear la cuenta inicia la sesión. `signedIn: false` si la cuenta quedó creada pero
 * no se pudo iniciar sesión (p. ej. límite de intentos): el formulario lleva al login de hoy.
 */
export async function registerAction(input: unknown): Promise<ActionResult<{ signedIn: boolean }>> {
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
    const login = await loginAction({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (!login.ok) logger.warn("auth.register.auto_login_failed", { userId: result.user.id });
    return { ok: true, data: { signedIn: login.ok } };
  } catch (error) {
    logger.error("auth.register.unexpected_error", { error });
    return { ok: false, error: UNEXPECTED_ERROR };
  }
}

/**
 * SPEC-0035 RN-01: responde siempre lo mismo, exista o no la cuenta; el correo sale después de
 * responder para que el tiempo tampoco lo delate.
 */
export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa el correo",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const ip = clientIp(await headers());
    await requestPasswordReset(
      { email: parsed.data.email, ip },
      { schedule: (task) => after(task) },
    );
  } catch (error) {
    logger.error("auth.password_reset.unexpected_error", { error });
  }
  return { ok: true };
}

/**
 * SPEC-0035 RN-05: cambia la contraseña con el enlace, cierra las sesiones abiertas e inicia una nueva.
 * `signedIn: false` si no se pudo iniciar sesión: el formulario lleva al login con el correo.
 */
export async function resetPasswordAction(
  input: unknown,
): Promise<ActionResult<{ signedIn: boolean; email: string }>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del formulario",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const result = await resetPassword({
      token: parsed.data.token,
      password: parsed.data.password,
    });
    if (!result.ok) {
      return { ok: false, error: "Este enlace ya no sirve. Pide uno nuevo." };
    }
    // Las sesiones anteriores ya se cerraron; iniciar sesión reemplaza la cookie de esta pestaña.
    const login = await loginAction({ email: result.email, password: parsed.data.password });
    return { ok: true, data: { signedIn: login.ok, email: result.email } };
  } catch (error) {
    logger.error("auth.password_reset.unexpected_error", { error });
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
