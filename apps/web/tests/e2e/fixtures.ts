import { test as base, type Browser } from "@playwright/test";

// Cada contexto simula un dispositivo distinto (su propia IP en x-forwarded-for) para que los
// límites de intentos por IP (SPEC-0001 RN-09) no se crucen entre tests, como con usuarios reales.
export const randomIp = () =>
  `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 254) + 1).join(".")}`;

export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": randomIp() });
  },
});

/** Contexto nuevo (otro usuario/dispositivo) con su propia IP. */
export function newDeviceContext(browser: Browser) {
  return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
}

export { expect } from "@playwright/test";
