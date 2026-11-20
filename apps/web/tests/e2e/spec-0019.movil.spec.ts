import { expect, test } from "./fixtures";
import { teacherWithTwoCourses } from "./spec-0019-support";

// SPEC-0019 en el celular (iPhone 13): lo elegido va en fichas bajo la barra de avance.

test("CA-0019-06: en el celular, una fila deslizable de fichas de 44 px con lo elegido que llevan a cambiarlo, y «Volver»", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await teacherWithTwoCourses(page);
  await page.goto("/create?type=QUIZ");
  await page.getByRole("radio", { name: /Educación Religiosa/ }).click();
  await page.getByLabel(/tema vas a trabajar/).fill("La creación");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar quiz" })).toBeVisible();

  // Una sola fila que se desliza de lado (no una ficha debajo de otra).
  const chosen = page.getByRole("group", { name: "Lo que elegiste" });
  const links = await chosen.getByRole("link").all();
  expect(links).toHaveLength(3);
  const tops = new Set<number>();
  for (const link of links) {
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    tops.add(Math.round(box.y));
  }
  expect(tops.size).toBe(1);
  const overflow = await chosen.evaluate((el) => {
    const row = el.firstElementChild as HTMLElement;
    return row.scrollWidth > row.clientWidth;
  });
  // Si no cabe, la fila se desliza y la página no se ensancha.
  if (overflow) await expect(chosen.locator("button").last()).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await chosen.getByRole("link", { name: /Cambiar tema: La creación/ }).click();
  await expect(page.getByRole("heading", { name: "¿Sobre qué tema?" })).toBeVisible();
  await page.getByRole("link", { name: "Volver al curso" }).click();
  await expect(page.getByRole("heading", { name: "¿Para qué curso?" })).toBeVisible();
});
