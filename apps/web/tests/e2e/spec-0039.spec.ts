import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";
import type { Page } from "@playwright/test";

// SPEC-0039 (y SPEC-0038 etapa 2): Estándares en el objetivo y Orientaciones del MEN.

async function openCourse(page: Page, subject: string, grade: string, group: string) {
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
}

async function newObjective(page: Page) {
  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Unidad 1");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("Tema 1");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar objetivo" }).click();
}

test("CA-0039-09: en Matemáticas, el objetivo deja elegir Estándares aparte y se ven como «Estándar n»", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  await openCourse(page, "Matemáticas", "6°", "601");
  await newObjective(page);
  await page.getByRole("textbox", { name: "Objetivo de aprendizaje" }).fill("Compara fracciones.");
  await page.getByText("Estándares del grupo de grados (opcional)").click();
  const standards = page.getByRole("list", { name: "Estándares del curso" });
  await standards.locator(":scope > li").first().getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear objetivo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "DBA vinculados" }).first()).toContainText(
    "Estándar 1",
  );
});

test("CA-0039-10: Tecnología de 6° muestra sus Orientaciones y Lucía puede proponer los temas", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openCourse(page, "Tecnología e Informática", "6°", "601");
  await expect(page.getByRole("button", { name: /Proponer .* con IA/ }).first()).toBeVisible();
  await page.getByRole("link", { name: "DBA y Estándares", exact: true }).click();
  const refs = page
    .getByRole("list", { name: "DBA y Estándares", exact: true })
    .locator(":scope > li");
  await expect(refs).toHaveCount(31);
  await expect(refs.first()).toContainText("Orientación 1");
  await expect(refs.first()).toContainText("Competencia a la que apunta");
  await expect(refs.first()).toContainText("Guía 30");
});
