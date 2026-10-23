import "server-only";
import { cookies } from "next/headers";
import { ACTIVE_SPACE_COOKIE } from "./context";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Guarda la preferencia de espacio activo. No es un dato de confianza: en cada request
 * se valida contra las membresías del usuario (SPEC-0002 RN-04).
 */
export async function setActiveSpaceCookie(institutionId: string): Promise<void> {
  (await cookies()).set(ACTIVE_SPACE_COOKIE, institutionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
