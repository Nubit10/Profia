import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";
import type { Page } from "@playwright/test";

// SPEC-0038: Competencias Ciudadanas y DBA de Inglés 6°-11°.

async function openReferences(page: Page, subject: string, grade: string, group: string) {
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", subject);
  await choose(page, "Grado", grade);
  await page.getByLabel("Grupo").fill(group);
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("link", { name: new RegExp(`${subject} · ${grade} · ${group}`) })
    .first()
    .click();
  await page.getByRole("link", { name: "DBA y Estándares", exact: true }).click();
  return page.getByRole("list", { name: "DBA y Estándares", exact: true }).locator(":scope > li");
}

test("CA-0038-02: Inglés de 6° muestra sus DBA con el nivel A1 y sin lista de evidencias", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  const refs = await openReferences(page, "Inglés", "6°", "601");
  const first = refs.first();
  await expect(first).toContainText("DBA 1");
  await expect(first).toContainText("Nivel A1");
  await expect(first).toContainText("Participa en una conversación corta.");
  await expect(first).toContainText("Esquema Curricular Sugerido");
  await expect(first).not.toContainText("Evidencias de aprendizaje");
});

test("CA-0038-04: Ética de 8° muestra los Estándares de Competencias Ciudadanas con su estándar de grupo", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  const refs = await openReferences(page, "Ética y Valores Humanos", "8°", "801");
  await expect(refs).toHaveCount(32);
  const first = refs.first();
  await expect(first).toContainText("Convivencia y paz");
  await expect(first).toContainText("Estándar del grupo de grados");
  await expect(first).toContainText("Estándares Básicos de Competencias Ciudadanas");
});
