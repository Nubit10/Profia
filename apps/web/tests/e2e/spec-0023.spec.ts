import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, confirmAndGenerate, signUpIndependentTeacher, openEditor } from "./helpers";

// SPEC-0023: el interruptor "Estilo Saber (ICFES)" y la pregunta con situación, competencia y
// figura en el editor (AI Engine de prueba).

async function quizSettings(page: Page, subject: string, group: string) {
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", subject);
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill(group);
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: `${subject} · 6° · ${group}` }).click();
  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Unidad 1");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("Datos de la tienda");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: /^Opciones de tema/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Ajustar antes de crear" }).click();
  await page.getByRole("link", { name: /^Quiz/ }).click();
}

test("CA-0023-07/08: estilo Saber en Matemáticas: interruptor, situación, competencia y figura", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await signUpIndependentTeacher(page);
  await quizSettings(page, "Matemáticas", "6S");
  const saber = page.getByRole("switch", { name: "Estilo Saber (ICFES)" });
  await expect(saber).toHaveAttribute("aria-checked", "false");
  await saber.click();
  await page.getByLabel("Número de preguntas").fill("4");
  await page.getByRole("checkbox", { name: "Verdadero o falso" }).click();
  await page.getByRole("checkbox", { name: "Respuesta corta" }).click();
  await confirmAndGenerate(page, "quiz");

  await openEditor(page); // SPEC-0029: el recurso abre en la hoja
  const questions = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li");
  await expect(questions).toHaveCount(4, { timeout: 30_000 });
  const first = questions.first();
  await expect(first.getByTestId("saber-context")).toContainText("En la tienda del barrio");
  await expect(first.getByText(/^Competencia: /)).toBeVisible();
  await expect(first.getByTestId("figure")).toHaveAttribute(
    "alt",
    "Recta numérica de −5 a 5, de 1 en 1, con los puntos A en −3, B en 2.",
  );
  await expect(questions.nth(1).getByTestId("figure")).toHaveCount(0);

  // Quitar la figura y guardar.
  await first.getByRole("button", { name: "Editar" }).click();
  await first.getByRole("button", { name: "Quitar figura" }).click();
  await first.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByText(/Versión 2/).first()).toBeVisible();
  await expect(first.getByTestId("figure")).toHaveCount(0);
  await expect(first.getByTestId("saber-context")).toBeVisible();
});

test("CA-0023-07: en Ciencias Naturales no aparece el interruptor", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  await quizSettings(page, "Ciencias Naturales y Educación Ambiental", "6N");
  await expect(page.getByLabel("Número de preguntas")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Estilo Saber (ICFES)" })).toHaveCount(0);
});
