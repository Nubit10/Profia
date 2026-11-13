import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import webpush from "web-push";

if (existsSync(".env")) process.loadEnvFile(".env");

const PORT = 3100;
const ENGINE_PORT = 8199;
const ENGINE_TOKEN = "e2e-token-e2e-token-e2e-token-0000";
// uv puede estar en el PATH (CI) o instalado como módulo de Python (equipo de desarrollo).
const uv = spawnSync("uv", ["--version"], { shell: true }).status === 0 ? "uv" : "python -m uv";
const baseURL = `http://localhost:${PORT}`;
// SPEC-0013 RN-15: claves VAPID de un solo uso para el servidor de pruebas (no se guardan en el repo).
const vapid = webpush.generateVAPIDKeys();
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("Falta TEST_DATABASE_URL (ver apps/web/.env.example).");

// E2E contra un build de producción conectado a la base de tests (nunca a la de desarrollo).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Los flujos de planeación tardan 20-40 s con los workers en paralelo en un equipo sin GPU.
  timeout: 60_000,
  // Bajo esa carga, una navegación o un refresco del servidor puede pasar de los 5 s por defecto.
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", locale: "es-CO" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /\.movil\.spec\.ts$/ },
    // SPEC-0013 RN-11: las pantallas en un celular (390 × 844, táctil). Chromium: es el que está
    // instalado; el tamaño, el tacto y el agente de usuario son los del iPhone 13.
    {
      name: "movil",
      testMatch: /\.movil\.spec\.ts$/,
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      // AI Engine con el proveedor de prueba y Qdrant en memoria: sin modelos ni Docker (SPEC-0005).
      command: `${uv} run uvicorn app.main:app --port ${ENGINE_PORT}`,
      cwd: "../ai-engine",
      url: `http://localhost:${ENGINE_PORT}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { PROVIDER: "mock", QDRANT_URL: ":memory:", AI_ENGINE_TOKEN: ENGINE_TOKEN },
    },
    {
      command: `npx prisma migrate deploy && npm run curriculum:import && npm run build && npx next start -p ${PORT}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        DATABASE_URL: testDatabaseUrl,
        AI_ENGINE_URL: `http://localhost:${ENGINE_PORT}`,
        AI_ENGINE_TOKEN: ENGINE_TOKEN,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
        VAPID_PRIVATE_KEY: vapid.privateKey,
        VAPID_SUBJECT: "mailto:pruebas@profe.test",
        // SPEC-0017 (ADR-0015): clave de cifrado del PIAR de un solo uso.
        PIAR_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      },
    },
  ],
});
