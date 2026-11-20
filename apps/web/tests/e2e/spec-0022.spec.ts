import { Pool } from "pg";
import { expect, test } from "./fixtures";
import { choose, confirmAndGenerate, signUpIndependentTeacher } from "./helpers";

// SPEC-0022: las marcas de verificación de Matemáticas en el editor. El quiz se genera con el
// AI Engine de prueba y las marcas se siembran en la versión 1 (el cálculo lo cubren las pruebas
// del motor).

let pool: Pool | null = null;
const db = () => (pool ??= new Pool({ connectionString: process.env.TEST_DATABASE_URL }));
test.afterAll(async () => {
  await pool?.end();
  pool = null;
});

test("CA-0022-10: el editor muestra las marcas y la quita al editar la pregunta", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("6V");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Matemáticas · 6° · 6V" }).click();
  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Números enteros");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("Suma de enteros");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar objetivo" }).click();
  await page
    .getByRole("textbox", { name: "Objetivo de aprendizaje" })
    .fill("Suma números enteros usando la recta numérica.");
  await page.getByRole("list", { name: "DBA del curso" }).getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Crear objetivo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: /^Opciones de tema/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Ajustar antes de crear" }).click();
  await page.getByRole("link", { name: /^Quiz/ }).click();
  await page.getByLabel("Número de preguntas").fill("4");
  await confirmAndGenerate(page, "quiz");
  const questions = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li");
  await expect(questions).toHaveCount(4, { timeout: 30_000 });

  // Siembra las marcas que pondría el AI Engine en la versión 1.
  const resourceId = page.url().split("/").pop()!.split("?")[0]!;
  const { rows } = await db().query<{ content: { questions: Record<string, unknown>[] } }>(
    `SELECT content FROM resource_versions WHERE "resourceId" = $1 AND number = 1`,
    [resourceId],
  );
  const content = rows[0]!.content;
  content.questions[0]!.answerCheck = { status: "VERIFIED", note: "El cálculo da 2." };
  content.questions[1]!.answerCheck = {
    status: "REVIEW",
    note: "El cálculo da 8 y la respuesta es otra.",
  };
  await db().query(
    `UPDATE resource_versions SET content = $2 WHERE "resourceId" = $1 AND number = 1`,
    [resourceId, JSON.stringify(content)],
  );
  await page.reload();

  await expect(questions.nth(0).getByTestId("answer-check")).toContainText(
    "Respuesta verificada · El cálculo da 2.",
  );
  await expect(questions.nth(1).getByTestId("answer-check")).toContainText(
    "Revisa esta respuesta: El cálculo da 8 y la respuesta es otra.",
  );
  await expect(questions.nth(2).getByTestId("answer-check")).toHaveCount(0);

  // El docente corrige la pregunta 2: la marca se va; la de la 1 sigue.
  await questions.nth(1).getByRole("button", { name: "Editar" }).click();
  await questions.nth(1).getByLabel("Enunciado").fill("¿Cuánto es 3 + 5?");
  await questions.nth(1).getByRole("button", { name: "Listo" }).click();
  await expect(page.getByText(/Versión 2/).first()).toBeVisible();
  await expect(questions.nth(1).getByTestId("answer-check")).toHaveCount(0);
  await page.reload();
  await expect(questions.nth(1).getByTestId("answer-check")).toHaveCount(0);
  await expect(questions.nth(0).getByTestId("answer-check")).toBeVisible();
});
