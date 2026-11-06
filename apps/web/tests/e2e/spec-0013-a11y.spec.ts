import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0013 CA-0013-20: las pantallas que cambiaron cumplen WCAG 2.1 AA, la regla de un botón
// principal y el glosario sin jerga (SPEC-0012), y a 360 px no se desbordan. De paso deja las
// capturas "después" en docs/design/capturas/spec-0013/ cuando se pide (CAPTURAS=1).

const FORBIDDEN = /\b(blueprint|tenant|prompt|token|schema|RAG)\b/i;
const SHOTS = process.env.CAPTURAS ? "../../docs/design/capturas/spec-0013/" : null;

async function checkScreen(page: Page, name: string) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => `${name}: ${v.id}`)).toEqual([]);
  const primaries = await page
    .locator("main a.bg-brand-gradient:visible, main button.bg-brand-gradient:visible")
    .count();
  expect(primaries, `${name}: botones primarios`).toBeLessThanOrEqual(1);
  expect(await page.locator("body").innerText(), `${name}: términos técnicos`).not.toMatch(
    FORBIDDEN,
  );
}

async function noHorizontalScroll(page: Page, name: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name}: scroll horizontal a 360 px`).toBeLessThanOrEqual(0);
}

async function shot(page: Page, file: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}${file}.png`, fullPage: true });
}

test("CA-0013-20: pantallas nuevas accesibles, con un botón principal y sin desbordarse a 360 px", async ({
  page,
}) => {
  test.setTimeout(180_000);
  // axe mide el color en el instante en que corre: a mitad de una transición (un enlace que pasa a
  // activo, una opción que se marca) ve colores intermedios. Sin transiciones mide el estado final.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpIndependentTeacher(page);

  // Inicio con "Primeros pasos".
  await checkScreen(page, "inicio: primeros pasos");
  await shot(page, "despues-01-inicio-primeros-pasos");

  await page
    .getByTestId("first-steps")
    .getByRole("button", { name: "Crear mi primer curso" })
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Asistente: ajustes del quiz con "Generar" en el mismo paso.
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar quiz" })).toBeVisible();
  await checkScreen(page, "asistente: ajustes");
  await shot(page, "despues-02-asistente-ajustes");

  // Recurso y diálogo de descarga.
  await page.getByRole("button", { name: "Generar quiz" }).click();
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible({ timeout: 30_000 });
  const resourceUrl = page.url();
  await checkScreen(page, "recurso");
  await page.getByRole("button", { name: "Descargar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Descargar" })).toBeVisible();
  await checkScreen(page, "diálogo de descarga");
  await shot(page, "despues-03-descargar");
  await page.keyboard.press("Escape");

  // Planeación compacta con su menú "⋯".
  await page.goto("/courses");
  await page
    .getByRole("link", { name: /Matemáticas · 6° · 601/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await checkScreen(page, "planeación");
  await shot(page, "despues-04-planeacion");

  // Ajustes → Notificaciones y "Sin conexión".
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notificaciones" })).toBeVisible();
  await checkScreen(page, "notificaciones");
  await page.goto("/resources");
  await expect(page.getByTestId("offline-panel")).toBeVisible();
  await checkScreen(page, "mis recursos: sin conexión");
  await shot(page, "despues-05-mis-recursos");
  await page.goto("/offline");
  await checkScreen(page, "sin conexión");

  // A 360 px, ninguna se desborda.
  await page.setViewportSize({ width: 360, height: 780 });
  for (const [name, path] of [
    ["inicio", "/dashboard"],
    ["asistente", "/create?type=QUIZ"],
    ["recurso", resourceUrl],
    ["notificaciones", "/notifications"],
    ["mis recursos", "/resources"],
    ["sin conexión", "/offline"],
  ] as const) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await noHorizontalScroll(page, name);
  }
  await page.goto(resourceUrl);
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible();
  await shot(page, "despues-06-recurso-movil");
  await page.getByRole("button", { name: "Descargar", exact: true }).click();
  await noHorizontalScroll(page, "diálogo de descarga");
  await shot(page, "despues-07-descargar-movil");
});
