import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0013 RN-11: Profe en el celular (proyecto "movil": iPhone 13, 390 × 844, táctil).

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

/** Docente con curso, tema y un quiz generado; deja abierta la página del quiz. */
async function quizOnPhone(page: Page) {
  await signUpIndependentTeacher(page);
  await createCourse(page);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.getByRole("button", { name: "Generar quiz" }).click();
  const questions = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li");
  await expect(questions.first()).toBeVisible({ timeout: 30_000 });
  return questions;
}

/**
 * Controles táctiles visibles de menos de 44 × 44 px. No cuentan los enlaces dentro de un párrafo
 * ni los checkbox, cuya zona táctil la amplía un pseudo-elemento (`after:-inset-*`).
 */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const viewport = window.innerHeight;
    // `[data-floating]` de este archivo y los checkbox quedan fuera; ver el comentario de arriba.
    const selector =
      "a[href], button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role=button], [role=menuitem], [role=radio], [role=combobox], [role=tab]";
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        if (box.width < 2 || box.height < 2 || box.bottom < 0 || box.top > viewport) return false;
        if (el.closest(".sr-only, [aria-hidden=true], [inert]")) return false;
        if (el.matches("a") && el.closest("p, li > p, label")) return false;
        // Enlace que cubre toda su tarjeta con `after:absolute after:inset-0`: se toca la tarjeta.
        if (getComputedStyle(el, "::after").position === "absolute") {
          const card = el.offsetParent?.getBoundingClientRect();
          if (card && card.width >= 44 && card.height >= 44) return false;
        }
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") return false;
        return box.width < 44 || box.height < 44;
      })
      .map((el) => {
        const box = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim();
        return `${name.slice(0, 30)} ${Math.round(box.width)}×${Math.round(box.height)}`;
      });
  });
}

/** Elementos flotantes visibles (`data-floating`) que se tapan entre sí. */
async function floatingOverlaps(page: Page) {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll<HTMLElement>("[data-floating]")]
      .map((el) => ({ name: el.dataset.floating!, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0);
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!.box;
        const b = boxes[j]!.box;
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
          overlaps.push(`${boxes[i]!.name} / ${boxes[j]!.name}`);
        }
      }
    }
    return overlaps;
  });
}

test("CA-0013-22/23: los formularios suben desde abajo y Atrás los cierra sin salir de la página", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  const viewport = page.viewportSize()!;

  // CA-0013-23: "Nuevo curso" pegado abajo, con su botón a la vista.
  await page
    .getByTestId("first-steps")
    .getByRole("button", { name: "Crear mi primer curso" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(2);
  await expect(dialog.getByRole("button", { name: "Crear curso" })).toBeInViewport();

  // CA-0013-22: Atrás cierra el formulario y la URL no cambia.
  const url = page.url();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(page.getByRole("heading", { name: /^Hola,/ })).toBeVisible();

  // El menú lateral (cajón) también se cierra con Atrás.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  const nav = page.getByRole("navigation", { name: "Menú principal" });
  await expect(nav).toBeVisible();
  await page.goBack();
  await expect(nav).toBeHidden();
  expect(page.url()).toBe(url);

  // Con el curso, la planeación: unidad, tema y objetivo también suben desde abajo.
  await createCourse(page);
  await page.goto("/courses");
  await page
    .getByRole("link", { name: /Matemáticas · 6° · 601/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Nueva unidad" }).click();
  await expect(dialog.getByRole("button", { name: "Crear unidad" })).toBeInViewport();
  await page.getByLabel("Título de la unidad").fill("Números enteros");
  await dialog.getByRole("button", { name: "Crear unidad" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar tema" }).click();
  await expect(dialog.getByRole("button", { name: "Crear tema" })).toBeInViewport();
  await page.getByLabel("Título del tema").fill("La recta numérica");
  await dialog.getByRole("button", { name: "Crear tema" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar objetivo" }).click();
  const objective = (await dialog.boundingBox())!;
  expect(Math.abs(objective.y + objective.height - viewport.height)).toBeLessThanOrEqual(2);
  await expect(dialog.getByRole("button", { name: "Crear objetivo" })).toBeInViewport();
  const planningUrl = page.url();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(planningUrl);

  // El menú "⋯" de la unidad se cierra con Atrás.
  await page.getByRole("button", { name: "Opciones de unidad «Números enteros»" }).click();
  await expect(page.getByRole("menuitem", { name: /Editar unidad/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("menuitem", { name: /Editar unidad/ })).toHaveCount(0);
  expect(page.url()).toBe(planningUrl);
});

test("CA-0013-24/25: controles de 44 px y encabezado del curso que cabe en 390 px", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await quizOnPhone(page);
  const resourceUrl = page.url();

  const screens: [string, string][] = [
    ["inicio", "/dashboard"],
    ["mis cursos", "/courses"],
    ["mis recursos", "/resources"],
    ["formatos", "/formats"],
    ["asistente", "/create?type=QUIZ"],
    ["recurso", resourceUrl],
  ];
  for (const [name, path] of screens) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    expect(await smallTargets(page), `${name}: controles de menos de 44 px`).toEqual([]);
  }

  await page.goto("/courses");
  await page
    .getByRole("link", { name: /Matemáticas · 6° · 601/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await smallTargets(page), "curso: controles de menos de 44 px").toEqual([]);

  // CA-0013-25: el título en 2 líneas o menos y las 3 pestañas completas a la vista.
  // Líneas reales del texto: cuántas alturas distintas tienen sus rectángulos.
  const lines = await page.getByRole("heading", { level: 1 }).evaluate((h) => {
    const range = document.createRange();
    range.selectNodeContents(h);
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
  });
  expect(lines).toBeLessThanOrEqual(2);
  const tabs = page.getByRole("navigation", { name: "Secciones del curso" }).getByRole("link");
  await expect(tabs).toHaveCount(3);
  for (const tab of await tabs.all()) await expect(tab).toBeInViewport({ ratio: 1 });
});

test("CA-0013-17/18/26: recurso con barra fija abajo, vista compacta y nada flotante encimado", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const questions = await quizOnPhone(page);
  await page.reload();
  const viewport = page.viewportSize()!;

  // CA-0013-18: "Descargar" en la barra fija de abajo y la primera pregunta sin hacer scroll.
  const bar = page.locator('[data-floating="bottom-bar"]');
  const barBox = (await bar.boundingBox())!;
  expect(Math.abs(barBox.y + barBox.height - viewport.height)).toBeLessThanOrEqual(2);
  await expect(bar.getByRole("button", { name: "Descargar", exact: true })).toBeVisible();
  const first = (await questions.first().boundingBox())!;
  expect(first.y).toBeLessThan(barBox.y);

  // CA-0013-26: ningún elemento flotante tapa a otro.
  expect(await floatingOverlaps(page)).toEqual([]);

  // CA-0013-17: la vista compacta mide la mitad o menos y conserva la numeración.
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.getByRole("button", { name: "Vista compacta" }).click();
  const compact = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(compact).toBeLessThanOrEqual(full / 2);
  await expect(questions.first().getByRole("heading", { name: "Pregunta 1" })).toBeVisible();
  await expect(questions.nth(1).getByRole("heading", { name: "Pregunta 2" })).toBeVisible();
  await page.getByRole("button", { name: "Vista completa" }).click();
});

test("CA-0013-27: con mala señal, al tocar un enlace se ve enseguida la pantalla de carga", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  // Las respuestas de navegación (RSC) tardan 2 s, como con mala señal.
  await page.route("**/*", async (route) => {
    if (route.request().headers()["rsc"]) await new Promise((r) => setTimeout(r, 2_000));
    await route.continue();
  });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("link", { name: "Mis recursos" }).click();
  // Se ve enseguida: el enlace tocado indica que carga (o ya aparece el esqueleto de la pantalla).
  await expect(
    page.getByTestId("link-pending").or(page.getByTestId("page-skeleton")).first(),
  ).toBeVisible({ timeout: 500 });
  await expect(page).toHaveURL(/\/resources$/, { timeout: 15_000 });
});
