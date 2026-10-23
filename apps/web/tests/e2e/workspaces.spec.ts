import type { Browser } from "@playwright/test";
import { expect, newDeviceContext, test } from "./fixtures";
import {
  PNG_1X1,
  choose,
  fillRegistration,
  login,
  register,
  signUpIndependentTeacher,
  uniqueEmail,
} from "./helpers";

test("CA-0002-02 / CA-0003-02: un docente independiente empieza sin datos y crea su curso", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);

  await page.getByRole("button", { name: "Crear mi primer curso" }).click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();

  const courses = page.getByRole("list", { name: "Cursos" });
  await expect(courses.getByText("Matemáticas · 6° · 601")).toBeVisible();
});

test("CA-0003-03: no permite duplicar un curso", async ({ page }) => {
  await signUpIndependentTeacher(page);
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: i === 0 ? "Crear mi primer curso" : "Nuevo curso" })
      .click();
    await choose(page, "Asignatura", "Inglés");
    await choose(page, "Grado", "Transición");
    await page.getByRole("button", { name: "Crear curso" }).click();
  }
  await expect(page.getByRole("alert").filter({ hasText: "Ya tienes este curso" })).toBeVisible();
});

async function registerSchoolAdmin(browser: Browser) {
  const context = await newDeviceContext(browser);
  const page = await context.newPage();
  const admin = { name: "Rectora Gómez", email: uniqueEmail("rectora") };
  await register(page, admin);
  await login(page, admin.email);
  await page.getByRole("button", { name: "Registrar mi colegio" }).click();

  await page.getByLabel("Nombre del colegio").fill("IE San José de Prueba");
  await choose(page, "Sector", "Oficial");
  await page.getByRole("button", { name: "Registrar colegio" }).click();
  // Oficial sin DANE se rechaza (CA-0002-03).
  await expect(page.getByText("El código DANE es obligatorio")).toBeVisible();

  await page.getByLabel("Código DANE").fill("105001000123");
  await page.getByLabel("Departamento").fill("Antioquia");
  await page.getByLabel("Municipio").fill("Medellín");
  await page.getByRole("button", { name: "Registrar colegio" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Administra tu colegio")).toBeVisible();
  return { page, context, admin };
}

test("CA-0002-03/04/05: un colegio se registra, invita a un profesor y este acepta", async ({
  browser,
}) => {
  const { page: adminPage } = await registerSchoolAdmin(browser);

  // Sedes (CA-0002-13).
  await adminPage
    .getByRole("navigation", { name: "Menú principal" })
    .getByRole("link", { name: "Datos y sedes" })
    .click();
  await adminPage.getByLabel("Nombre de la nueva sede").fill("Sede Rural El Carmen");
  await adminPage.getByRole("button", { name: "Agregar sede" }).click();
  await expect(
    adminPage.getByRole("list", { name: "Sedes" }).getByText("Sede Rural El Carmen"),
  ).toBeVisible();

  // Invitación (CA-0002-04).
  const teacher = { name: "Profe Invitado", email: uniqueEmail("profe") };
  await adminPage.getByRole("link", { name: "Profesores", exact: true }).click();
  await adminPage.getByLabel("Correo del profesor").fill(teacher.email);
  await adminPage.getByRole("button", { name: "Generar enlace" }).click();
  const link = await adminPage.getByLabel("Enlace de invitación").inputValue();
  expect(link).toMatch(/\/invitations\/[A-Za-z0-9_-]{40,}$/);

  // El profesor abre el enlace sin cuenta, se registra y acepta (CA-0002-05).
  const teacherContext = await newDeviceContext(browser);
  const teacherPage = await teacherContext.newPage();
  await teacherPage.goto(link);
  await expect(teacherPage.getByText("Te invitaron a IE San José de Prueba")).toBeVisible();
  await teacherPage.getByRole("link", { name: /Crear cuenta con/ }).click();
  await expect(teacherPage.getByLabel("Correo")).toHaveValue(teacher.email);
  await teacherPage.getByLabel("Nombre").fill(teacher.name);
  await fillRegistration(teacherPage, teacher);
  await expect(teacherPage).toHaveURL(/\/login\?callbackUrl=/);
  await login(teacherPage, teacher.email);
  await expect(teacherPage).toHaveURL(/\/invitations\//);
  await teacherPage.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(teacherPage).toHaveURL(/\/dashboard$/);
  await expect(teacherPage.getByRole("heading", { name: `Hola, ${teacher.name}` })).toBeVisible();

  // Como el colegio tiene dos sedes, el curso pide sede.
  await teacherPage.getByRole("button", { name: "Crear mi primer curso" }).click();
  await choose(teacherPage, "Asignatura", "Ciencias Sociales");
  await choose(teacherPage, "Grado", "9°");
  await choose(teacherPage, "Sede", "Sede Rural El Carmen");
  await teacherPage.getByRole("button", { name: "Crear curso" }).click();
  await expect(teacherPage.getByRole("dialog")).toHaveCount(0);
  // "Mis cursos" muestra la sede de cada curso (SPEC-0012: página propia).
  await teacherPage.getByRole("link", { name: "Mis cursos" }).click();
  const teacherCourses = teacherPage.getByRole("list", { name: "Cursos" });
  await expect(teacherCourses.getByText("Ciencias Sociales · 9°")).toBeVisible();
  await expect(teacherCourses.getByText("Sede Rural El Carmen")).toBeVisible();

  // CA-0002-09: un docente no ve ni puede abrir la administración del colegio.
  await expect(teacherPage.getByRole("link", { name: "Profesores", exact: true })).toHaveCount(0);
  const response = await teacherPage.goto("/school/members");
  expect(response?.status()).toBe(404);

  // El enlace ya no sirve (CA-0002-06).
  await teacherPage.goto(link);
  await expect(teacherPage.getByText("Esta invitación ya no es válida")).toBeVisible();

  // El admin ve al profesor y lo desactiva: pierde el acceso en la siguiente request (CA-0002-11).
  await adminPage.reload();
  const members = adminPage.getByRole("list", { name: "Miembros" });
  await expect(members.getByText(teacher.email)).toBeVisible();
  await adminPage.getByRole("button", { name: `Opciones de ${teacher.name}` }).click();
  await adminPage.getByRole("menuitem", { name: "Desactivar" }).click();
  await expect(members.getByText("Desactivado")).toBeVisible();

  await teacherPage.goto("/dashboard");
  await expect(teacherPage).toHaveURL(/\/onboarding$/);
});

test("CA-0002-07 / CA-0012-23: un docente con dos espacios cambia entre ellos", async ({
  browser,
}) => {
  const { page: adminPage } = await registerSchoolAdmin(browser);
  // CA-0012-23: el colegio tiene logo; el espacio propio del docente, no.
  await adminPage.getByRole("link", { name: "Formatos", exact: true }).click();
  await adminPage
    .getByLabel("Subir logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(adminPage.getByRole("img", { name: "Logo actual" })).toBeVisible();
  const teacher = { name: "Profe Doble", email: uniqueEmail("doble") };
  await adminPage.getByRole("link", { name: "Profesores", exact: true }).click();
  await adminPage.getByLabel("Correo del profesor").fill(teacher.email);
  await adminPage.getByRole("button", { name: "Generar enlace" }).click();
  const link = await adminPage.getByLabel("Enlace de invitación").inputValue();

  const context = await newDeviceContext(browser);
  const page = await context.newPage();
  await register(page, teacher);
  await login(page, teacher.email);
  await page.getByRole("button", { name: "Empezar por mi cuenta" }).click();
  await expect(page.getByText(`Espacio de ${teacher.name}`).first()).toBeVisible();

  await page.goto(link);
  await page.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const switcher = page.getByRole("button", { name: "Cambiar de espacio" });
  const schoolLogo = switcher.locator('img[src^="/formats/logo"]');
  await expect(switcher).toContainText("IE San José de Prueba");
  await expect(schoolLogo).toBeVisible();
  await switcher.click();
  await page.getByRole("menuitem", { name: `Espacio de ${teacher.name}` }).click();
  await expect(switcher).toContainText(`Espacio de ${teacher.name}`);
  await expect(schoolLogo).toHaveCount(0);
});
