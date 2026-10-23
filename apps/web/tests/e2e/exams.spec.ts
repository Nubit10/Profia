import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, download, signUpIndependentTeacher } from "./helpers";

// SPEC-0011: exámenes con IA, de la planeación a la descarga, con el AI Engine de prueba.

// Un worker puede volver a este archivo después de cerrar el pool: se crea cuando hace falta.
let pool: Pool | null = null;
const db = () => (pool ??= new Pool({ connectionString: process.env.TEST_DATABASE_URL }));
test.afterAll(async () => {
  await pool?.end();
  pool = null;
});

const id = () => `e2e${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

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

/** Planeación sembrada: dos temas en el periodo 1 y uno en el periodo 2. */
async function seedPlanning(email: string) {
  const { rows } = await db().query<{ institutionId: string; courseId: string }>(
    `SELECT m."institutionId", c.id AS "courseId"
       FROM users u JOIN memberships m ON m."userId" = u.id
       JOIN courses c ON c."membershipId" = m.id
      WHERE u.email = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  const { institutionId, courseId } = rows[0]!;
  const units = [
    { period: 1, title: "Números enteros", topics: ["La recta numérica", "Suma de enteros"] },
    { period: 2, title: "Racionales", topics: ["Fracciones"] },
  ];
  let position = 1;
  for (const unit of units) {
    const unitId = id();
    await db().query(
      `INSERT INTO units (id, "institutionId", "courseId", "periodNumber", title, position, "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [unitId, institutionId, courseId, unit.period, unit.title, position++],
    );
    let topicPosition = 1;
    for (const title of unit.topics) {
      await db().query(
        `INSERT INTO topics (id, "institutionId", "unitId", title, position, "updatedAt")
         VALUES ($1, $2, $3, $4, $5, now())`,
        [id(), institutionId, unitId, title, topicPosition++],
      );
    }
  }
  return { courseId };
}

test("CA-0011-17: de la planeación al examen generado, con temas de dos periodos", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const user = await signUpIndependentTeacher(page);
  await createCourse(page);
  const { courseId } = await seedPlanning(user.email);

  // Desde la planeación: "Crear examen de esta unidad" llega con sus temas marcados.
  await page.goto(`/courses/${courseId}?tab=planeacion`);
  await page.getByRole("link", { name: "Crear examen de esta unidad" }).first().click();
  await expect(page).toHaveURL(/type=EXAM.*scope=UNIT/);
  await expect(page.getByRole("heading", { name: "¿Qué temas evalúa?" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "La recta numérica" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Suma de enteros" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Fracciones" })).not.toBeChecked();

  // Decisión 5: se puede sumar un tema de otro periodo.
  await page.getByRole("checkbox", { name: "Fracciones" }).click();
  await page.getByRole("button", { name: "Continuar con 3 temas" }).click();

  // Ajustes con los valores recomendados para 6°.
  await expect(page.getByText("Valores recomendados para 6°")).toBeVisible();
  await expect(page.getByRole("list", { name: "Secciones" }).locator(":scope > li")).toHaveCount(3);
  await expect(page.getByText("19 preguntas · Suman")).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await expect(page.getByText("El examen usa 2.")).toBeVisible();

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/step=confirmar/);
  await expect(
    page
      .getByRole("definition")
      .filter({ hasText: "La recta numérica, Suma de enteros, Fracciones" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generar examen" }).click();

  await expect(page).toHaveURL(/\/resources\/[a-z0-9]+$/);
  await expect(
    page.getByRole("heading", { name: /^Examen: La recta numérica y 2 temas más$/ }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("region", { name: "Sección 1" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Puntaje total:")).toBeVisible();

  // RN-14: la nota mínima se ajusta sin crear versión nueva.
  await page.getByLabel("Nota mínima para aprobar").fill("3,5");
  await page.getByRole("button", { name: "Guardar escala" }).click();
  await expect(page.getByText("Escala guardada")).toBeVisible();

  // CA-0011-04: cambiar los puntos de una pregunta crea la versión 2.
  const first = page.getByRole("region", { name: "Sección 1" }).getByRole("listitem").first();
  await first.getByRole("button", { name: "Editar" }).click();
  await first.getByLabel("Puntos").fill("10");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Versión 2", { exact: false }).first()).toBeVisible();

  // Descargas: hoja, clave por versión y la hoja de respuestas (RN-15).
  const key = await download(page, "Clave en PDF");
  expect(key.suggestedFilename()).toMatch(/^Clave - Examen - La recta numérica y 2 temas más/);
  const answers = await download(page, "Hoja de respuestas en Word");
  expect(answers.suggestedFilename()).toMatch(/^Hoja de respuestas - Examen/);
});

test("CA-0011-11: con el cupo casi agotado el asistente avisa que el examen no alcanza", async ({
  page,
}) => {
  const user = await signUpIndependentTeacher(page);
  await createCourse(page);
  const { courseId } = await seedPlanning(user.email);
  const { rows } = await db().query<{
    institutionId: string;
    membershipId: string;
    topicId: string;
  }>(
    `SELECT m."institutionId", m.id AS "membershipId", t.id AS "topicId"
       FROM users u JOIN memberships m ON m."userId" = u.id
       JOIN courses c ON c."membershipId" = m.id JOIN units un ON un."courseId" = c.id
       JOIN topics t ON t."unitId" = un.id WHERE u.email = $1 LIMIT 1`,
    [user.email.toLowerCase()],
  );
  const ref = rows[0]!;
  for (let i = 0; i < 9; i++) {
    await db().query(
      `INSERT INTO resources (id, "institutionId", "membershipId", "courseId", "topicId", type,
         status, title, blueprint, context, "generationId", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'QUIZ', 'DRAFT', 'Quiz', '{}',
         '{"topic":{"id":"x","title":"x","description":null},"dba":[]}', 'log', now())`,
      [id(), ref.institutionId, ref.membershipId, courseId, ref.topicId],
    );
  }
  await page.goto(`/create?type=EXAM&courseId=${courseId}`);
  const alert = page.getByRole("alert").filter({ hasText: "No te alcanza" });
  await expect(alert).toContainText("No te alcanza el cupo de recursos con IA para un examen");
  await expect(alert).toContainText("Un examen usa 2 recursos y te queda 1.");
});
