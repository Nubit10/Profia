import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0014 parte 1: la IA propone la planeación a partir de los DBA (AI Engine con el LLM de
// prueba, que además devuelve un código de DBA inventado en cada periodo).

async function openNewCourse(page: Page, subject = "Matemáticas", group = "601") {
  await page
    .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
    .first()
    .click();
  await choose(page, "Asignatura", subject);
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill(group);
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: `${subject} · 6° · ${group}` }).click();
  await expect(page.getByRole("heading", { name: "Periodo 1", exact: true })).toBeVisible();
}

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

const unitsOf = (page: Page, period: string) =>
  page.getByRole("list", { name: `Unidades de ${period}` });

test("CA-0014-01/02: proponer el periodo 1 y agregarlo en 3 clics, sin escribir", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const user = clickCounter();

  await user.click(page.getByRole("button", { name: "Proponer temas con IA", exact: true }));
  await user.click(page.getByRole("dialog").getByRole("button", { name: /^Periodo 1/ }));
  const dialog = page.getByRole("dialog");
  const add = dialog.getByRole("button", { name: /Agregar a la planeación \(\d+\)/ });
  await expect(add).toBeEnabled();

  // CA-0014-02: cada tema muestra DBA del curso y el código inventado no aparece (el tema que
  // queda sin ninguno, "Sin DBA", se prueba en integración).
  await expect(dialog.getByText("Sin DBA")).toHaveCount(0);
  await expect(dialog.getByText(/^DBA \d+$/).first()).toBeVisible();
  await expect(dialog).not.toContainText("INVENTADO");

  await user.click(add);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(user.count).toBeLessThanOrEqual(4);

  const units = unitsOf(page, "Periodo 1");
  await expect(units.locator(":scope > li")).toHaveCount(2);
  await expect(units.getByRole("heading", { level: 3 })).toHaveCount(4);
  await expect(page.getByText("Cobertura de DBA: 3 de 12")).toBeVisible();
});

test("CA-0014-03: se guarda exactamente lo que quedó en la revisión; cerrar no guarda", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);

  // Cerrar sin agregar no guarda nada.
  await page.getByRole("button", { name: "Proponer temas con IA para Periodo 2" }).click();
  await expect(page.getByRole("button", { name: /Agregar a la planeación/ })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(unitsOf(page, "Periodo 2")).toHaveCount(0);

  await page.getByRole("button", { name: "Proponer temas con IA para Periodo 1" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Más temas" }).click();
  const add = dialog.getByRole("button", { name: /Agregar a la planeación/ });
  await expect(add).toBeEnabled();
  const unitTitles = dialog.getByRole("textbox", { name: "Título de la unidad" });
  await expect(unitTitles).toHaveCount(3);

  // Cambia el título de la primera, quita la segunda y pide otra propuesta para la tercera.
  await unitTitles.nth(0).fill("Números enteros");
  const second = await unitTitles.nth(1).inputValue();
  await dialog.getByRole("checkbox", { name: `Incluir la unidad «${second}»` }).click();
  const third = await unitTitles.nth(2).inputValue();
  await dialog.getByRole("button", { name: `Otra propuesta para «${third}»` }).click();
  await expect(dialog.locator("[aria-busy=true]")).toHaveCount(0);
  const replaced = await unitTitles.nth(2).inputValue();
  // Quita también un tema de la primera unidad.
  const firstTopic = dialog.getByRole("textbox", { name: "Título del tema" }).first();
  const removedTopic = await firstTopic.inputValue();
  await dialog.getByRole("checkbox", { name: `Incluir el tema «${removedTopic}»` }).click();

  const expected = Number(/\((\d+)\)/.exec((await add.textContent()) ?? "")![1]);
  await add.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const units = unitsOf(page, "Periodo 1");
  await expect(units.locator(":scope > li")).toHaveCount(2);
  await expect(units).toContainText("Números enteros");
  await expect(units).toContainText(replaced);
  await expect(units).not.toContainText(second);
  await expect(units).not.toContainText(removedTopic);
  await expect(units.getByRole("heading", { level: 3 })).toHaveCount(expected);
});

test("CA-0014-05: el año completo cubre los 12 DBA de 6°", async ({ page }) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  await page.getByRole("button", { name: "Proponer el año con IA" }).click();
  await page.getByRole("button", { name: /Agregar a la planeación/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const n of [1, 2, 3, 4]) {
    await expect(unitsOf(page, `Periodo ${n}`).locator(":scope > li")).not.toHaveCount(0);
  }
  await expect(page.getByText("Cobertura de DBA: 12 de 12")).toBeVisible();
});

test("CA-0014-04/06: proponer temas de una unidad que ya existe, sin tocar lo que tenía", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await page.getByLabel("Título de la unidad").fill("Números enteros");
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await page.getByLabel("Título del tema").fill("La recta numérica");
  await page.getByRole("button", { name: "Crear tema" }).click();
  await expect(page.getByRole("heading", { name: "La recta numérica" })).toBeVisible();

  await page.getByRole("button", { name: "Opciones de unidad «Números enteros»" }).click();
  await page.getByRole("menuitem", { name: "Proponer temas" }).click();
  const dialog = page.getByRole("dialog");
  const topics = dialog.getByRole("textbox", { name: "Título del tema" });
  await expect(topics).not.toHaveCount(0);
  const count = await topics.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(4);
  await dialog.getByRole("button", { name: `Agregar a la planeación (${count})` }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const unit = unitsOf(page, "Periodo 1").locator(":scope > li");
  await expect(unit).toHaveCount(1);
  const titles = unit.getByRole("heading", { level: 3 });
  await expect(titles).toHaveCount(count + 1);
  await expect(titles.first()).toHaveText("La recta numérica");
});

test("CA-0014-07: una asignatura sin DBA en el catálogo no ofrece la propuesta y explica por qué", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page, "Ciencias Naturales y Educación Ambiental");
  await expect(page.getByRole("button", { name: /Proponer .* con IA/ })).toHaveCount(0);
  await expect(page.getByText(/no tiene DBA en el catálogo/)).toBeVisible();
});

test("CA-0014-22 (parte 1): la revisión de la propuesta es accesible y cabe en 360 px", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 780 });
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  await page.getByRole("button", { name: "Proponer temas con IA para Periodo 1" }).click();
  await expect(page.getByRole("button", { name: /Agregar a la planeación/ })).toBeEnabled();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  // Atrás cierra la revisión sin salir de la planeación (SPEC-0013) y no guarda nada.
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Periodo 1", exact: true })).toBeVisible();
  await expect(unitsOf(page, "Periodo 1")).toHaveCount(0);
});

/** Periodo 1 con 3 unidades de 3 temas, propuesto con IA ("Más temas") y agregado. */
async function plannedPeriod(page: Page) {
  await page.getByRole("button", { name: "Proponer temas con IA para Periodo 1" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Más temas" }).click();
  await expect(dialog.getByRole("textbox", { name: "Título de la unidad" })).toHaveCount(3);
  await dialog.getByRole("button", { name: /Agregar a la planeación/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const first = unitsOf(page, "Periodo 1").locator(":scope > li").first();
  await expect(first.getByRole("heading", { level: 3 })).toHaveCount(3);
  return first;
}

test("CA-0014-08: objetivos para los 3 temas de una unidad en 3 clics", async ({ page }) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const unit = await plannedPeriod(page);
  const user = clickCounter();

  await user.click(unit.getByRole("button", { name: /^Opciones de unidad/ }));
  await user.click(page.getByRole("menuitem", { name: "Proponer objetivos" }));
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("region", { name: /^Objetivos propuestos para/ })).toHaveCount(3);
  await expect(dialog.getByText(/^DBA \d+$/).first()).toBeVisible();
  await user.click(dialog.getByRole("button", { name: "Aceptar todos (9)" }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(user.count).toBeLessThanOrEqual(3);

  for (const topic of await unit.getByRole("list", { name: /^Objetivos de / }).all()) {
    await expect(topic.locator(":scope > li")).toHaveCount(3);
    await expect(topic.getByRole("list", { name: "DBA vinculados" })).toHaveCount(3);
  }
});

test("CA-0014-09: desmarcar uno y editar otro guarda solo lo marcado, con el texto editado", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const unit = await plannedPeriod(page);
  await unit.getByRole("button", { name: /^Opciones de unidad/ }).click();
  await page.getByRole("menuitem", { name: "Proponer objetivos" }).click();
  const dialog = page.getByRole("dialog");
  const texts = dialog.getByRole("textbox", { name: /^Objetivo \d de «/ });
  await expect(texts).toHaveCount(9);
  await texts.nth(0).fill("Ubica números enteros en la recta numérica con ejemplos del barrio.");
  const second = await texts.nth(1).inputValue();
  await dialog
    .getByRole("checkbox", { name: /^Incluir el objetivo 2 de «/ })
    .first()
    .click();
  await dialog.getByRole("button", { name: "Aceptar (8)" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    unit.getByText("Ubica números enteros en la recta numérica con ejemplos del barrio."),
  ).toBeVisible();
  await expect(unit.getByText(second, { exact: true })).toHaveCount(0);
  await expect(
    unit.getByRole("list", { name: /^Objetivos de / }).locator(":scope > li"),
  ).toHaveCount(8);
});

test("CA-0014-10/12: 'Crear quiz' en un tema genera en 1 clic y llega al recurso; 'Ajustar antes' abre el asistente", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const unit = await plannedPeriod(page);
  const topic = await unit.getByRole("heading", { level: 3 }).first().textContent();

  await page.getByRole("button", { name: `Opciones de tema «${topic}»` }).click();
  await page.getByRole("menuitem", { name: "Ajustar antes de crear" }).click();
  await expect(page).toHaveURL(/\/create\?courseId=.*&topicId=/);
  await expect(page.getByRole("heading", { name: "¿Qué quieres crear?" })).toBeVisible();
  await page.goBack();

  await page.getByRole("button", { name: `Crear quiz de «${topic}»` }).click();
  await expect(page).toHaveURL(/\/resources\//);
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible({ timeout: 30_000 });
  // 6° usa 8 preguntas por defecto (SPEC-0008).
  await expect(page.getByRole("list", { name: "Preguntas" }).locator(":scope > li")).toHaveCount(8);

  // CA-0014-12: la etiqueta de DBA de una pregunta abre su ficha sin salir del recurso.
  await page
    .getByRole("button", { name: /^DBA \d+: ver enunciado/ })
    .first()
    .click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Fuente" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/resources\//);
});

test("CA-0014-11: 'Crear examen de esta unidad' genera con todos sus temas en un toque", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const unit = await plannedPeriod(page);
  const title = (await unit.getByRole("heading", { level: 3 }).allTextContents()).sort();
  const unitTitle = await unit.locator("[data-slot=card-title]").textContent();
  await unit.getByRole("button", { name: /^Opciones de unidad/ }).click();
  await page.getByRole("menuitem", { name: "Crear examen de esta unidad" }).click();
  await expect(page).toHaveURL(/\/resources\//);
  await expect(page.getByRole("heading", { name: `Examen: ${unitTitle}` })).toBeVisible({
    timeout: 60_000,
  });
  for (const t of title) await expect(page.getByRole("main")).toContainText(t);
});

test("CA-0014-12/13: los DBA del tema se ven en la planeación y abren su ficha con clic o teclado", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const unit = await plannedPeriod(page);
  const topic = await unit.getByRole("heading", { level: 3 }).first().textContent();

  // CA-0014-13: los DBA están en el tema, aunque todavía no tenga objetivos.
  const chips = unit.getByRole("list", { name: `DBA de ${topic}` }).getByRole("button");
  await expect(chips.first()).toBeVisible();
  const name = (await chips.first().getAttribute("aria-label"))!;
  const number = /^DBA (\d+)/.exec(name)![1];

  // Clic: número, enunciado, evidencias y fuente (documento del MEN, versión y página).
  await chips.first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: `DBA ${number}` })).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Evidencias de aprendizaje" })).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Fuente" })).toBeVisible();
  await expect(sheet).toContainText(/pág\. \d+/);
  await expect(sheet.getByRole("link", { name: /Abrir el documento del MEN/ })).toHaveAttribute(
    "href",
    /#page=\d+$/,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Teclado y Atrás: se abre con Enter y Atrás la cierra sin salir de la planeación.
  await chips.first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Periodo 1", exact: true })).toBeVisible();
});

test("CA-0014-22 (parte 3): la ficha de DBA es accesible y cabe en 360 px", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 780 });
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const unit = await plannedPeriod(page);
  await unit
    .getByRole("button", { name: /^DBA \d+: ver enunciado/ })
    .first()
    .click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Fuente" })).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("CA-0014-14/15/16: 'Recursos del curso' agrupa Periodo · Unidad · Tema y ofrece crear en los temas vacíos", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const unit = await plannedPeriod(page);
  const unitTitle = (await unit.locator("[data-slot=card-title]").textContent())!;
  const [first, second] = await unit.getByRole("heading", { level: 3 }).allTextContents();
  const courseUrl = page.url();

  // Un quiz en el primer tema y el examen de la unidad, con un toque desde la planeación.
  await page.getByRole("button", { name: `Crear quiz de «${first}»` }).click();
  await expect(page).toHaveURL(/\/resources\//);
  await page.goto(courseUrl);
  await unit.getByRole("button", { name: /^Opciones de unidad/ }).click();
  await page.getByRole("menuitem", { name: "Crear examen de esta unidad" }).click();
  await expect(page).toHaveURL(/\/resources\//);

  await page.goto(`${courseUrl.split("?")[0]}?tab=recursos`);
  const firstGroup = page.getByRole("region", { name: `Periodo 1 · ${unitTitle} · ${first}` });
  await expect(firstGroup.getByRole("link")).toHaveCount(1);
  await expect(firstGroup).toContainText("Quiz");
  // CA-0014-16: el examen va en "Exámenes" de su unidad.
  await expect(
    page.getByRole("region", { name: `Periodo 1 · ${unitTitle} · Exámenes` }).getByRole("link"),
  ).toHaveCount(1);
  // CA-0014-14: los encabezados siguen el orden de la planeación.
  const names = await page
    .getByRole("region", { name: /^Periodo 1 · / })
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(names.slice(0, 3)).toEqual([
    `Periodo 1 · ${unitTitle} · ${first}`,
    `Periodo 1 · ${unitTitle} · ${second}`,
    expect.stringContaining(`Periodo 1 · ${unitTitle} · `),
  ]);

  // CA-0014-15: un tema sin recursos ofrece crearlos con un toque.
  const secondGroup = page.getByRole("region", { name: `Periodo 1 · ${unitTitle} · ${second}` });
  await expect(secondGroup).toContainText("Este tema aún no tiene recursos.");
  await secondGroup.getByRole("button", { name: `Crear taller de «${second}»` }).click();
  await expect(page).toHaveURL(/\/resources\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(second!);
});

test("CA-0014-17/18: 'Mis recursos' muestra los recientes y cada curso por periodo y tema, con periodos plegables", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const unit = await plannedPeriod(page);
  const unitTitle = (await unit.locator("[data-slot=card-title]").textContent())!;
  const [first] = await unit.getByRole("heading", { level: 3 }).allTextContents();
  await page.getByRole("button", { name: `Crear quiz de «${first}»` }).click();
  await expect(page).toHaveURL(/\/resources\//);
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/resources");
  await expect(page.getByRole("heading", { name: "Recientes" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Recursos recientes" }).getByRole("link"),
  ).toHaveCount(1);
  const course = page.getByRole("region", { name: "Matemáticas · 6° · 601" });
  const topic = course.getByRole("region", { name: `Periodo 1 · ${unitTitle} · ${first}` });
  await expect(topic.getByRole("link")).toHaveCount(1);

  // CA-0014-18: el periodo se pliega y se vuelve a abrir.
  const summary = course.locator("summary", { hasText: "Periodo 1" });
  await summary.click();
  await expect(topic).toBeHidden();
  await summary.click();
  await expect(topic).toBeVisible();

  // Los filtros de SPEC-0012 siguen: sin talleres, no queda nada.
  await page
    .getByRole("navigation", { name: "Filtrar por tipo" })
    .getByRole("link", { name: "Talleres" })
    .click();
  await expect(page.getByText("No hay recursos con estos filtros")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Filtrar por tipo" })
    .getByRole("link", { name: "Quices" })
    .click();
  await expect(
    page.getByRole("region", { name: `Periodo 1 · ${unitTitle} · ${first}` }),
  ).toBeVisible();
});

test("CA-0014-22 (parte 4): los recursos agrupados son accesibles y caben en 360 px", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 780 });
  await signUpIndependentTeacher(page);
  await openNewCourse(page);
  const unit = await plannedPeriod(page);
  const [first] = await unit.getByRole("heading", { level: 3 }).allTextContents();
  await page.getByRole("button", { name: `Crear quiz de «${first}»` }).click();
  await expect(page).toHaveURL(/\/resources\//);
  const courseUrl = page.url().split("/resources/")[0]!;
  for (const url of [`${courseUrl}?tab=recursos`, "/resources"]) {
    await page.goto(url);
    await expect(page.getByRole("region", { name: new RegExp(`· ${first}$`) })).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
