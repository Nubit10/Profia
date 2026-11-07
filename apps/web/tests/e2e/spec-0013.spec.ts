import type { Locator, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { Pool } from "pg";
import { expect, newDeviceContext, test } from "./fixtures";
import { PASSWORD, choose, download, signUpIndependentTeacher, uniqueEmail } from "./helpers";

// SPEC-0013: Profe más fácil, hecho para el celular e instalable.

let pool: Pool | null = null;
const db = () => (pool ??= new Pool({ connectionString: process.env.TEST_DATABASE_URL }));
test.afterAll(async () => {
  await pool?.end();
  pool = null;
});

/** Recurso del docente insertado tal como lo deja la generación en curso (ADR-0008). */
async function insertGenerating(email: string) {
  const { rows } = await db().query<Record<string, string>>(
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
  const id = `gen${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  await db().query(
    `INSERT INTO resources (id, "institutionId", "membershipId", "courseId", "topicId", type,
       status, title, blueprint, context, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'QUIZ', 'GENERATING', 'Quiz: La recta numérica', '{}',
       '{"topic":{"id":"x","title":"La recta numérica","description":null},"dba":[]}', now())`,
    [id, ref.institutionId, ref.membershipId, ref.courseId, ref.topicId],
  );
  return { id, courseId: ref.courseId! };
}

/** Cuenta solo los clics del usuario (sin contar escribir), como CA-0012-07. */
function clickCounter() {
  let clicks = 0;
  return {
    click: async (locator: Locator) => {
      clicks += 1;
      await locator.click();
    },
    get count() {
      return clicks;
    },
  };
}

/**
 * Controles de formulario que el docente ve en `main form`. Los checkbox y selects de Base UI
 * llevan un `input` oculto de 1×1 px: se cuenta el control que se toca, no ese.
 */
async function visibleControls(page: Page) {
  return page.evaluate(() => {
    const form = document.querySelector("main form");
    if (!form) return 0;
    return [
      ...form.querySelectorAll(
        "input:not([type=hidden]), textarea, select, [role=checkbox], [role=combobox]",
      ),
    ].filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 4 && box.height > 4 && !el.closest("details:not([open])");
    }).length;
  });
}

async function fillRegistrationFields(page: Page, name: string, email: string) {
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(PASSWORD);
}

test("CA-0013-01: crear la cuenta inicia la sesión y llega al Inicio en 2 clics", async ({
  page,
}) => {
  const counter = clickCounter();
  await page.goto("/register");
  await fillRegistrationFields(page, "Ana Pérez", uniqueEmail());
  await counter.click(page.getByRole("button", { name: "Crear cuenta" }));
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
  await counter.click(page.getByRole("button", { name: "Empezar por mi cuenta" }));
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Hola, Ana Pérez" })).toBeVisible();
  expect(counter.count).toBeLessThanOrEqual(2);
});

/** Curso de Matemáticas 6° con el grupo dado, creado desde "Primeros pasos". */
async function createCourseFromFirstSteps(page: Page, group = "601") {
  await page
    .getByTestId("first-steps")
    .getByRole("button", { name: "Crear mi primer curso" })
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill(group);
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("CA-0013-02/03/04: Primeros pasos guía de la cuenta nueva a la primera descarga", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);

  // CA-0013-02: un solo bloque con 4 pasos y su progreso; sin tutorial ni otro siguiente paso.
  const steps = page.getByTestId("first-steps");
  await expect(steps).toBeVisible();
  await expect(steps.getByRole("list", { name: "Pasos" }).locator(":scope > li")).toHaveCount(4);
  await expect(steps).toContainText("0 de 4 listos");
  await expect(page.getByTestId("next-step")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Te damos la bienvenida a Profe" })).toHaveCount(0);
  await expect(page.locator("main .bg-brand-gradient:is(a, button):visible")).toHaveCount(1);

  await createCourseFromFirstSteps(page);
  await expect(steps).toContainText("1 de 4 listos");

  // CA-0013-04: el primer tema se escribe dentro del asistente; 3 clics hasta generar.
  const counter = clickCounter();
  await counter.click(steps.getByRole("link", { name: "Escribir mi primer tema" }));
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await counter.click(page.getByRole("button", { name: "Usar este tema" }));
  await counter.click(page.getByRole("button", { name: "Generar taller" }));
  await expect(page).toHaveURL(/\/resources\/[a-z0-9]+$/);
  expect(counter.count).toBeLessThanOrEqual(3);
  await expect(page.getByRole("heading", { name: "1. Inicio" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "Inicio" }).click();
  await expect(steps).toContainText("3 de 4 listos");
  await steps.getByRole("link", { name: "Abrir mi taller" }).click();
  await download(page, "Guía del estudiante en PDF");

  // CA-0013-03: completados los 4 pasos, queda "Siguiente paso".
  await page.getByRole("link", { name: "Inicio" }).click();
  await expect(page.getByTestId("next-step")).toContainText("Sigue donde quedaste");
  await expect(steps).toHaveCount(0);
});

test("CA-0013-09/10: con un curso y un tema, Inicio → Generar quiz en 3 clics y ajustes cortos", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  await createCourseFromFirstSteps(page);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar quiz" })).toBeVisible();

  await page.goto("/dashboard");
  const counter = clickCounter();
  await counter.click(page.getByRole("link", { name: /Crear quiz/ }));
  // RN-03: el curso y el tema ya están elegidos y se ven, con "Cambiar".
  await expect(page.getByText("Tema: La recta numérica")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cambiar" })).toBeVisible();

  // CA-0013-10: 6 controles o menos a la vista; el resto en "Más opciones".
  expect(await visibleControls(page)).toBeLessThanOrEqual(6);
  await expect(page.getByLabel("Número de preguntas")).toBeVisible();
  await expect(page.getByLabel("Duración (minutos)")).toBeVisible();
  await expect(page.getByText("Más opciones")).toBeVisible();

  await counter.click(page.getByRole("button", { name: "Generar quiz" }));
  await expect(page).toHaveURL(/\/resources\/[a-z0-9]+$/);
  expect(counter.count).toBeLessThanOrEqual(3);

  // "Cambiar" deja elegir otro tema aunque el curso tenga uno solo.
  await page.goto("/create?type=QUIZ");
  await page.getByRole("link", { name: "Cambiar" }).click();
  await expect(page.getByRole("heading", { name: "¿Sobre qué tema?" })).toBeVisible();
});

/** Curso con una unidad y un tema en la planeación; deja abierto el diálogo "Agregar objetivo". */
async function openObjectiveDialog(page: Page) {
  await signUpIndependentTeacher(page);
  await createCourseFromFirstSteps(page);
  await page.getByRole("link", { name: "Mis cursos" }).click();
  await page
    .getByRole("link", { name: /Matemáticas · 6° · 601/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Números enteros");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("La recta numérica");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar objetivo" }).click();
}

test("CA-0013-05: al escribir el objetivo, Profe marca DBA sugeridos y se crea en 1 clic", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openObjectiveDialog(page);
  await page
    .getByRole("textbox", { name: "Objetivo de aprendizaje" })
    .fill("Compara números enteros usando la recta numérica");
  const suggested = page
    .getByRole("list", { name: "DBA del curso" })
    .locator(":scope > li", { hasText: "Sugerido" });
  await expect(suggested.first()).toBeVisible({ timeout: 3_000 });
  // El criterio: para este objetivo de Matemáticas 6°, el DBA 1 queda sugerido y marcado.
  await expect(suggested.filter({ hasText: "DBA 1." })).toHaveCount(1);
  const count = await suggested.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(3);
  await expect(suggested.first().getByRole("checkbox").first()).toBeChecked();
  await expect(page.getByText(/Profe marcó \d DBA sugeridos?/)).toBeVisible();

  // El docente quita uno: no vuelve a marcarse solo al seguir escribiendo.
  await suggested.first().getByRole("checkbox").first().click();
  await page.getByRole("textbox", { name: "Objetivo de aprendizaje" }).press("End");
  await page.getByRole("textbox", { name: "Objetivo de aprendizaje" }).pressSequentially(".");
  await page.waitForTimeout(1_500);
  await expect(suggested.first().getByRole("checkbox").first()).not.toBeChecked();

  const counter = clickCounter();
  await counter.click(page.getByRole("button", { name: "Crear objetivo" }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(counter.count).toBe(1);
  await expect(page.getByText("Compara números enteros usando la recta numérica")).toBeVisible();
});

test("CA-0013-06: si la búsqueda de DBA falla, el diálogo de objetivo funciona como antes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openObjectiveDialog(page);
  // Toda acción del servidor que se llame desde aquí falla, como si el AI Engine no respondiera.
  await page.route("**/courses/**", (route) =>
    route.request().method() === "POST" && route.request().headers()["next-action"]
      ? route.fulfill({ status: 500, body: "" })
      : route.continue(),
  );
  await page
    .getByRole("textbox", { name: "Objetivo de aprendizaje" })
    .fill("Compara números enteros usando la recta numérica");
  await page.waitForTimeout(1_500);
  await expect(page.getByText("Sugerido")).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0);
  await page.unroute("**/courses/**");
  await page.getByRole("list", { name: "DBA del curso" }).getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Crear objetivo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("CA-0013-07/08: planeación compacta, con las acciones en un menú y periodos vacíos en una línea", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openObjectiveDialog(page);
  await page
    .getByRole("textbox", { name: "Objetivo de aprendizaje" })
    .fill("Compara números enteros usando la recta numérica");
  await page.getByRole("button", { name: "Crear objetivo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // CA-0013-07: con 1 unidad, 1 tema y 1 objetivo, 4 controles de acción o menos a la vista.
  const main = page.getByRole("main");
  const actionControls = main.locator(
    'button[aria-label^="Opciones de"]:visible, a:visible:text-matches("Crear examen", "i"), button[aria-label^="Editar "]:visible, button[aria-label^="Subir "]:visible, button[aria-label^="Bajar "]:visible, button[aria-label^="Archivar "]:visible',
  );
  expect(await actionControls.count()).toBeLessThanOrEqual(4);

  // Cada acción sigue disponible desde "⋯", con el teclado.
  const unitMenu = page.getByRole("button", { name: "Opciones de unidad «Números enteros»" });
  await unitMenu.focus();
  await page.keyboard.press("Enter");
  for (const name of [
    "Crear examen de esta unidad",
    "Editar unidad «Números enteros»",
    "Subir unidad «Números enteros»",
    "Bajar unidad «Números enteros»",
    "Archivar unidad «Números enteros»",
  ]) {
    await expect(page.getByRole("menuitem", { name })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Opciones de tema «La recta numérica»" }).click();
  await page.getByRole("menuitem", { name: "Editar tema «La recta numérica»" }).click();
  await expect(page.getByLabel("Título del tema")).toHaveValue("La recta numérica");
  await page.keyboard.press("Escape");

  // CA-0013-08: un periodo vacío ocupa una sola línea con "Agregar unidad".
  const period2 = page.getByRole("region", { name: /Periodo 2/ });
  const box = await period2.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(64);
  await period2.getByRole("button", { name: /Agregar unidad/ }).click();
  await expect(page.getByLabel("Periodo", { exact: true })).toContainText("Periodo 2");
});

test("CA-0013-11/12: el aviso de 'listo' llega en cualquier página y el menú cuenta lo que se genera", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const user = await signUpIndependentTeacher(page);
  await createCourseFromFirstSteps(page);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar quiz" })).toBeVisible();

  const resource = await insertGenerating(user.email);
  await page.goto("/courses");
  // CA-0013-12: "1 generándose" junto a "Mis recursos".
  await expect(page.getByRole("link", { name: /Mis recursos/ })).toContainText("1 generándose");

  // CA-0013-11: termina mientras el docente está en otra página → aviso con "Abrir", en < 10 s.
  await db().query(`UPDATE resources SET status = 'DRAFT', "generationId" = 'log' WHERE id = $1`, [
    resource.id,
  ]);
  const toast = page.getByText("Tu quiz está listo");
  await expect(toast).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: /Mis recursos/ })).not.toContainText("generándose");
  await page.getByRole("button", { name: "Abrir" }).click();
  await expect(page).toHaveURL(new RegExp(`/resources/${resource.id}$`));

  // Una sola vez: al volver a otra página no se repite.
  await page.goto("/courses");
  await page.waitForTimeout(6_000);
  await expect(page.getByText("Tu quiz está listo")).toHaveCount(0);
});

/** Docente con un quiz generado; deja la página del quiz abierta con sus preguntas. */
async function generatedQuiz(page: Page) {
  const user = await signUpIndependentTeacher(page);
  await createCourseFromFirstSteps(page);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.getByRole("button", { name: "Generar quiz" }).click();
  const questions = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li");
  await expect(questions.first()).toBeVisible({ timeout: 30_000 });
  return { user, questions };
}

test("CA-0013-13: 'Listo' guarda el cambio de una pregunta en 2 clics", async ({ page }) => {
  test.setTimeout(120_000);
  const { questions } = await generatedQuiz(page);
  const counter = clickCounter();
  await counter.click(questions.nth(0).getByRole("button", { name: "Editar" }));
  await questions.nth(0).getByLabel("Enunciado").fill("¿Qué número está más a la izquierda?");
  await counter.click(questions.nth(0).getByRole("button", { name: "Listo" }));
  await expect(page.getByText(/Versión 2/).first()).toBeVisible();
  expect(counter.count).toBe(2);
  // No queda nada por guardar.
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);
  await page.reload();
  await expect(questions.nth(0)).toContainText("¿Qué número está más a la izquierda?");
});

test("CA-0013-14: hoja y clave en PDF con 2 versiones bajan en un .zip en 3 clics", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await generatedQuiz(page);
  await page.getByRole("button", { name: "Marcar como listo" }).click();
  await expect(page.getByText("Listo", { exact: true })).toBeVisible();

  const counter = clickCounter();
  const started = Date.now();
  await counter.click(page.getByRole("button", { name: "Descargar", exact: true }));
  const dialog = page.getByRole("dialog", { name: "Descargar" });
  // Por defecto: PDF, hoja del estudiante y clave.
  await expect(dialog.getByRole("radio", { name: /PDF/ })).toHaveAttribute("aria-checked", "true");
  await counter.click(dialog.getByRole("radio", { name: "2 versiones" }));
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    counter.click(dialog.getByRole("button", { name: "Descargar 4 archivos (.zip)" })),
  ]);
  expect(counter.count).toBeLessThanOrEqual(3);
  expect(file.suggestedFilename()).toBe("Quiz - La recta numérica - 6°601.zip");
  const zip = await JSZip.loadAsync(readFileSync((await file.path())!));
  expect(Object.keys(zip.files).sort()).toEqual([
    "Clave - Quiz - La recta numérica - 6°601 - Versión B.pdf",
    "Clave - Quiz - La recta numérica - 6°601.pdf",
    "Quiz - La recta numérica - 6°601 - Versión B.pdf",
    "Quiz - La recta numérica - 6°601.pdf",
  ]);
  expect(Date.now() - started).toBeLessThan(30_000);
});

test("CA-0013-15/16: el borrador se avisa antes de descargar y el paquete ajeno responde 404", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await generatedQuiz(page);
  await page.getByRole("button", { name: "Descargar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Descargar" });
  await expect(dialog.getByRole("note")).toContainText("BORRADOR");
  await expect(
    dialog.getByRole("button", { name: "Descargar con marca de borrador" }),
  ).toBeVisible();
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Marcar como listo y descargar" }).click(),
  ]);
  expect(file.suggestedFilename()).toMatch(/\.zip$/);
  await expect(page.getByText("Listo", { exact: true })).toBeVisible();

  // CA-0013-16: otro docente no puede bajar el paquete por URL.
  const url = `${new URL(page.url()).pathname}/export/bundle?docs=student,key&format=pdf&variants=2`;
  const other = await newDeviceContext(browser);
  const otherPage = await other.newPage();
  await signUpIndependentTeacher(otherPage, "Luis Mora");
  const response = await otherPage.request.get(url);
  expect(response.status()).toBe(404);
  await other.close();
});

test("CA-0013-19: Inicio, Mis recursos, asistente, recurso y planeación se hidratan sin diferencias", async ({
  page,
}) => {
  test.setTimeout(180_000);
  // La guardia automática de fixtures.ts también lo verifica en cada prueba; aquí queda explícito,
  // con recursos y fechas en pantalla (lo que causó la "página de error" de F-11).
  const errors: string[] = [];
  const hydration = /Hydration failed|hydration mismatch|Minified React error #(418|423|425)/i;
  page.on("console", (m) => {
    if (m.type() === "error" && hydration.test(m.text())) errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => {
    if (hydration.test(e.message)) errors.push(e.message.slice(0, 200));
  });
  const { questions } = await generatedQuiz(page);
  await expect(questions.first()).toBeVisible();
  const resourceUrl = page.url();
  for (const path of ["/dashboard", "/resources", "/create?type=QUIZ", resourceUrl, "/courses"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  await page
    .getByRole("link", { name: /Matemáticas · 6° · 601/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
