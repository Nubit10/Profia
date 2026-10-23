import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no carga .env automáticamente. En CI las variables llegan por el entorno.
if (existsSync(".env")) process.loadEnvFile(".env");

// `prisma generate` no necesita conexión, por eso la URL no es obligatoria aquí;
// la validación estricta de variables vive en lib/env.ts (RN-03).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
