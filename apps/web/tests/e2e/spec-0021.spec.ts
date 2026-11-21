import { Pool } from "pg";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0021 Parte A en escritorio: la propuesta es una tarjeta en "Mis recursos".

let pool: Pool | null = null;
const db = () => (pool ??= new Pool({ connectionString: process.env.TEST_DATABASE_URL }));
test.afterAll(async () => {
  await pool?.end();
  pool = null;
});

test("CA-0021-04: en escritorio la tarjeta deja descartar la propuesta y no vuelve", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const user = await signUpIndependentTeacher(page);
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const { rows } = await db().query<{ institutionId: string; membershipId: string }>(
    `SELECT m."institutionId", m.id AS "membershipId"
       FROM users u JOIN memberships m ON m."userId" = u.id WHERE u.email = $1 LIMIT 1`,
    [user.email.toLowerCase()],
  );
  const { institutionId, membershipId } = rows[0]!;
  await db().query(
    `INSERT INTO preference_suggestions (id, "institutionId", "membershipId", text, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      `e2e${Date.now()}`,
      institutionId,
      membershipId,
      "Usa ejemplos del contexto colombiano en cada pregunta.",
      "Pediste contexto colombiano al rehacer 4 preguntas.",
    ],
  );

  await page.goto("/resources");
  const card = page.getByTestId("preference-suggestion");
  await expect(card).toBeVisible();
  await expect(card.getByLabel("ProfIA lo tendrá en cuenta así")).toHaveValue(
    "Usa ejemplos del contexto colombiano en cada pregunta.",
  );
  // Sin curso sugerido no se pregunta el alcance: aplica a todos.
  await expect(card.getByRole("group", { name: "¿Dónde aplica?" })).toHaveCount(0);
  await card.getByRole("button", { name: "No, gracias" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("preference-suggestion")).toHaveCount(0);
  const status = await db().query<{ status: string }>(
    `SELECT status FROM preference_suggestions WHERE "membershipId" = $1`,
    [membershipId],
  );
  expect(status.rows).toEqual([{ status: "DECLINED" }]);
});
