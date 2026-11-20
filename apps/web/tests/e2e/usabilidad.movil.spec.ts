import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// Prueba de usabilidad con docentes (2026-11-20): lo que encontró el recorrido de una profesora nueva
// en el celular, para que no vuelva. AI Engine de prueba.

async function courseWithOneTopic(page: Page) {
  await page.getByRole("button", { name: "Crear mi primer curso" }).first().click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("6U");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/create?type=WORKSHOP");
  await page.getByLabel(/tema vas a trabajar/).fill("Fracciones");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar taller" })).toBeVisible();
}

test("usabilidad: crear sin estorbos y lo siguiente del mismo tema con un toque", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await signUpIndependentTeacher(page);
  await courseWithOneTopic(page);

  // En el asistente no flota el botón "Crear": tapaba sus botones.
  await expect(page.locator('[data-floating="create"]')).toHaveCount(0);
  // Las estructuras del taller se ven plegadas: solo la elegida, con la opción de cambiarla.
  await expect(page.getByRole("radio", { name: /Inicio, desarrollo y cierre/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Situación problema/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Generar taller" }).click();
  const next = page.getByRole("region", { name: /¿Qué más necesitas para «Fracciones»\?/ });
  await expect(next).toBeVisible({ timeout: 30_000 });
  await expect(next.getByRole("button", { name: "Crear taller" })).toHaveCount(0);

  // "Crear quiz" desde el taller: un toque y abre el quiz del mismo tema.
  await next.getByRole("button", { name: "Crear quiz" }).click();
  await expect(page.getByRole("heading", { name: "Quiz: Fracciones" })).toBeVisible();
  const first = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li").first();
  await first.getByRole("button", { name: "Editar" }).click({ timeout: 30_000 });
  // Marcar la opción correcta tiene un área cómoda para el dedo (44 px).
  const radio = first.getByRole("radio", { name: "Opción 1 es la correcta" });
  const area = await radio.locator("xpath=..").boundingBox();
  expect(area!.height).toBeGreaterThanOrEqual(44);
  expect(area!.width).toBeGreaterThanOrEqual(44);

  // Examen con un solo tema en el curso: ya viene marcado.
  await page.goto("/create?type=EXAM");
  await expect(page.getByRole("checkbox", { name: /Fracciones/ })).toBeChecked();
});
