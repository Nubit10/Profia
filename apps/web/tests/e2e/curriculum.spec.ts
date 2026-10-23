import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

async function createCourse(page: import("@playwright/test").Page, subject: string, grade: string) {
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", subject);
  await choose(page, "Grado", grade);
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("CA-0004-04: el curso muestra los DBA de su área y grado con su cita", async ({ page }) => {
  await signUpIndependentTeacher(page);
  await createCourse(page, "Matemáticas", "6°");
  await page.getByRole("link", { name: "Matemáticas · 6°" }).click();
  await page.getByRole("link", { name: "DBA y Estándares", exact: true }).click();

  await expect(page.getByRole("heading", { name: "DBA y Estándares del MEN" })).toBeVisible();
  const refs = page
    .getByRole("list", { name: "DBA y Estándares", exact: true })
    .locator(":scope > li");
  await expect(refs.first()).toContainText("DBA 1");
  await expect(refs.first()).toContainText("Evidencias de aprendizaje");
  const link = refs.first().getByRole("link", { name: "Ver documento oficial" });
  await expect(link).toHaveAttribute("href", /colombiaaprende\.edu\.co.*#page=\d+$/);
  await expect(refs.first()).toContainText(
    "Derechos Básicos de Aprendizaje: Matemáticas, V.2 (2016)",
  );

  const total = await refs.count();
  await page.getByLabel("Filtrar DBA y Estándares").fill("probabilidad");
  await expect.poll(() => refs.count()).toBeLessThan(total);
  await expect(refs.first()).toContainText(/probabilidad/i);
});

test("CA-0004-06: una asignatura propia se vincula a un área y muestra sus referentes", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await page.getByRole("link", { name: "Asignaturas" }).click();
  await page.getByLabel("Nombre de la asignatura").fill("Comprensión lectora");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(
    page.getByRole("list", { name: "Asignaturas" }).getByText("Comprensión lectora"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Inicio" }).click();
  await createCourse(page, "Comprensión lectora", "3°");
  await page.getByRole("link", { name: "Comprensión lectora · 3°" }).click();
  await page.getByRole("link", { name: "DBA y Estándares", exact: true }).click();

  await expect(page.getByText("Vincula «Comprensión lectora» a un área curricular")).toBeVisible();
  await choose(page, "Área curricular", "Lenguaje");
  await page.getByRole("button", { name: "Vincular a un área curricular" }).click();
  const refs = page
    .getByRole("list", { name: "DBA y Estándares", exact: true })
    .locator(":scope > li");
  await expect(refs).toHaveCount(8);
});

test("CA-0004-07: el curso de otro docente responde 404", async ({ page, browser }) => {
  await signUpIndependentTeacher(page);
  await createCourse(page, "Matemáticas", "1°");
  await page.getByRole("link", { name: "Matemáticas · 1°" }).click();
  await expect(page).toHaveURL(/\/courses\/[a-z0-9]+$/);
  const url = page.url();

  const other = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.200.1.9" } });
  const otherPage = await other.newPage();
  await signUpIndependentTeacher(otherPage, "Otro Profe");
  const response = await otherPage.goto(url);
  expect(response?.status()).toBe(404);
});

test("CA-0005-02/07: la búsqueda inteligente devuelve referentes del curso con su cita", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await createCourse(page, "Matemáticas", "8°");
  await page.getByRole("link", { name: "Matemáticas · 8°" }).click();
  await page.getByRole("link", { name: "DBA y Estándares", exact: true }).click();

  await page.getByLabel("Buscar en el currículo").fill("probabilidad de eventos");
  await page.getByRole("button", { name: "Buscar en el currículo" }).click();
  await expect(page.getByText(/en orden de relevancia/)).toBeVisible();

  const refs = page
    .getByRole("list", { name: "DBA y Estándares", exact: true })
    .locator(":scope > li");
  await expect(refs.first()).toContainText(/probabilidad/i);
  await expect(refs.first()).toContainText("Matemáticas, V.2 (2016)");
  expect(await refs.count()).toBeLessThanOrEqual(8);

  await page.getByRole("button", { name: "Ver todos" }).click();
  await expect(page.getByText(/en orden de relevancia/)).toHaveCount(0);
});
