import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// Mejoras de usabilidad en el celular (docs/usabilidad/proximos-pasos.md): la hoja como se imprime
// (SPEC-0029), barra de navegación abajo (bloque 7) y detalles (bloque 8). AI Engine de prueba.

async function quiz(page: Page) {
  await page.getByRole("button", { name: "Crear mi primer curso" }).first().click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("6H");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("Fracciones");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.getByRole("button", { name: "Generar quiz" }).click();
}

async function axe(page: Page, name: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations.map((v) => `${name}: ${v.id}`)).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name}: scroll horizontal`).toBeLessThanOrEqual(0);
}

test("CA-0029-01/02/04: el quiz abre como la hoja, con respuestas marcadas y «Editar» en cada pregunta", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpIndependentTeacher(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await quiz(page);

  const sheet = page.getByTestId("doc-preview");
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("group", { name: "Cómo ver el recurso" }).getByRole("button", { name: "Hoja" }),
  ).toHaveAttribute("aria-pressed", "true");
  const marked = sheet.locator("li.text-success");
  await expect(marked.first()).toBeVisible();
  await axe(page, "hoja del quiz");

  // Sin respuestas: como la ve el estudiante.
  await page.getByLabel("Marcar las respuestas").uncheck();
  await expect(sheet.locator("li.text-success")).toHaveCount(0);

  // "Editar" en la pregunta 2 abre el editor en esa pregunta, ya en edición.
  await sheet.getByRole("button", { name: "Editar pregunta 2" }).click();
  const second = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li").nth(1);
  await expect(second.getByLabel("Enunciado")).toBeVisible();

  // Bloque 8: la primera vez se explica "Borrador" y "Listo"; "Entendido" no la vuelve a mostrar.
  const hint = page.getByTestId("status-hint");
  await expect(hint).toBeVisible();
  await hint.getByRole("button", { name: /Entendido/ }).click();
  await expect(hint).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("doc-preview")).toBeVisible();
  await expect(page.getByTestId("status-hint")).toHaveCount(0);
});

test("bloques 7 y 8: barra abajo con Inicio · Mis cursos · Crear · Mis recursos y letra más grande", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  await page.setViewportSize({ width: 360, height: 780 });

  const tabs = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(tabs).toBeVisible();
  await expect(page.locator('[data-floating="create"]')).toHaveCount(0);
  for (const name of ["Inicio", "Mis cursos", "Mis recursos"]) {
    const link = tabs.getByRole("link", { name });
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(tabs.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Mis recursos" }).click();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(tabs.getByRole("link", { name: "Mis recursos" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await tabs.getByRole("button", { name: "Crear" }).click();
  await expect(page.getByRole("menuitem", { name: /Quiz/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await axe(page, "Mis recursos con la barra");

  // Letra más grande (en Ajustes): se guarda en el dispositivo y se aplica antes de pintar.
  const base = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ajustes", level: 1 })).toBeVisible();
  const size = page.getByRole("radiogroup", { name: "Tamaño de la letra" });
  await size.getByRole("radio", { name: /Más grande/ }).click();
  await expect(size.getByRole("radio", { name: /Más grande/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await axe(page, "Ajustes");
  await page.reload();
  const large = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  expect(parseFloat(large)).toBeGreaterThan(parseFloat(base));
});

test("CA-0032-02: en el celular, Primeros pasos propone los temas y al aceptarlos vuelve al Inicio", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  await page.getByRole("button", { name: "Crear mi primer curso" }).first().click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("6P");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Ver los temas propuestos" }).click();
  const add = page.getByRole("button", { name: /Agregar a la planeación/ });
  await expect(add).toBeVisible({ timeout: 60_000 });
  await add.click();
  // La hoja se cierra sin deshacer el salto al Inicio (Atrás cierra capas, SPEC-0013).
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("first-steps")).toContainText("2 de 4 listos");
  await expect(page.getByRole("link", { name: "Crear mi primer taller" })).toBeVisible();
});
