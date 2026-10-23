import { z } from "zod";

// Variables obligatorias del servidor (RN-02, RN-03). Los mensajes nunca incluyen valores.
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^postgres(ql)?:\/\//, "debe ser una URL postgresql://"),
  ),
  AUTH_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(32, "debe tener al menos 32 caracteres"),
  ),
  // AI Engine (SPEC-0005). Opcional: sin él, la búsqueda inteligente no está disponible (RN-05).
  AI_ENGINE_URL: z.preprocess(emptyToUndefined, z.url("debe ser una URL").optional()),
  AI_ENGINE_TOKEN: z.preprocess(
    emptyToUndefined,
    z.string().min(24, "debe tener al menos 24 caracteres").optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  override name = "EnvValidationError";
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const key = issue.path.join(".");
    const missing = emptyToUndefined(source[key]) === undefined;
    return `  - ${key}: ${missing ? "falta (obligatoria)" : issue.message}`;
  });
  throw new EnvValidationError(
    `Variables de entorno inválidas:\n${problems.join("\n")}\nRevisa apps/web/.env (plantilla en .env.example).`,
  );
}
