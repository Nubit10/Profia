import type { Page } from "@playwright/test";
import { expect } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

/** Docente con dos cursos (así hay un curso que elegir). */
export async function teacherWithTwoCourses(page: Page) {
  await signUpIndependentTeacher(page);
  for (const [subject, grade] of [
    ["Matemáticas", "6°"],
    ["Educación Religiosa", "3°"],
  ] as const) {
    await page.goto("/courses");
    await page
      .getByRole("button", { name: /Crear mi primer curso|Nuevo curso/ })
      .first()
      .click();
    await choose(page, "Asignatura", subject);
    await choose(page, "Grado", grade);
    await page.getByLabel("Grupo").fill("601");
    await page.getByRole("button", { name: "Crear curso" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
}
