import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * SPEC-0013 CA-0013-19: la misma suite contra `next dev`, donde React señala cualquier diferencia de
 * hidratación (la guardia de `tests/e2e/fixtures.ts` hace fallar la prueba). En desarrollo no se
 * registra el service worker (ADR-0012), así que quedan fuera las pruebas que dependen de él.
 * Uso: `npm run test:e2e:dev`.
 */
type WebServer = Extract<NonNullable<PlaywrightTestConfig["webServer"]>, unknown[]>[number];
const [engine, web] = base.webServer as WebServer[];

export default defineConfig({
  ...base,
  // Next compila cada ruta la primera vez: más tiempo por prueba.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  outputDir: "test-results-dev",
  grepInvert: /CA-0013-(28|30|33|34|37|40)/,
  webServer: [
    engine!,
    {
      ...web!,
      command: `npx prisma migrate deploy && npm run curriculum:import && npx next dev -p 3100`,
    },
  ],
});
