import { expect, type Page } from "@playwright/test";

export const PASSWORD = "contraseña-segura-123";

/** Imagen PNG de 1×1 para subir como logo. */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export function uniqueEmail(prefix = "docente") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@colegio.test`;
}

export async function fillRegistration(page: Page, user: { name: string; email: string }) {
  await page.getByLabel("Nombre").fill(user.name);
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

/**
 * Crea la cuenta y deja el navegador sin sesión en el login, para los tests que prueban el login.
 * Desde SPEC-0013 (RN-01) crear la cuenta ya inicia la sesión: se borra la cookie a propósito.
 */
export async function register(page: Page, user: { name: string; email: string }) {
  await page.goto("/register");
  await fillRegistration(page, user);
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
  await page.context().clearCookies();
  await page.goto("/login");
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

/** Registro (que ya inicia sesión, SPEC-0013) + espacio independiente: deja al docente en el Inicio. */
export async function signUpIndependentTeacher(page: Page, name = "Ana Pérez") {
  const user = { name, email: uniqueEmail() };
  await page.goto("/register");
  await fillRegistration(page, user);
  // Con todos los E2E en paralelo en un equipo sin GPU, el registro puede tardar más de 5 s.
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Empezar por mi cuenta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: `Hola, ${name}` })).toBeVisible();
  return user;
}

/** Registro + login + colegio privado: deja al administrador (sin rol docente) en el Inicio. */
export async function signUpSchoolAdmin(page: Page, name = "Rectora Gómez") {
  const user = { name, email: uniqueEmail("rectora") };
  await page.goto("/register");
  await fillRegistration(page, user);
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Registrar mi colegio" }).click();
  await page.getByLabel("Nombre del colegio").fill("Colegio Los Andes de Prueba");
  await choose(page, "Sector", "Privado");
  await page.getByLabel("Departamento").fill("Antioquia");
  await page.getByLabel("Municipio").fill("Medellín");
  await page.getByRole("button", { name: "Registrar colegio" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return user;
}

/** Cierra sesión desde el menú; SPEC-0012 pide confirmación. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Salir" }).click();
}

/** En el asistente de creación: generar desde los ajustes (SPEC-0012, SPEC-0013). */
export async function confirmAndGenerate(page: Page, type: "taller" | "quiz") {
  // SPEC-0013 CA-0013-10: se genera desde los ajustes, sin paso de confirmar.
  await page.getByRole("button", { name: `Generar ${type}` }).click();
}

/**
 * Descarga un documento suelto por su nombre, p. ej. "Clave (versión B) en Word" (SPEC-0013 RN-06:
 * diálogo "Descargar" → "Descargar un archivo suelto"). Elige antes cuántas versiones mostrar.
 */
export async function download(page: Page, name: string) {
  await page.getByRole("button", { name: "Descargar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Descargar" });
  const variant = /\(versión ([A-D])\)/.exec(name)?.[1];
  if (variant) {
    const n = "ABCD".indexOf(variant) + 1;
    await dialog.getByRole("radio", { name: n === 1 ? "1 versión" : `${n} versiones` }).click();
  }
  const singles = dialog.getByRole("button", { name: "Descargar un archivo suelto" });
  if ((await singles.getAttribute("aria-expanded")) !== "true") await singles.click();
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("link", { name, exact: true }).click(),
  ]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  return file;
}

/** Elige una opción de un select de Base UI asociado a la etiqueta `label`. */
export async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
