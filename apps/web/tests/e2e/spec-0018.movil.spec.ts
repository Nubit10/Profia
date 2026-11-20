import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0018: en el celular, "sin conexión" es un ícono con aviso junto a "Crear con IA" que abre
// una hoja inferior con la explicación y las opciones (proyecto "movil": iPhone 13, 390 × 844).

/** Recursos guardados en el dispositivo (entradas de IndexedDB y cachés de la biblioteca). */
async function savedCount(page: Page) {
  return page.evaluate(async () => {
    const caches_ = (await caches.keys()).filter((k) => k.startsWith("profe-offline-"));
    const dbs = (await indexedDB.databases()).map((d) => d.name);
    if (!dbs.includes("profe-offline")) return caches_.length;
    const entries = await new Promise<number>((resolve, reject) => {
      const open = indexedDB.open("profe-offline", 1);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("entries")) return resolve(0);
        const count = db.transaction("entries").objectStore("entries").count();
        count.onsuccess = () => {
          db.close();
          resolve(count.result);
        };
        count.onerror = () => reject(count.error);
      };
      open.onerror = () => reject(open.error);
    });
    return caches_.length + entries;
  });
}

/** Docente con un curso y un quiz generado. */
async function teacherWithQuiz(page: Page) {
  await signUpIndependentTeacher(page);
  await page
    .getByTestId("first-steps")
    .getByRole("button", { name: "Crear mi primer curso" })
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.getByRole("button", { name: "Generar quiz" }).click();
  await expect(page.getByRole("button", { name: "Descargar", exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

test("CA-0018-01/02/05/08: ícono con aviso en vez de la tarjeta; la hoja explica y no guarda nada", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await teacherWithQuiz(page);
  await page.goto("/resources");

  // CA-0018-01: sin tarjeta; el ícono con aviso está junto a "Crear con IA" y la lista se ve.
  const button = page.getByRole("button", {
    name: "Guardar recursos sin conexión (pendiente de decidir)",
  });
  await expect(button).toBeVisible();
  await expect(page.getByTestId("offline-alert")).toBeVisible();
  await expect(page.getByTestId("offline-panel")).toBeHidden();
  const list = page.getByRole("list", { name: "Recursos recientes" });
  const first = await list.getByRole("listitem").first().boundingBox();
  expect(first!.y).toBeLessThan(page.viewportSize()!.height);

  // CA-0018-08: zona táctil de 44 px y sin fallas de accesibilidad.
  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // CA-0018-02: la hoja inferior explica y ofrece las dos opciones; nada se guarda todavía.
  await button.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("¿Guardar tus recursos en este dispositivo");
  await expect(dialog).toContainText("Si este computador lo usan otras personas");
  await expect(dialog.getByRole("button", { name: "Guardar en este dispositivo" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "No, gracias" })).toBeVisible();
  // La hoja entra con una animación: se mide cuando termina.
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const sheet = (await dialog.boundingBox())!;
  expect(Math.round(sheet.y + sheet.height)).toBe(page.viewportSize()!.height);
  await page.waitForTimeout(1_000);
  expect(await savedCount(page)).toBe(0);

  // CA-0018-05: Atrás cierra la hoja sin decidir; sigue en "Mis recursos" con el aviso.
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/resources$/);
  await expect(page.getByTestId("offline-alert")).toBeVisible();
});

test("CA-0018-03/06: guardar cierra la hoja, quita el aviso y luego deja de guardar", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await teacherWithQuiz(page);
  await page.goto("/resources");

  // CA-0018-03
  await page.getByTestId("offline-button").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar en este dispositivo" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("offline-alert")).toHaveCount(0);
  const list = page.getByRole("list", { name: "Recursos recientes" });
  await expect(list.getByTestId("offline-ready")).toHaveCount(1, { timeout: 60_000 });

  // CA-0018-06: la hoja muestra cuántos van guardados y deja dejar de guardar.
  await page.getByRole("button", { name: "Guardar recursos sin conexión" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("guardados 1 de 1");
  await dialog.getByRole("button", { name: "Dejar de guardar en este dispositivo" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => savedCount(page), { timeout: 15_000 }).toBe(0);
  await expect(list.getByTestId("offline-ready")).toHaveCount(0);
});

test("CA-0018-04: «No, gracias» cierra la hoja, quita el aviso y no guarda nada", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await teacherWithQuiz(page);
  await page.goto("/resources");
  await page.getByTestId("offline-button").click();
  await page.getByRole("dialog").getByRole("button", { name: "No, gracias" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("offline-alert")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("offline-button")).toBeVisible();
  await expect(page.getByTestId("offline-alert")).toHaveCount(0);
  await page.waitForTimeout(1_000);
  expect(await savedCount(page)).toBe(0);
});
