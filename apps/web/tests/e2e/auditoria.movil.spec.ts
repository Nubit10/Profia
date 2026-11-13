import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher, signUpSchoolAdmin } from "./helpers";

// Auditoría móvil: cada pantalla de Profe, a 360 px (el teléfono más angosto que soportamos), sin
// scroll horizontal ni nada que se salga del borde. Con AUDIT_SHOTS=<carpeta> deja una captura de
// cada pantalla para revisarla a ojo.

const SHOTS = process.env.AUDIT_SHOTS ?? null;
const WIDTH = 360;

/**
 * Elementos visibles que se salen por la derecha o la izquierda de la pantalla. No cuentan los que
 * viven dentro de una fila que se desliza a propósito (overflow-x auto o scroll), ni los que están
 * fuera de la vista porque una capa los oculta (aria-hidden, inert, visibility).
 */
async function offenders(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollsX = (el: Element | null): boolean => {
      for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (["auto", "scroll"].includes(s.overflowX) && p.scrollWidth > p.clientWidth) return true;
        if (s.overflowX === "hidden" || s.overflowX === "clip") return true;
      }
      return false;
    };
    const out: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el.closest("[aria-hidden=true],[inert],script,style,svg *")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "contents") continue;
      if ((r.right > vw + 1 || r.left < -1) && !scrollsX(el)) {
        const name = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${String(el.className).split(" ").slice(0, 3).join(".")}`;
        out.push(
          `${name} [${Math.round(r.left)}→${Math.round(r.right)}] «${(el.textContent ?? "").trim().slice(0, 40)}»`,
        );
      }
    }
    return out.slice(0, 10);
  });
}

async function check(page: Page, name: string) {
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name}: scroll horizontal`).toBeLessThanOrEqual(0);
  expect(await offenders(page), `${name}: elementos fuera de la pantalla`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("móvil: pantallas públicas a 360 px", async ({ page }) => {
  for (const [name, path] of [
    ["publica-inicio", "/"],
    ["publica-login", "/login"],
    ["publica-registro", "/register"],
  ] as const) {
    await page.goto(path);
    await check(page, name);
  }
});

test("móvil: el docente, pantalla por pantalla, a 360 px", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/register");
  await check(page, "registro");
  await signUpIndependentTeacher(page);
  await check(page, "inicio-primeros-pasos");

  // Menú lateral.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("dialog", { name: "Menú" })).toBeVisible();
  await check(page, "menu-lateral");
  await page.keyboard.press("Escape");

  // Curso nuevo.
  await page
    .getByTestId("first-steps")
    .getByRole("button", { name: "Crear mi primer curso" })
    .click();
  await check(page, "dialogo-curso");
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await check(page, "inicio-con-curso");
  await page.goto("/courses");
  await check(page, "mis-cursos");
  await page
    .getByRole("link", { name: /Matemáticas · 6° · 601/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Periodo 1", exact: true })).toBeVisible();
  const courseUrl = page.url().split("?")[0]!;
  await check(page, "curso-planeacion-vacia");

  // Propuesta de la IA, planeación con temas, objetivos en bloque y ficha de DBA.
  await page.getByRole("button", { name: "Proponer temas con IA para Periodo 1" }).click();
  await expect(page.getByRole("button", { name: /Agregar a la planeación/ })).toBeEnabled();
  await check(page, "propuesta");
  await page.getByRole("button", { name: /Agregar a la planeación/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await check(page, "curso-planeacion");
  const unit = page
    .getByRole("list", { name: "Unidades de Periodo 1" })
    .locator(":scope > li")
    .first();
  await unit.getByRole("button", { name: /^Opciones de unidad/ }).click();
  await check(page, "menu-unidad");
  await page.getByRole("menuitem", { name: "Proponer objetivos" }).click();
  await expect(page.getByRole("button", { name: /^Aceptar todos/ })).toBeVisible();
  await check(page, "objetivos-en-bloque");
  await page.getByRole("button", { name: /^Aceptar todos/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: /^DBA \d+: ver enunciado/ })
    .first()
    .click();
  await check(page, "ficha-dba");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Agregar objetivo" }).first().click();
  await check(page, "dialogo-objetivo");
  await page.keyboard.press("Escape");

  // Asistente: cada paso.
  await page.goto("/create");
  await check(page, "crear-que");
  await page.goto(`/create?type=WORKSHOP&courseId=${courseUrl.split("/").pop()}&elegir=1`);
  await check(page, "crear-curso-y-tema");
  await page.getByRole("link", { name: /^Tema 1 del periodo 1/ }).click();
  await expect(page.getByRole("button", { name: "Generar taller" })).toBeVisible();
  await check(page, "crear-ajustes-taller");
  await page.getByRole("button", { name: "Generar taller" }).click();
  await expect(page.getByRole("list", { name: /Actividades|Momentos/ }).first()).toBeVisible({
    timeout: 30_000,
  });
  await check(page, "recurso-taller");

  // Quiz con un toque y examen de la unidad.
  await page.goto(courseUrl);
  const firstTopic = (await unit.getByRole("heading", { level: 3 }).first().textContent())!;
  await page.getByRole("button", { name: `Crear quiz de «${firstTopic}»` }).click();
  await expect(page.getByRole("list", { name: "Preguntas" })).toBeVisible({ timeout: 30_000 });
  await check(page, "recurso-quiz");
  await page.getByRole("button", { name: "Descargar", exact: true }).click();
  await check(page, "dialogo-descargar");
  await page.keyboard.press("Escape");
  await page.goto(courseUrl);
  await unit.getByRole("button", { name: /^Opciones de unidad/ }).click();
  await page.getByRole("menuitem", { name: "Crear examen de esta unidad" }).click();
  await expect(page).toHaveURL(/\/resources\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Examen");
  await page.waitForTimeout(1500);
  await check(page, "recurso-examen");

  await page.goto(`${courseUrl}?tab=recursos`);
  await check(page, "curso-recursos");
  await page.goto(`${courseUrl}?tab=referentes`);
  await check(page, "curso-dba");
  await page.goto("/create?type=EXAM");
  await check(page, "crear-examen-temas");

  for (const [name, path] of [
    ["mis-recursos", "/resources"],
    ["formatos", "/formats"],
    ["asignaturas", "/subjects"],
    ["notificaciones", "/notifications"],
    ["sin-conexion", "/offline"],
  ] as const) {
    await page.goto(path);
    await check(page, name);
  }
});

test("móvil: el colegio a 360 px", async ({ page }) => {
  await signUpSchoolAdmin(page);
  await check(page, "colegio-inicio");
  for (const [name, path] of [
    ["colegio", "/school"],
    ["colegio-miembros", "/school/members"],
  ] as const) {
    await page.goto(path);
    await check(page, name);
  }
});
