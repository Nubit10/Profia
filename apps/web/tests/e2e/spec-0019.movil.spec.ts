import { expect, test } from "./fixtures";
import { teacherWithTwoCourses } from "./spec-0019-support";

// SPEC-0019 en el celular (iPhone 13): lo elegido va en fichas bajo la barra de avance.

test("CA-0019-06: en el celular, fichas de 44 px con lo elegido que llevan a cambiarlo, y «Volver»", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await teacherWithTwoCourses(page);
  await page.goto("/create?type=QUIZ");
  await page.getByRole("radio", { name: /Educación Religiosa/ }).click();
  await page.getByLabel(/tema vas a trabajar/).fill("La creación");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar quiz" })).toBeVisible();

  const chosen = page.getByRole("list", { name: "Lo que elegiste" });
  await expect(chosen.getByRole("listitem")).toHaveCount(3);
  for (const link of await chosen.getByRole("link").all()) {
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await chosen.getByRole("link", { name: /Cambiar tema: La creación/ }).click();
  await expect(page.getByRole("heading", { name: "¿Sobre qué tema?" })).toBeVisible();
  await page.getByRole("link", { name: "Volver al curso" }).click();
  await expect(page.getByRole("heading", { name: "¿Para qué curso?" })).toBeVisible();
});
