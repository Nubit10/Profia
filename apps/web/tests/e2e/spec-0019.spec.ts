import { expect, test } from "./fixtures";
import { teacherWithTwoCourses } from "./spec-0019-support";

// SPEC-0019: el asistente de crear va un paso por pantalla; elegir avanza y lo elegido queda en los
// pasos (escritorio).

test("CA-0019-01/02/03/04/05: examen paso a paso, lo elegido en los pasos y «Volver»", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await teacherWithTwoCourses(page);
  const steps = page.getByRole("navigation", { name: "Pasos" });

  // CA-0019-01: la pantalla del curso solo trae los cursos; nada de temas debajo.
  await page.goto("/create?type=EXAM");
  await expect(page.getByRole("heading", { name: "¿Para qué curso?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Qué temas evalúa?" })).toHaveCount(0);
  await expect(page.getByLabel(/tema vas a trabajar|tema nuevo/)).toHaveCount(0);

  // CA-0019-02: elegir el curso avanza a otra pantalla, la de los temas, sin la lista de cursos.
  await page.getByRole("radio", { name: /Educación Religiosa/ }).click();
  await expect(page.getByRole("heading", { name: "¿Qué temas evalúa?" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Curso" })).toHaveCount(0);
  await page.getByLabel(/tema vas a trabajar/).fill("La creación");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.getByRole("button", { name: /Continuar con 1 tema/ }).click();
  await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Qué temas evalúa?" })).toHaveCount(0);

  // CA-0019-03: lo elegido se ve en los pasos; CA-0019-05: sin la tarjeta "Curso / Tema".
  await expect(steps).toContainText("Examen");
  await expect(steps).toContainText("Educación Religiosa · 3°");
  await expect(steps).toContainText("La creación");
  await expect(page.getByRole("definition")).toHaveCount(0);

  // CA-0019-04: «Volver» vuelve al paso anterior (los temas, con lo marcado).
  await page.getByRole("link", { name: "Volver a los temas" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué temas evalúa?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continuar con 1 tema/ })).toBeVisible();
  await page.getByRole("link", { name: "Volver al curso" }).click();
  await expect(page.getByRole("heading", { name: "¿Para qué curso?" })).toBeVisible();

  // CA-0019-03: tocar un paso hecho lleva a cambiarlo.
  await page.getByRole("radio", { name: /Matemáticas/ }).click();
  await expect(page.getByRole("heading", { name: "¿Qué temas evalúa?" })).toBeVisible();
  await steps.getByRole("link", { name: /Curso\s*Matemáticas/ }).click();
  await expect(page.getByRole("heading", { name: "¿Para qué curso?" })).toBeVisible();
});

test("CA-0019-01/04: taller: curso, luego tema en otra pantalla, y «Volver» desde los ajustes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await teacherWithTwoCourses(page);
  await page.goto("/create?type=WORKSHOP");
  await expect(page.getByRole("heading", { name: "¿Sobre qué tema?" })).toHaveCount(0);
  await page.getByRole("radio", { name: /Matemáticas/ }).click();
  await expect(page.getByRole("heading", { name: "¿Sobre qué tema?" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Curso" })).toHaveCount(0);
  await page.getByLabel(/tema vas a trabajar/).fill("Fracciones");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar taller" })).toBeVisible();
  await page.getByRole("link", { name: "Volver al tema" }).click();
  await expect(page.getByRole("heading", { name: "¿Sobre qué tema?" })).toBeVisible();
});
