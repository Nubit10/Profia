import "server-only";
import { parseEnv, type Env } from "./env-schema";

export { EnvValidationError, parseEnv, type Env } from "./env-schema";

let cached: Env | undefined;

/** Variables de entorno validadas del servidor. Lanza EnvValidationError si falta alguna (RN-03). */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
