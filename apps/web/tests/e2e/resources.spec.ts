import { expect, test } from "./fixtures";
import { choose, confirmAndGenerate, download, signUpIndependentTeacher } from "./helpers";
import type { Page } from "@playwright/test";

/** Curso de Matemáticas 6° con una unidad, un tema y un objetivo vinculado al DBA 1. */
async function topicWithObjective(page: Page, group: string) {
  await signUpIndependentTeacher(page);
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill(group);
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: `Matemáticas · 6° · ${group}` }).click();

  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Números enteros");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("La recta numérica");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar objetivo" }).click();
  await page
    .getByRole("textbox", { name: "Objetivo de aprendizaje" })
    .fill("Compara números enteros usando la recta numérica.");
  await page.getByRole("list", { name: "DBA del curso" }).getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Crear objetivo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Crear taller o quiz" }).click();
  await expect(page.getByRole("heading", { name: "Crear taller o quiz con IA" })).toBeVisible();
}

test("CA-0008-01/06/07/08/09: generar un quiz, editarlo, regenerar una pregunta y evaluarlo", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await topicWithObjective(page, "6C");

  await page.getByRole("link", { name: /^Quiz/ }).click();
  await page.getByLabel("Número de preguntas").fill("4");
  await confirmAndGenerate(page, "quiz");

  const questions = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li");
  await expect(questions).toHaveCount(4, { timeout: 30_000 });
  await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
  await expect(questions.first()).toContainText("DBA 1");

  // CA-0008-06: editar y guardar crea una versión nueva.
  await questions.nth(0).getByRole("button", { name: "Editar" }).click();
  await questions
    .nth(0)
    .getByLabel("Enunciado")
    .fill("¿Qué número está más a la izquierda en la recta?");
  await questions.nth(0).getByRole("button", { name: "Listo" }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(/Versión 2/).first()).toBeVisible();
  await expect(questions.nth(0)).toContainText("¿Qué número está más a la izquierda en la recta?");

  // CA-0008-07: regenerar con una indicación llega como propuesta.
  await questions.nth(1).getByRole("button", { name: "Regenerar" }).click();
  await questions.nth(1).getByLabel("Qué cambiar en Pregunta 2").fill("Hazla más difícil");
  await questions.nth(1).getByRole("button", { name: "Proponer" }).click();
  await expect(questions.nth(1).getByText("Propuesta de la IA")).toBeVisible();
  await questions.nth(1).getByRole("button", { name: "Usar esta versión" }).click();
  // La propuesta ya muestra el texto nuevo: se espera a que llegue la versión 3 guardada.
  await expect(questions.nth(1).getByText("Propuesta de la IA")).toHaveCount(0);
  await expect(page.getByText(/Versión 3/).first()).toBeVisible();
  await expect(questions.nth(1)).toContainText("Versión revisada (Hazla más difícil)");

  // CA-0008-08 / CA-0008-09: evaluar una pregunta y guardar el comentario como preferencia.
  await questions.nth(2).getByRole("button", { name: "Pregunta 3: por mejorar" }).click();
  await questions
    .nth(2)
    .getByLabel("Qué se debe mejorar en Pregunta 3")
    .fill("Usa ejemplos con temperaturas de ciudades colombianas");
  await questions.nth(2).getByText("Tenerlo en cuenta en mis próximas generaciones").click();
  await questions.nth(2).getByRole("button", { name: "Enviar comentario" }).click();
  await expect(page.getByText("Guardado como preferencia")).toBeVisible();

  await page.getByRole("radio", { name: "4 de 5" }).click();
  await expect(page.getByRole("radio", { name: "4 de 5" })).toHaveAttribute("aria-checked", "true");

  // RN-01: el docente decide cuándo está listo.
  await page.getByRole("button", { name: "Marcar como listo" }).click();
  await expect(page.getByText("Listo", { exact: true })).toBeVisible();

  // CA-0009-10 (SPEC-0009): descargar la versión B de la hoja y su clave.
  await choose(page, "Versiones para evitar la copia", "2");
  const sheet = await download(page, "Hoja del estudiante (versión B) en PDF");
  expect(sheet.suggestedFilename()).toBe("Quiz - La recta numérica - 6°6C - Versión B.pdf");
  const key = await download(page, "Clave (versión B) en Word");
  expect(key.suggestedFilename()).toBe("Clave - Quiz - La recta numérica - 6°6C - Versión B.docx");

  await page.getByRole("link", { name: "Recursos del curso" }).click();
  const library = page.getByRole("list", { name: "Recursos del curso" });
  await expect(library).toContainText("Quiz: La recta numérica");
  await expect(library).toContainText("Listo");

  // La preferencia aparece en el siguiente formulario y se puede quitar de esta generación.
  await page.getByRole("link", { name: "Planeación" }).click();
  await page.getByRole("link", { name: "Crear taller o quiz" }).click();
  await page.getByRole("link", { name: /^Quiz/ }).click();
  await page.getByText("Más opciones").click();
  const prefs = page.getByRole("list", { name: "Preferencias guardadas" });
  await expect(prefs).toContainText("Usa ejemplos con temperaturas de ciudades colombianas");
  await expect(prefs.getByRole("checkbox")).toBeChecked();
});

test("CA-0008-02/14: el taller usa la estructura que elige el docente", async ({ page }) => {
  test.setTimeout(120_000);
  await topicWithObjective(page, "6D");

  await page.getByRole("link", { name: /^Taller/ }).click();
  const option = page.getByRole("radio", { name: /Situación problema/ });
  await expect(option).toContainText("Necesita al menos 4 actividades");
  await option.click();
  await expect(page.getByLabel("Número de actividades")).toHaveValue("4");
  await confirmAndGenerate(page, "taller");

  for (const [i, moment] of [
    "Planteamiento del problema",
    "Investigación",
    "Propuesta de solución",
    "Socialización",
  ].entries()) {
    await expect(page.getByRole("heading", { name: `${i + 1}. ${moment}` })).toBeVisible({
      timeout: 30_000,
    });
  }
  await expect(
    page.getByRole("list", { name: "Actividades de Investigación" }).locator("li"),
  ).not.toHaveCount(0);
});
