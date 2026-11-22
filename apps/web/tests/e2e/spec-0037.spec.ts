import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";
import type { Page } from "@playwright/test";

// SPEC-0037: Estándares de Matemáticas, Lenguaje e Inglés.

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

test("CA-0037-04: Inglés de 7° muestra sus Estándares por habilidad con las competencias", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  const refs = await openReferences(page, "Inglés", "7°", "701");
  // 7 DBA de Inglés de 7° (SPEC-0038) + 36 Estándares de 6°-7°.
  await expect(refs).toHaveCount(43);
  const first = refs.filter({ hasText: "Estándar 1" }).first();
  await expect(first).toContainText("Escucha");
  await expect(first).toContainText("Competencias que desarrolla");
  await expect(first).toContainText("Guía 22");
});

test("CA-0037-02: un estándar de Matemáticas se ve sin lista debajo", async ({ page }) => {
  await signUpIndependentTeacher(page);
  const refs = await openReferences(page, "Matemáticas", "6°", "601");
  const standard = refs.filter({ hasText: "Pensamiento numérico y sistemas numéricos" }).first();
  await expect(standard).toContainText("Estándares Básicos de Competencias en Matemáticas");
  await expect(standard).not.toContainText("Evidencias de aprendizaje");
  await expect(standard).not.toContainText("Estándar del grupo de grados");
});
