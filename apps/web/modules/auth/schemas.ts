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

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(100, "El nombre es demasiado largo"),
    email,
    password: z
      .string()
      .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
      .max(PASSWORD_MAX, `La contraseña no puede superar ${PASSWORD_MAX} caracteres`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
