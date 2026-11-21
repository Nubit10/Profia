import { z } from "zod";

// Schemas compartidos entre formularios (React Hook Form) y servidor. Sin dependencias de servidor.

/** RN-07: el correo se compara y guarda normalizado. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const email = z
  .string()
  .trim()
  .min(1, "Ingresa tu correo")
  .max(254, "El correo es demasiado largo")
  .pipe(z.email("Ingresa un correo válido"))
  .transform(normalizeEmail);

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Ingresa tu contraseña").max(PASSWORD_MAX),
});

/** SPEC-0035: pedir el enlace para crear una contraseña nueva. */
export const forgotPasswordSchema = z.object({ email });

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX, `La contraseña no puede superar ${PASSWORD_MAX} caracteres`);

/** SPEC-0035 RN-04: la contraseña nueva cumple las reglas del registro y se confirma. */
export const resetPasswordSchema = z
  .object({ token: z.string().min(1).max(200), password: newPassword, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(100, "El nombre es demasiado largo"),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
