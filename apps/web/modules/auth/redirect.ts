export const DEFAULT_AFTER_LOGIN = "/dashboard";

const CONTROL_CHARS = /[\u0000-\u001f]/;

/** Acepta solo rutas internas para evitar open redirects tras el login. */
export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AFTER_LOGIN;
  }
  if (value.includes("\\") || CONTROL_CHARS.test(value)) return DEFAULT_AFTER_LOGIN;
  return value;
}
