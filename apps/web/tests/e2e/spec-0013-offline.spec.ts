import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, logout, signUpIndependentTeacher } from "./helpers";

// SPEC-0013 RN-14: todos los recursos generados, disponibles sin conexión en este dispositivo.

async function serviceWorkerReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
    }
  });
}

/** Lo guardado en el dispositivo: recurso → versión (IndexedDB) y cachés de la biblioteca. */
async function savedOnDevice(page: Page) {
  return page.evaluate(async () => {
    const caches_ = (await caches.keys()).filter((k) => k.startsWith("profe-offline-"));
    const dbs = (await indexedDB.databases()).map((d) => d.name);
    if (!dbs.includes("profe-offline")) return { caches: caches_, entries: {} };
    const entries = await new Promise<Record<string, number>>((resolve, reject) => {
      const open = indexedDB.open("profe-offline", 1);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("entries")) return resolve({});
        const all = db.transaction("entries").objectStore("entries").getAll();
        all.onsuccess = () => {
          const out: Record<string, number> = {};
          for (const e of all.result as { title: string; version: number }[])
            out[e.title] = e.version;
          db.close();
          resolve(out);
        };
        all.onerror = () => reject(all.error);
      };
      open.onerror = () => reject(open.error);
    });
    return { caches: caches_, entries };
  });
}

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

/** Genera un recurso (la IA de prueba responde al instante) y vuelve con su URL. */
async function generate(page: Page, type: "QUIZ" | "WORKSHOP") {
  await page.goto(`/create?type=${type}`);
  await page.getByRole("button", { name: /^Generar/ }).click();
  await expect(page).toHaveURL(/\/resources\/[a-z0-9]+$/);
  await expect(page.getByRole("button", { name: "Descargar", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  return page.url();
}

test("CA-0013-37/38/39/41: se guardan al aceptar, se descargan sin red y se mantienen al día", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await signUpIndependentTeacher(page);
  await createCourse(page);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar quiz" })).toBeVisible();
  const quizUrl = await generate(page, "QUIZ");
  const workshopUrl = await generate(page, "WORKSHOP");
  await serviceWorkerReady(page);

  // CA-0013-41: en el navegador pregunta una vez y no guarda nada hasta que se acepta.
  await page.goto("/resources");
  const panel = page.getByTestId("offline-panel");
  await expect(panel).toContainText("¿Guardar tus recursos en este dispositivo");
  await page.waitForTimeout(1_000);
  expect(await savedOnDevice(page)).toEqual({ caches: [], entries: {} });

  // CA-0013-37: al aceptar, en menos de 60 s cada recurso queda "Disponible sin conexión".
  await panel.getByRole("button", { name: "Guardar en este dispositivo" }).click();
  const list = page.getByRole("list", { name: "Mis recursos" });
  await expect(list.getByTestId("offline-ready")).toHaveCount(2, { timeout: 60_000 });
  await expect(page.getByTestId("offline-panel")).toContainText("guardados 2 de 2");
  await page.reload();
  await expect(page.getByTestId("offline-panel")).not.toContainText("¿Guardar tus recursos");

  // CA-0013-38: sin red, "Sin conexión" lista los recursos y entrega los archivos del dispositivo.
  await context.setOffline(true);
  await page.goto("/resources").catch(() => null);
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();
  const saved = page.getByRole("region", { name: "Guardados en este dispositivo" });
  await expect(saved).toContainText("Quiz");
  await expect(saved).toContainText("Taller");
  const quiz = saved.getByRole("listitem").filter({ hasText: "Quiz" });
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    quiz.getByRole("button", { name: "Clave en Word" }).click(),
  ]);
  expect(file.suggestedFilename()).toMatch(/^Clave - Quiz - .+ - 6°601\.docx$/);
  await context.setOffline(false);

  // CA-0013-39: editar guarda la versión 2 y se actualiza; archivar lo quita del dispositivo.
  await page.goto(quizUrl);
  const first = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li").first();
  await first.getByRole("button", { name: "Editar" }).click();
  await first.getByLabel("Enunciado").fill("¿Qué número está más a la izquierda?");
  await first.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByText(/Versión 2/).first()).toBeVisible();
  await expect
    .poll(async () => Object.values((await savedOnDevice(page)).entries).sort(), {
      timeout: 30_000,
    })
    .toEqual([1, 2]);

  await page.goto(workshopUrl);
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Archivar" }).click();
  await expect(page.getByText("Este recurso está archivado")).toBeVisible();
  await expect
    .poll(async () => Object.keys((await savedOnDevice(page)).entries).length, { timeout: 30_000 })
    .toBe(1);
});

test("CA-0013-40/41: cerrar sesión borra lo guardado y otra cuenta no ve nada; la app instalada guarda sola", async ({
  page,
}) => {
  test.setTimeout(180_000);
  // Abierta como app instalada: guarda sin preguntar (CA-0013-41).
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes("display-mode: standalone")
        ? ({ ...original(query), matches: true, media: query } as MediaQueryList)
        : original(query);
  });
  await signUpIndependentTeacher(page);
  await createCourse(page);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar quiz" })).toBeVisible();
  await generate(page, "QUIZ");
  await page.goto("/resources");
  await expect(page.getByTestId("offline-panel")).not.toContainText("¿Guardar tus recursos");
  await expect(
    page.getByRole("list", { name: "Mis recursos" }).getByTestId("offline-ready"),
  ).toHaveCount(1, { timeout: 60_000 });
  expect((await savedOnDevice(page)).caches).toHaveLength(1);

  // CA-0013-40: al cerrar sesión no queda nada, y otra cuenta en el mismo dispositivo no ve nada.
  await logout(page);
  await expect(page).toHaveURL(/\/login$/);
  expect(await savedOnDevice(page)).toEqual({ caches: [], entries: {} });
  await signUpIndependentTeacher(page, "Luis Mora");
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Guardados en este dispositivo" })).toHaveCount(0);
});
