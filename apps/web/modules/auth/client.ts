// API pública del módulo auth segura para el navegador: schemas, tipos y utilidades puras.
export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  PASSWORD_MIN,
  type LoginInput,
  type RegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "./schemas";
export { safeCallbackUrl, DEFAULT_AFTER_LOGIN } from "./redirect";
export type { ActionResult } from "./types";
