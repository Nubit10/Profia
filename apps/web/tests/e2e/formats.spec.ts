import { guiaSanJose } from "../support/docx-formats";
import { expect, test } from "./fixtures";
import { PNG_1X1, choose, confirmAndGenerate, download, signUpIndependentTeacher } from "./helpers";

test("CA-0010-01/03/04/08/10: subir el formato, revisarlo y generar un taller con él", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);

  // Formatos: subir el Word, revisar lo detectado y guardarlo como predeterminado.
  await page.getByRole("link", { name: "Formatos" }).click();
  await page.getByLabel("Subir formato en Word").setInputFiles({
    name: "Guía San José.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await guiaSanJose(),
  });
  await expect(page.getByLabel("Nombre del formato")).toHaveValue("GUÍA DE APRENDIZAJE N° 3");
  const sections = page.getByRole("list", { name: "Secciones del formato" });
  await expect(sections.locator(":scope > li")).toHaveCount(4);
  await expect(page.getByLabel("Título de la sección 4")).toHaveValue("AUTOEVALUACIÓN");
  await expect(page.getByLabel("Texto fijo")).toHaveValue(/Participé en clase/);
  await expect(
    page.getByRole("list", { name: "Campos del encabezado" }).locator(":scope > li"),
  ).toHaveCount(7);
  await page.getByRole("button", { name: "Guardar formato" }).click();

  const mine = page.getByRole("list", { name: "Mis formatos" });
  await expect(mine).toContainText("GUÍA DE APRENDIZAJE N° 3");
  await mine
    .getByRole("button", { name: "Usar GUÍA DE APRENDIZAJE N° 3 como predeterminado" })
    .click();
  await expect(mine).toContainText("Predeterminado");

  // Logo del espacio (el docente independiente es administrador de su espacio).
  await page
    .getByLabel("Subir logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByRole("img", { name: "Logo actual" })).toBeVisible();

  // Curso, tema y taller con el formato preseleccionado (RN-08).
  await page.getByRole("link", { name: "Inicio" }).click();
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("6E");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Matemáticas · 6° · 6E" }).click();
  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Números enteros");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("La recta numérica");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Crear taller o quiz" }).click();
  // Asistente (SPEC-0012): el curso y el tema ya vienen elegidos; falta el tipo.
  await page.getByRole("link", { name: /^Taller/ }).click();
  await expect(
    page.getByRole("radio", { name: /Mi formato: GUÍA DE APRENDIZAJE N° 3/ }),
  ).toHaveAttribute("aria-checked", "true");
  await confirmAndGenerate(page, "taller");

  // Las secciones de actividades del formato y su sección de texto.
  await expect(page.getByRole("heading", { name: "1. SABERES PREVIOS" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "2. ACTIVIDADES DE PRÁCTICA" })).toBeVisible();
  await expect(page.getByLabel("CONCEPTUALIZACIÓN")).toHaveValue(/CONCEPTUALIZACIÓN/);

  const file = await download(page, "Guía del estudiante en Word");
  expect(file.suggestedFilename()).toBe("Taller - La recta numérica - 6°6E.docx");
});
