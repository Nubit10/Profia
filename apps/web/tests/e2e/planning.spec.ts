import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";
import type { Page } from "@playwright/test";

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

test("CA-0006-01/03/04/05: planear unidad → tema → objetivo vinculado a un DBA", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await createCourse(page, "Matemáticas", "6°", "601");
  await page.getByRole("link", { name: "Matemáticas · 6° · 601" }).click();

  // CA-0006-01: 4 periodos por defecto.
  for (const n of [1, 2, 3, 4]) {
    await expect(page.getByRole("heading", { name: `Periodo ${n}`, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Cobertura de DBA: 0 de \d+/)).toBeVisible();

  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Números enteros");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("list", { name: "Unidades de Periodo 1" })).toContainText(
    "Números enteros",
  );

  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("La recta numérica");
  await page.getByLabel("Sesiones estimadas (opcional)").fill("4");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByText("4 sesiones")).toBeVisible();

  await page.getByRole("button", { name: "Agregar objetivo" }).click();
  await page
    .getByRole("textbox", { name: "Objetivo de aprendizaje" })
    .fill("Ubica números enteros en la recta numérica.");
  const dbas = page.getByRole("list", { name: "DBA del curso" });
  await dbas.getByRole("checkbox").first().click();
  await dbas.getByRole("checkbox").nth(1).click(); // primera evidencia del DBA 1
  await page.getByRole("button", { name: "Crear objetivo" }).click();

  const linked = page.getByRole("list", { name: "DBA vinculados" });
  await expect(linked).toContainText("DBA 1 · 1 evidencia(s)");
  await expect(page.getByText(/Cobertura de DBA: 1 de \d+/)).toBeVisible();
});

test("CA-0006-06/02: reordenar unidades y redefinir periodos", async ({ page }) => {
  await signUpIndependentTeacher(page);
  await createCourse(page, "Lengua Castellana", "4°", "4A");
  await page.getByRole("link", { name: "Lengua Castellana · 4° · 4A" }).click();

  for (const title of ["Poesía", "Cuento"]) {
    await page.getByRole("button", { name: "Nueva unidad" }).click();
    await page.getByLabel("Título de la unidad").fill(title);
    await page.getByRole("button", { name: "Crear unidad" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Subir unidad «Cuento»" }).click();
  const units = page.getByRole("list", { name: "Unidades de Periodo 1" }).locator(":scope > li");
  await expect(units.first()).toContainText("Cuento");
  await page.reload();
  await expect(units.first()).toContainText("Cuento");

  await page.getByRole("button", { name: "Periodos" }).click();
  await page.getByRole("button", { name: "Quitar el último" }).click();
  await page.getByRole("textbox", { name: "Periodo 1" }).fill("Primer trimestre");
  await page.getByRole("button", { name: "Guardar periodos" }).click();
  await expect(page.getByRole("heading", { name: "Primer trimestre" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Periodo 4", exact: true })).toHaveCount(0);
});

test("CA-0006-07: copiar la planeación a otro grupo del mismo grado", async ({ page }) => {
  await signUpIndependentTeacher(page);
  await createCourse(page, "Matemáticas", "7°", "701");
  await createCourse(page, "Matemáticas", "7°", "702");
  await page.getByRole("link", { name: "Matemáticas · 7° · 701" }).click();

  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Ecuaciones");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Copiar a otro curso" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Copiar planeación" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Mis cursos" }).click();
  await page.getByRole("link", { name: "Matemáticas · 7° · 702" }).click();
  await expect(page.getByRole("list", { name: "Unidades de Periodo 1" })).toContainText(
    "Ecuaciones",
  );
});

test("CA-0007-06/07: sugerir objetivos con IA, aceptar, editar, descartar y calificar", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await createCourse(page, "Matemáticas", "6°", "6B");
  await page.getByRole("link", { name: "Matemáticas · 6° · 6B" }).click();

  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Números enteros");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  // Sin sesiones estimadas: el campo es opcional.
  await page.getByLabel("Título del tema").fill("La recta numérica");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Sesiones sin definir")).toBeVisible();

  await page.getByRole("button", { name: "Sugerir objetivos con IA" }).click();
  const list = page.getByRole("list", { name: "Sugerencias de objetivos" });
  const cards = list.locator(":scope > li");
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("DBA");

  // Editar y aceptar la primera; descartar la segunda; calificar la tercera con comentario.
  await cards.nth(0).getByRole("button", { name: "Editar" }).click();
  await cards
    .nth(0)
    .getByLabel("Editar objetivo sugerido")
    .fill("Compara números enteros usando la recta numérica.");
  await cards.nth(0).getByRole("button", { name: "Guardar y aceptar" }).click();
  await expect(cards.nth(0)).toContainText("Aceptada");

  await cards.nth(1).getByRole("button", { name: "Descartar" }).click();
  await expect(cards.nth(1)).toContainText("Descartada");

  await cards.nth(2).getByRole("button", { name: "Sugerencia por mejorar" }).click();
  await cards.nth(2).getByLabel("Qué se debe mejorar").fill("Muy general para sexto");
  await cards.nth(2).getByRole("button", { name: "Enviar comentario" }).click();
  await expect(
    cards.nth(2).getByRole("button", { name: "Sugerencia por mejorar" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Escape");
  const objectives = page.getByRole("list", { name: "Objetivos de La recta numérica" });
  await expect(objectives).toContainText("Compara números enteros usando la recta numérica.");
  await expect(objectives.getByRole("list", { name: "DBA vinculados" })).toBeVisible();
});
