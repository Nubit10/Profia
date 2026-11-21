import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";
import type { Page } from "@playwright/test";

// SPEC-0036: DBA y Estándares de Ciencias Naturales y Ciencias Sociales.

async function createCourse(page: Page, subject: string, grade: string, group: string) {
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", subject);
  await choose(page, "Grado", grade);
  await page.getByLabel("Grupo").fill(group);
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("CA-0036-04: Ciencias Sociales de 8° muestra sus DBA y los Estándares de 8°-9° con su cita", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await createCourse(page, "Ciencias Sociales", "8°", "801");
  await page
    .getByRole("link", { name: /Ciencias Sociales · 8° · 801/ })
    .first()
    .click();
  await page.getByRole("link", { name: "DBA y Estándares", exact: true }).click();

  const refs = page
    .getByRole("list", { name: "DBA y Estándares", exact: true })
    .locator(":scope > li");
  await expect(refs.first()).toContainText("DBA 1");
  await expect(refs.first()).toContainText("Evidencias de aprendizaje");
  await expect(refs.first()).toContainText(
    "Derechos Básicos de Aprendizaje: Ciencias Sociales, V.1 (2016)",
  );
  await expect(refs).toHaveCount(8 + 50);
  const standard = refs.filter({ hasText: "Estándar 1" }).first();
  await expect(standard).toContainText("Estándar del grupo de grados");
  await expect(standard).toContainText("Estándares Básicos de Competencias en Ciencias Sociales");
  await expect(standard).toContainText(
    "Estándares Básicos de Competencias en Ciencias Sociales, V.1 (2006)",
  );
  // CA-0036-09: las fuentes nuevas se muestran como pendientes de revisión docente.
  await expect(page.getByText("pendiente de revisión docente")).toBeVisible();
});

test("CA-0036-05: en Ciencias Naturales de 7°, Lucía marca DBA sugeridos al escribir el objetivo", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  await createCourse(page, "Ciencias Naturales y Educación Ambiental", "7°", "701");
  await page
    .getByRole("link", { name: /Ciencias Naturales y Educación Ambiental · 7° · 701/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("La energía");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("Energía mecánica");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar objetivo" }).click();
  await page
    .getByRole("textbox", { name: "Objetivo de aprendizaje" })
    .fill("Identifica la energía cinética y potencial de un péndulo y una montaña rusa");

  const suggested = page
    .getByRole("list", { name: "DBA del curso" })
    .locator(":scope > li", { hasText: "Sugerido" });
  await expect(suggested.first()).toBeVisible({ timeout: 5_000 });
  // El DBA 1 de 7° es el de energía mecánica (caída libre, montaña rusa, péndulo).
  await expect(suggested.filter({ hasText: "DBA 1." })).toHaveCount(1);
  await expect(page.getByText(/Lucía marcó \d DBA sugeridos?/)).toBeVisible();
});
