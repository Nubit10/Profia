import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher, openEditor } from "./helpers";

// SPEC-0027: ajustes rápidos con botones en el celular (AI Engine de prueba).

async function quiz(page: Page) {
  await page.getByRole("button", { name: "Crear mi primer curso" }).first().click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("6A");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("Fracciones");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.getByRole("button", { name: "Generar quiz" }).click();
  await openEditor(page); // SPEC-0029: el recurso abre en la hoja
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible({ timeout: 30_000 });
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

test("CA-0027-01/02/11/12: «Más fácil» con un toque, propuesta como la hoja y «Quedarme con esta»", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpIndependentTeacher(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await quiz(page);

  const row = page.getByRole("group", { name: "Ajustes rápidos" });
  const easier = row.getByRole("button", { name: "Más fácil" });
  await expect(easier).toBeVisible();
  const box = await easier.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await axe(page, "recurso con ajustes");

  await easier.click();
  const proposal = page.getByRole("region", { name: "Así quedó «Más fácil»" });
  await expect(proposal).toBeVisible({ timeout: 30_000 });
  await expect(proposal.getByTestId("doc-preview")).toBeVisible();
  await axe(page, "propuesta del ajuste");

  await proposal.getByRole("button", { name: "Quedarme con esta" }).click();
  await expect(page.getByText(/Versión 2/).first()).toBeVisible();
  await openEditor(page); // SPEC-0029: el recurso abre en la hoja
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible();

  // Fichas por ítem: ya no hay que escribir para regenerar una pregunta.
  const first = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li").first();
  await first.getByRole("button", { name: "Mejorar", exact: true }).click();
  await expect(first.getByRole("button", { name: "Otra pregunta" })).toBeVisible();
  await expect(first.getByRole("textbox", { name: /Qué cambiar/ })).toHaveCount(0);
  await first.getByRole("button", { name: "Otra pregunta" }).click();
  await expect(first.getByText("Propuesta de la IA")).toBeVisible({ timeout: 30_000 });
});
