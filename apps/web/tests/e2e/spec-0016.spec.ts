import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0016: talleres con enfoque DUA a elección del docente (AI Engine con el LLM de prueba).

async function courseWithTopic(page: Page) {
  await page
    .getByTestId("first-steps")
    .getByRole("button", { name: "Crear mi primer curso" })
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/create?type=WORKSHOP");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
}

const SHOTS = process.env.CAPTURAS ? "../../docs/design/capturas/spec-0016/" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
};

async function noViolations(page: Page) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("CA-0016-01/06/08: el docente elige DUA, el taller trae sus opciones y la guía, y la próxima vez viene marcado", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 780 });
  await signUpIndependentTeacher(page);
  await courseWithTopic(page);

  const toggle = page.getByRole("switch", { name: "Con enfoque DUA" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Con DUA", { exact: true })).toBeVisible();
  await noViolations(page);
  await shot(page, "01-ajustes-con-dua-movil");

  await page.getByRole("button", { name: "Generar taller" }).click();
  await expect(page.getByTestId("udl-activity").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Con DUA", { exact: true })).toBeVisible();
  const first = page.getByTestId("udl-activity").first();
  await expect(first).toContainText("Elige cómo responder");
  await expect(first).toContainText("Formas de presentar el contenido");
  await expect(first).toContainText("Si necesitas ayuda");
  await expect(page.getByRole("heading", { name: "Guía DUA del taller" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Barreras posibles y apoyos" })).toBeVisible();
  await noViolations(page);
  await shot(page, "02-taller-con-dua-movil");

  // CA-0016-06: el siguiente taller trae el DUA marcado.
  await page.goto("/create?type=WORKSHOP");
  // Con un solo tema en el curso, el asistente va directo a los ajustes (SPEC-0013 RN-03).
  await expect(page.getByRole("switch", { name: "Con enfoque DUA" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("CA-0016-02: sin DUA el taller sale como siempre", async ({ page }) => {
  await signUpIndependentTeacher(page);
  await courseWithTopic(page);
  await page.getByRole("button", { name: "Generar taller" }).click();
  await expect(page.getByRole("button", { name: "Descargar", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("udl-activity")).toHaveCount(0);
  await expect(page.getByText("Con DUA", { exact: true })).toHaveCount(0);
});
