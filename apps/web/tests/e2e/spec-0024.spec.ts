import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0024 CA-0024-07: "Plan de aula" en el asistente Crear → curso → tema → ajustes → editor
// (AI Engine de prueba). A 360 px no hay desbordes ni violaciones de axe.

async function courseWithTopic(page: Page) {
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("6P");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Matemáticas · 6° · 6P" }).click();
  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Números racionales");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("Fracciones");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function checkScreen(page: Page, name: string) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => `${name}: ${v.id}`)).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name}: scroll horizontal`).toBeLessThanOrEqual(0);
}

test("CA-0024-07: crear un plan de aula desde el asistente y abrirlo en el editor (360 px y axe)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpIndependentTeacher(page);
  await courseWithTopic(page);
  await page.setViewportSize({ width: 360, height: 780 });

  await page.goto("/create");
  await page.getByRole("link", { name: /^Plan de aula/ }).click();
  // Un solo curso y un solo tema: el asistente llega directo a los ajustes.
  await expect(page.getByLabel("Sesiones")).toBeVisible();
  await checkScreen(page, "ajustes del plan");
  await page.getByLabel("Sesiones").fill("3");
  await page.getByLabel("Minutos por sesión").fill("55");
  await page.getByRole("button", { name: "Generar plan de aula" }).click();

  const sessions = page.getByTestId("lesson-session");
  await expect(sessions).toHaveCount(3, { timeout: 60_000 });
  await expect(page.getByTestId("rubric-row").first()).toBeVisible();
  // La rúbrica muestra los rangos de la escala predeterminada (1,0 a 5,0).
  await expect(page.getByText("(4,6 – 5,0)").first()).toBeVisible();
  await checkScreen(page, "editor del plan");

  // Editar el desarrollo de la sesión 2 y guardar crea la versión 2.
  await page
    .getByLabel("Desarrollo · sesión 2")
    .fill("Desarrollo editado: juego de la tienda con monedas y fracciones del peso.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(/Versión 2/).first()).toBeVisible();

  // La escala se ve en Ajustes; el docente independiente la puede cambiar.
  await page.goto("/grading-scale");
  await expect(page.getByRole("heading", { name: "Escala de valoración" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar escala" })).toBeVisible();
  await checkScreen(page, "escala de valoración");
});
