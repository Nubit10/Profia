import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0021 Parte A en el celular: la propuesta abre en una hoja inferior. La propuesta se siembra
// en la base: la parte que llama al AI Engine la cubren las pruebas de integración.

let pool: Pool | null = null;
const db = () => (pool ??= new Pool({ connectionString: process.env.TEST_DATABASE_URL }));
test.afterAll(async () => {
  await pool?.end();
  pool = null;
});

const TEXT = "Escribe enunciados cortos y directos, de una sola oración.";

async function createCourse(page: Page) {
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function seedSuggestion(email: string) {
  const { rows } = await db().query<{
    institutionId: string;
    membershipId: string;
    courseId: string;
  }>(
    `SELECT m."institutionId", m.id AS "membershipId", c.id AS "courseId"
       FROM users u JOIN memberships m ON m."userId" = u.id
       JOIN courses c ON c."membershipId" = m.id
      WHERE u.email = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  const { institutionId, membershipId, courseId } = rows[0]!;
  await db().query(
    `INSERT INTO preference_suggestions (id, "institutionId", "membershipId", "courseId", text, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      `e2e${Date.now()}`,
      institutionId,
      membershipId,
      courseId,
      TEXT,
      "Acortaste 6 enunciados en 3 quices.",
    ],
  );
  return { membershipId };
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

test("CA-0021-09: en el celular la propuesta abre en una hoja inferior que Atrás cierra", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 780 });
  const user = await signUpIndependentTeacher(page);
  await createCourse(page);
  const { membershipId } = await seedSuggestion(user.email);

  await page.goto("/resources");
  // La tarjeta de escritorio no se ve; en su lugar, la franja que abre la hoja.
  await expect(page.getByTestId("preference-suggestion")).toBeHidden();
  const strip = page.getByTestId("preference-suggestion-open");
  await expect(strip).toContainText("ProfIA aprendió algo de ti");
  await noViolations(page, "mis recursos con propuesta");

  await strip.click();
  const sheet = page.getByTestId("preference-suggestion-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("suggestion-reason")).toHaveText(
    "Acortaste 6 enunciados en 3 quices.",
  );
  await noViolations(page, "hoja de la propuesta");

  // Atrás cierra la hoja sin decidir y sigue en "Mis recursos".
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(strip).toBeVisible();

  // Editar el texto, elegir todos los cursos y aceptar.
  await strip.click();
  const edited = `${TEXT} Sin relatos largos.`;
  await sheet.getByLabel("ProfIA lo tendrá en cuenta así").fill(edited);
  await sheet.getByRole("checkbox", { name: "En todos mis cursos" }).click();
  await sheet.getByRole("button", { name: "Usar de ahora en adelante" }).click();
  await expect(sheet).toBeHidden();
  await expect(strip).toHaveCount(0);

  const { rows } = await db().query<{ text: string; courseId: string | null }>(
    `SELECT text, "courseId" FROM teacher_preferences WHERE "membershipId" = $1`,
    [membershipId],
  );
  expect(rows).toEqual([{ text: edited, courseId: null }]);
  await page.reload();
  await expect(page.getByTestId("preference-suggestion-open")).toHaveCount(0);
});
