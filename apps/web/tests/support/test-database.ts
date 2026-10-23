import { existsSync } from "node:fs";

/** URL de la base de tests. Nunca la de desarrollo: los tests borran datos. */
export function resolveTestDatabaseUrl(): string {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Falta TEST_DATABASE_URL (ver apps/web/.env.example).");
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL no puede ser igual a DATABASE_URL.");
  }
  return url;
}
