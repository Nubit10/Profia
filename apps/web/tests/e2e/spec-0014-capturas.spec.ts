import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0014 T11: capturas "después" del recorrido de §2, con la IA de prueba y en 1366 × 860, más
// dos en el celular. Solo corre cuando se piden (CAPTURAS=1); las pruebas de cada CA están en
// spec-0014.spec.ts.

const SHOTS = "../../docs/design/capturas/spec-0014/";
test.skip(!process.env.CAPTURAS, "Solo con CAPTURAS=1");

async function shot(page: Page, file: string, fullPage = true) {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)));
    await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
  });
  await page.screenshot({ path: `${SHOTS}${file}.png`, fullPage });
}

test("capturas después de SPEC-0014", async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1366, height: 860 });
  await signUpIndependentTeacher(page);
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Matemáticas · 6° · 601" }).click();
  await expect(page.getByRole("heading", { name: "Periodo 1", exact: true })).toBeVisible();
  const courseUrl = page.url().split("?")[0]!;

  // F-01: la planeación vacía ofrece proponer con IA, y la revisión de la propuesta.
  await expect(
    page.getByRole("button", { name: "Proponer temas con IA", exact: true }),
  ).toBeVisible();
  await shot(page, "despues-01-planeacion-vacia", false);
  await page.getByRole("button", { name: "Proponer temas con IA para Periodo 1" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Más temas" }).click();
  await expect(dialog.getByRole("textbox", { name: "Título de la unidad" })).toHaveCount(3);
  await shot(page, "despues-02-revision-propuesta", false);
  await dialog.getByRole("button", { name: /Agregar a la planeación/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // F-02: objetivos para toda la unidad en una sola revisión.
  const unit = page
    .getByRole("list", { name: "Unidades de Periodo 1" })
    .locator(":scope > li")
    .first();
  await unit.getByRole("button", { name: /^Opciones de unidad/ }).click();
  await page.getByRole("menuitem", { name: "Proponer objetivos" }).click();
  await expect(page.getByRole("button", { name: /^Aceptar todos/ })).toBeVisible();
  await shot(page, "despues-03-objetivos-en-bloque", false);
  await page.getByRole("button", { name: /^Aceptar todos/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // F-03: la planeación con los DBA de cada tema y la ficha abierta.
  await shot(page, "despues-04-planeacion-con-dba");
  await unit
    .getByRole("button", { name: /^DBA \d+: ver enunciado/ })
    .first()
    .click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Fuente" })).toBeVisible();
  await shot(page, "despues-05-ficha-dba", false);
  await page.keyboard.press("Escape");

  // F-05: quiz con un toque desde el tema; F-04: recursos agrupados.
  const [first] = await unit.getByRole("heading", { level: 3 }).allTextContents();
  await page.getByRole("button", { name: `Crear quiz de «${first}»` }).click();
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible({ timeout: 30_000 });
  await page.goto(courseUrl);
  await unit.getByRole("button", { name: /^Opciones de unidad/ }).click();
  await page.getByRole("menuitem", { name: "Crear examen de esta unidad" }).click();
  await expect(page).toHaveURL(/\/resources\//);
  await page.goto(`${courseUrl}?tab=recursos`);
  await expect(page.getByRole("region", { name: /· Exámenes$/ })).toBeVisible();
  await shot(page, "despues-06-recursos-del-curso");
  await page.goto("/resources");
  await expect(page.getByRole("heading", { name: "Recientes" })).toBeVisible();
  await shot(page, "despues-07-mis-recursos");

  // En el celular: la ficha de DBA como hoja inferior y los recursos agrupados.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${courseUrl}?tab=recursos`);
  await expect(page.getByRole("region", { name: /· Exámenes$/ })).toBeVisible();
  await shot(page, "despues-08-movil-recursos", false);
  await page.goto(courseUrl);
  await page
    .getByRole("button", { name: /^DBA \d+: ver enunciado/ })
    .first()
    .click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Fuente" })).toBeVisible();
  await shot(page, "despues-09-movil-ficha-dba", false);
});
