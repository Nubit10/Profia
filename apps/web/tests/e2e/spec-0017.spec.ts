import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, logout, signUpIndependentTeacher } from "./helpers";

// SPEC-0017: PIAR privado y cifrado (AI Engine con el LLM de prueba).

const SHOTS = process.env.CAPTURAS ? "../../docs/design/capturas/spec-0017/" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
};

async function createCourse(page: Page) {
  await page
    .getByTestId("first-steps")
    .getByRole("button", { name: "Crear mi primer curso" })
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function noViolations(page: Page, name: string) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => v.id),
    name,
  ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, name).toBeLessThanOrEqual(0);
}

test("CA-0017-01/04/05/06/09: crear, llenar, proponer con IA, descargar y borrar un PIAR, siempre con el aviso", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 780 });
  await signUpIndependentTeacher(page);
  await createCourse(page);

  await page.goto("/piar");
  await expect(page.getByTestId("piar-privacy")).toContainText(
    "Datos privados de un menor de edad",
  );
  await noViolations(page, "lista vacía");

  await page.getByRole("button", { name: "Nuevo PIAR" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo PIAR" });
  await dialog.getByLabel("Nombre del estudiante").fill("Valentina Ríos");
  // RN-04: sin la autorización no se crea.
  await dialog.getByRole("button", { name: "Crear PIAR" }).click();
  await expect(dialog.getByText("Confirma que tienes la autorización")).toBeVisible();
  await noViolations(page, "diálogo nuevo");
  await shot(page, "01-nuevo-piar-movil");
  await dialog.getByRole("checkbox", { name: /Tengo la autorización/ }).click();
  await dialog.getByRole("button", { name: "Crear PIAR" }).click();
  await expect(page).toHaveURL(/\/piar\/[\w-]+$/);
  // La pestaña no lleva el nombre del estudiante.
  await expect(page).toHaveTitle(/^PIAR/);
  expect(await page.title()).not.toContain("Valentina");
  await expect(page.getByTestId("piar-privacy")).toContainText(
    /se borra solo el \d+ de diciembre de \d{4}/,
  );

  await page.getByLabel("Fortalezas e intereses").fill("Le encanta dibujar.");
  await page
    .getByLabel("Barreras", { exact: true })
    .fill("Valentina se distrae con el ruido y le cuesta leer enunciados largos.");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("button", { name: "Guardado", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Proponer ajustes con IA para Periodo 1" }).click();
  const proposal = page.getByRole("region", { name: "Ajustes propuestos para Periodo 1" });
  await expect(proposal).toBeVisible({ timeout: 30_000 });
  await noViolations(page, "editor con propuesta");
  await shot(page, "02-editor-con-propuesta-movil");
  await proposal.getByRole("button", { name: "Agregar al periodo" }).click();
  await expect(page.locator("#piar-p1-didactic")).toHaveValue(/Dar las instrucciones por pasos/);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("button", { name: "Guardado", exact: true })).toBeVisible();

  // CA-0017-05: el documento se descarga sin el nombre en el archivo.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^PIAR - V\.R\. - Matemáticas - 6° - 2026\.pdf$/);

  // CA-0017-06: borrar lo quita.
  await page.getByRole("button", { name: "Borrar este PIAR" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar PIAR" }).click();
  await expect(page).toHaveURL(/\/piar$/);
  await expect(page.getByText("Aún no tienes PIAR")).toBeVisible();
});

test("CA-0017-03: otro docente no ve el PIAR por su enlace", async ({ page }) => {
  await signUpIndependentTeacher(page);
  await createCourse(page);
  await page.goto("/piar");
  await page.getByRole("button", { name: "Nuevo PIAR" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo PIAR" });
  await dialog.getByLabel("Nombre del estudiante").fill("Samuel Gómez");
  await dialog.getByRole("checkbox", { name: /Tengo la autorización/ }).click();
  await dialog.getByRole("button", { name: "Crear PIAR" }).click();
  await expect(page).toHaveURL(/\/piar\/[\w-]+$/);
  const url = page.url();

  await logout(page);
  await expect(page).toHaveURL(/\/login/);
  await signUpIndependentTeacher(page, "Otra Docente");
  const response = await page.goto(url);
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Samuel")).toHaveCount(0);
  const file = await page.request.get(`${url}/export?format=pdf`);
  expect(file.status()).toBe(404);
});
