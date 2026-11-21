import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher, openEditor } from "./helpers";

// SPEC-0028: usar el mismo recurso en mis otros grupos, en el celular (AI Engine de prueba).

async function course(page: Page, group: string, first = false) {
  await page.goto("/courses");
  await page
    .getByRole("button", { name: first ? "Crear mi primer curso" : /Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill(group);
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("CA-0028-01/06: «Usar también en…» copia el quiz al otro grupo sin gastar cupo (360 px y axe)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpIndependentTeacher(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await course(page, "6A", true);
  await course(page, "6B");

  await page.goto("/create?type=QUIZ");
  await page.getByRole("radio", { name: /6A/ }).click();
  await page.getByLabel(/tema vas a trabajar/).fill("Fracciones");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.getByRole("button", { name: "Generar quiz" }).click();
  await openEditor(page); // SPEC-0029: el recurso abre en la hoja
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible({ timeout: 30_000 });
  const quota = await page
    .getByText(/\d+\/10 hoy/)
    .first()
    .textContent();

  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Usar también en…" }).click();
  const dialog = page.getByRole("dialog", { name: "Usar también en…" });
  const option = dialog.getByRole("checkbox", { name: /6B/ });
  await expect(option).toBeChecked();
  expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await dialog.getByRole("button", { name: "Usar en 1 grupo" }).click();
  await dialog.getByRole("link", { name: /6B/ }).click();
  await expect(page.getByRole("heading", { name: "Quiz: Fracciones" })).toBeVisible();
  await openEditor(page); // SPEC-0029: el recurso abre en la hoja
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible();
  await expect(page.getByText(/\d+\/10 hoy/).first()).toHaveText(quota!);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
