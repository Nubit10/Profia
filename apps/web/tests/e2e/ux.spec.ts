import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, logout, signUpIndependentTeacher, signUpSchoolAdmin } from "./helpers";

// SPEC-0012: rediseño visual y de UX. Recorridos del docente, accesibilidad y reglas de diseño.

// Un worker puede volver a este archivo después de cerrar el pool: se crea cuando hace falta.
let pool: Pool | null = null;
const db = () => (pool ??= new Pool({ connectionString: process.env.TEST_DATABASE_URL }));
test.afterAll(async () => {
  await pool?.end();
  pool = null;
});

async function createCourse(page: Page, group = "601") {
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill(group);
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Curso con un tema creado desde el asistente (tema rápido). Deja al docente en los ajustes. */
async function courseWithTopic(page: Page) {
  await createCourse(page);
  await page.goto("/create?type=WORKSHOP");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
}

/** Inserta recursos del docente directamente en la base de tests. */
async function insertResources(
  email: string,
  count: number,
  status: "DRAFT" | "FAILED" | "GENERATING" = "DRAFT",
) {
  const { rows } = await db().query<{
    institutionId: string;
    membershipId: string;
    courseId: string;
    topicId: string;
  }>(
    `SELECT m."institutionId", m.id AS "membershipId", c.id AS "courseId", t.id AS "topicId"
       FROM users u
       JOIN memberships m ON m."userId" = u.id
       JOIN courses c ON c."membershipId" = m.id
       JOIN units un ON un."courseId" = c.id
       JOIN topics t ON t."unitId" = un.id
      WHERE u.email = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  const ref = rows[0]!;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `ux${Date.now()}${i}${Math.random().toString(36).slice(2, 8)}`;
    ids.push(id);
    await db().query(
      `INSERT INTO resources (id, "institutionId", "membershipId", "courseId", "topicId", type,
         status, title, blueprint, context, "generationId", "failureReason", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'QUIZ', $6, 'Quiz: La recta numérica', '{}',
         '{"topic":{"id":"x","title":"La recta numérica","description":null},"dba":[]}',
         'log', $7, now())`,
      [
        id,
        ref.institutionId,
        ref.membershipId,
        ref.courseId,
        ref.topicId,
        status,
        status === "FAILED" ? "unavailable" : null,
      ],
    );
  }
  return { ...ref, ids };
}

const FORBIDDEN = /\b(blueprint|tenant|prompt|token|schema|RAG)\b/i;

/** Reglas comunes a cada pantalla principal (CA-0012-13/15/16). */
async function checkScreen(page: Page, name: string) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => `${name}: ${v.id}`)).toEqual([]);

  const primaries = await page
    .locator("main a.bg-brand-gradient:visible, main button.bg-brand-gradient:visible")
    .count();
  expect(primaries, `${name}: botones primarios`).toBeLessThanOrEqual(1);

  const text = await page.locator("body").innerText();
  expect(text, `${name}: términos técnicos`).not.toMatch(FORBIDDEN);
}

/** CA-0012-14: a 360 px la página no se desborda a lo ancho. */
async function expectNoHorizontalScroll(page: Page, path: string) {
  await page.goto(path);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${path} con scroll horizontal`).toBeLessThanOrEqual(0);
}

test("CA-0012-01/02: la landing presenta Profe sin prueba social inventada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Secciones" })).toBeAttached();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("IA para docentes");
  await expect(page.getByRole("link", { name: /Empieza gratis/ })).toHaveAttribute(
    "href",
    "/register",
  );
  await expect(page.getByRole("link", { name: "Ver herramientas" })).toHaveAttribute(
    "href",
    "#herramientas",
  );
  for (const section of [
    "Todo lo que preparas para tus clases, en un solo lugar",
    "De tu tema a un material listo, en tres pasos",
    "Lleva Profe a todo tu equipo docente",
    "Preguntas frecuentes",
  ]) {
    await expect(page.getByRole("heading", { name: section })).toBeVisible();
  }
  await expect(page.getByRole("contentinfo")).toBeVisible();

  // RN-05: sin cifras de usuarios, calificaciones ni testimonios.
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\d[\d.]*\s*(docentes|profesores|usuarios)|★|testimonio/i);
  // RN-06 y CA-0011-17: los exámenes ya existen; ninguna herramienta queda en "Próximamente".
  const exams = page.getByRole("listitem").filter({ hasText: "Exámenes" });
  await expect(exams).toBeVisible();
  await expect(exams).not.toContainText("Próximamente");
  await checkScreen(page, "landing");

  await page.goto("/login");
  await checkScreen(page, "login");
  await page.goto("/register");
  await checkScreen(page, "registro");

  // CA-0012-14: las pantallas públicas a 360 px.
  await page.setViewportSize({ width: 360, height: 780 });
  for (const path of ["/", "/login", "/register"]) await expectNoHorizontalScroll(page, path);
});

test("CA-0012-03/04/05/07/26: el Inicio guía al docente y crea su primer taller en 4 clics", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);

  // CA-0012-26: la bienvenida aparece la primera vez y no vuelve sola al cerrarla.
  const welcome = page.getByRole("region", { name: "Te damos la bienvenida a Profe" });
  await expect(welcome).toBeVisible();
  await welcome.getByRole("button", { name: "Cerrar el tutorial" }).click();
  await expect(welcome).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: /^Hola,/ })).toBeVisible();
  await expect(welcome).toHaveCount(0);
  await page.getByRole("button", { name: "Ver tutorial" }).click();
  await expect(page.getByRole("dialog", { name: "Así funciona Profe" })).toBeVisible();
  await page.keyboard.press("Escape");

  // CA-0012-03: sin cursos, el siguiente paso es crear el primero.
  const next = page.getByTestId("next-step");
  await expect(next).toContainText("Crea tu primer curso");
  await checkScreen(page, "inicio sin cursos");
  await createCourse(page);
  await expect(next).toContainText("Planea los temas de tu curso");

  await page.goto("/create?type=WORKSHOP");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();

  // CA-0012-04: con curso y tema, el siguiente paso es el primer taller con ese tema elegido.
  await page.goto("/dashboard");
  await expect(next).toContainText("Crea tu primer taller");
  await expect(next).toContainText("La recta numérica");

  // CA-0012-07: Inicio → taller generado en 4 clics con los valores por defecto.
  let clicks = 0;
  const click = async (locator: ReturnType<Page["getByRole"]>) => {
    clicks += 1;
    await locator.click();
  };
  await click(page.getByRole("link", { name: "Crear taller" }).first());
  await click(page.getByRole("link", { name: /La recta numérica/ }));
  await click(page.getByRole("button", { name: "Continuar" }));
  await click(page.getByRole("button", { name: "Generar taller" }));
  await expect(page).toHaveURL(/\/resources\/[a-z0-9]+$/);
  expect(clicks).toBeLessThanOrEqual(4);
  await expect(page.getByRole("heading", { name: "1. Inicio" })).toBeVisible({ timeout: 30_000 });
  await checkScreen(page, "recurso");

  // CA-0012-05: con recursos, el Inicio muestra los recientes y abre el último.
  await page.getByRole("link", { name: "Inicio" }).click();
  await expect(next).toContainText("Sigue donde quedaste");
  await expect(page.getByRole("list", { name: "Recursos recientes" })).toContainText(
    "La recta numérica",
  );
  await next.getByRole("link", { name: "Abrir taller" }).click();
  await expect(page).toHaveURL(/\/resources\/[a-z0-9]+$/);
});

test("CA-0012-06/08/12/22: menú Crear, asistente sin pérdida de datos y estados vacíos", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  await createCourse(page);

  // CA-0012-12: listas vacías con una explicación y una acción concreta.
  await page.getByRole("link", { name: "Mis recursos" }).click();
  const empty = page.locator("[data-slot=empty-state]");
  await expect(empty).toContainText("Aún no has creado talleres ni quices");
  await expect(empty.getByRole("link", { name: "Crear mi primer taller" })).toBeVisible();
  await checkScreen(page, "mis recursos");
  await page.getByRole("link", { name: "Formatos" }).click();
  await expect(page.locator("[data-slot=empty-state]").getByRole("button")).toBeVisible();
  await checkScreen(page, "formatos");

  // CA-0012-22: dentro del curso queda activo "Mis cursos".
  await page.getByRole("link", { name: "Mis cursos" }).click();
  await page.getByRole("link", { name: /Matemáticas · 6° · 601/ }).click();
  await expect(page.getByRole("link", { name: "Mis cursos" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("link", { name: "Recursos", exact: true }).click();
  await expect(page.locator("[data-slot=empty-state]").getByRole("link")).toBeVisible();
  await checkScreen(page, "curso");

  // CA-0012-06 (y SPEC-0011): "Crear" ofrece Taller, Quiz, Examen y Planeación.
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  for (const option of ["Taller", "Quiz", "Examen", "Planeación"]) {
    await expect(page.getByRole("menuitem", { name: new RegExp(`^${option}`) })).toBeEnabled();
  }
  await page.getByRole("menuitem", { name: /^Taller/ }).click();
  await expect(page).toHaveURL(/\/create\?type=WORKSHOP/);
  await checkScreen(page, "asistente: curso y tema");

  // CA-0012-08: lo elegido en los ajustes sobrevive a volver al paso 1 y a recargar.
  await page.getByLabel(/tema vas a trabajar/).fill("Fracciones");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.getByLabel("Número de actividades").fill("6");
  await checkScreen(page, "asistente: ajustes");
  await page.reload();
  await expect(page.getByLabel("Número de actividades")).toHaveValue("6");
  await page.getByRole("link", { name: /Qué crear/ }).click();
  await page.getByRole("link", { name: /^Taller/ }).click();
  await expect(page.getByLabel("Número de actividades")).toHaveValue("6");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/step=confirmar/);
  await page.reload();
  await expect(page.getByText("6 actividades · ")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generar taller" })).toBeVisible();
});

test("CA-0012-09: sin cursos, el asistente crea el curso sin salir del flujo", async ({ page }) => {
  await signUpIndependentTeacher(page);
  await page.goto("/create?type=QUIZ");
  await expect(page.getByRole("heading", { name: "Primero, crea tu curso" })).toBeVisible();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "7°");
  await page.getByRole("button", { name: "Crear curso y continuar" }).click();
  await expect(page.getByRole("heading", { name: "¿Sobre qué tema?" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Matemáticas · 7°/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("CA-0012-10/21: con el cupo agotado, el menú y el asistente lo avisan antes de los ajustes", async ({
  page,
}) => {
  const user = await signUpIndependentTeacher(page);
  await courseWithTopic(page);
  await insertResources(user.email, 7);
  await page.goto("/dashboard");
  await expect(page.getByTestId("quota-line")).toHaveText("7 de 10 recursos con IA hoy");

  await insertResources(user.email, 3);
  await page.goto("/create");
  // El aviso aparece en el primer paso, antes de elegir nada.
  await expect(
    page.getByRole("alert").filter({ hasText: "Llegaste al límite de recursos con IA de hoy" }),
  ).toBeVisible();
  await expect(page.getByTestId("quota-line")).toContainText("Cupo de IA agotado · vuelve a las");
});

test("CA-0012-11: el recurso en generación explica qué pasa y el fallido ofrece salidas", async ({
  page,
}) => {
  const user = await signUpIndependentTeacher(page);
  await courseWithTopic(page);
  const generating = await insertResources(user.email, 1, "GENERATING");
  await page.goto(`/courses/${generating.courseId}/resources/${generating.ids[0]}`);
  await expect(
    page.getByRole("status").filter({ hasText: "Estamos creando tu quiz" }),
  ).toBeVisible();

  const failed = await insertResources(user.email, 1, "FAILED");
  await page.goto(`/courses/${failed.courseId}/resources/${failed.ids[0]}`);
  const alert = page.getByRole("alert").filter({ hasText: "No pudimos crear tu quiz" });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(alert.getByRole("link", { name: "Volver al curso" })).toHaveAttribute(
    "href",
    `/courses/${failed.courseId}`,
  );
  await expect(alert).not.toContainText(/error|excepción|500/i);
});

test("CA-0012-14/24: a 360 px no hay scroll horizontal y el menú es un cajón accesible", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const user = await signUpIndependentTeacher(page);
  await courseWithTopic(page);
  const { courseId, ids } = await insertResources(user.email, 1);
  await page.setViewportSize({ width: 360, height: 780 });

  for (const path of [
    "/dashboard",
    "/courses",
    `/courses/${courseId}`,
    `/courses/${courseId}/resources/${ids[0]}`,
    "/resources",
    "/create",
    "/formats",
  ]) {
    await expectNoHorizontalScroll(page, path);
  }

  await page.goto("/dashboard");
  const menuButton = page.getByRole("button", { name: "Abrir menú" });
  const drawer = page.getByRole("dialog", { name: "Menú" });

  // Escape cierra el cajón, libera el scroll y devuelve el foco.
  await menuButton.click();
  await expect(drawer.getByRole("link", { name: "Mis recursos" })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(menuButton).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");

  // Tocar el fondo oscuro, a la derecha del cajón, también lo cierra.
  await menuButton.click();
  await expect(drawer).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar menú", exact: true })
    .click({ position: { x: 340, y: 500 } });
  await expect(drawer).toHaveCount(0);
  await expect(menuButton).toBeFocused();

  // Al navegar desde el cajón, se cierra y el foco vuelve al botón de menú.
  await menuButton.click();
  await drawer.getByRole("link", { name: "Mis recursos" }).click();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(drawer).toHaveCount(0);
  await expect(menuButton).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("CA-0012-12/13/14/15/16: las pantallas del colegio son accesibles y guían al administrador", async ({
  page,
}) => {
  await signUpSchoolAdmin(page);
  const menu = page.getByRole("navigation", { name: "Menú principal" });
  await menu.getByRole("link", { name: "Datos y sedes" }).click();
  await expect(page).toHaveURL(/\/school$/);
  await checkScreen(page, "colegio");

  // CA-0012-12: sin otros profesores, la acción es invitar al primero.
  await menu.getByRole("link", { name: "Profesores" }).click();
  const empty = page.locator("[data-slot=empty-state]");
  await expect(empty).toContainText("Aún no hay otros profesores");
  await empty.getByRole("button", { name: "Invitar al primer profesor" }).click();
  await expect(page.getByLabel("Correo del profesor")).toBeFocused();
  await checkScreen(page, "profesores");

  await page.setViewportSize({ width: 360, height: 780 });
  for (const path of ["/dashboard", "/school", "/school/members", "/formats"]) {
    await expectNoHorizontalScroll(page, path);
  }
});

test("CA-0012-19: con movimiento reducido no hay transiciones decorativas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpIndependentTeacher(page);
  const duration = await page
    .getByRole("link", { name: "Mis cursos" })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(0.001);
});

test("CA-0012-25/28: salir pide confirmación y el botón Atrás no vuelve al área de trabajo", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  // CA-0012-28: lo que el menú no muestra, el servidor tampoco lo sirve.
  await expect(page.getByRole("link", { name: "Profesores" })).toHaveCount(0);
  const response = await page.goto("/school/members");
  expect(response?.status()).toBe(404);

  await page.goto("/resources");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(/\/resources$/);

  await logout(page);
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login/);
});
