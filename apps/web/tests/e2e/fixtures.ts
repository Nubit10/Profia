import { test as base, expect, type Browser } from "@playwright/test";

// Cada contexto simula un dispositivo distinto (su propia IP en x-forwarded-for) para que los
// límites de intentos por IP (SPEC-0001 RN-09) no se crucen entre tests, como con usuarios reales.
export const randomIp = () =>
  `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 254) + 1).join(".")}`;

// Un texto distinto entre servidor y navegador rompe la hidratación: en desarrollo es una página de
// error a pantalla completa y en producción React vuelve a pintar todo. Ningún flujo debe causarlo.
const HYDRATION_ERROR = /Hydration failed|hydration mismatch|Minified React error #(418|423|425)/i;

export const test = base.extend<{ hydrationGuard: void }>({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": randomIp() });
  },
  hydrationGuard: [
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && HYDRATION_ERROR.test(message.text()))
          errors.push(message.text().slice(0, 300));
      });
      page.on("pageerror", (error) => {
        if (HYDRATION_ERROR.test(error.message)) errors.push(error.message.slice(0, 300));
      });
      await provide();
      expect(errors, "errores de hidratación en la página").toEqual([]);
    },
    { auto: true },
  ],
});

/** Contexto nuevo (otro usuario/dispositivo) con su propia IP. */
export function newDeviceContext(browser: Browser) {
  return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
}

export { expect };
