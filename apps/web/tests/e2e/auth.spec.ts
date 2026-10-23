import { expect, test } from "./fixtures";
import {
  PASSWORD,
  login,
  logout,
  register,
  signUpIndependentTeacher,
  uniqueEmail,
} from "./helpers";

test("CA-0001-02: un visitante sin sesión es redirigido al login conservando la ruta", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard$/);
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
});

test("CA-0001-11 / CA-0001-03: se registra, inicia sesión y entra con su nombre", async ({
  page,
}) => {
  const user = { name: "Ana Pérez", email: uniqueEmail() };
  await register(page, user);

  await login(page, user.email.toUpperCase());
  // Sin espacio todavía, el área autenticada empieza en el onboarding (CA-0002-01).
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: `Hola, ${user.name}` })).toBeVisible();
});

test("CA-0001-12: no permite registrar dos veces el mismo correo", async ({ page }) => {
  const user = { name: "Luis Gómez", email: uniqueEmail() };
  await register(page, user);

  await page.goto("/register");
  await page.getByLabel("Nombre").fill(user.name);
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Ya existe una cuenta" })).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test("CA-0001-05: credenciales inválidas muestran un mensaje genérico y no crean sesión", async ({
  page,
}) => {
  const user = { name: "Marta Ruiz", email: uniqueEmail() };
  await register(page, user);

  await login(page, user.email, "contraseña-equivocada");
  await expect(
    page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos" }),
  ).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("CA-0001-04: cerrar sesión revoca la sesión en el servidor, aunque se reutilice la cookie", async ({
  page,
  context,
}) => {
  await signUpIndependentTeacher(page, "Pedro Díaz");
  const cookiesWhileLoggedIn = await context.cookies();

  await logout(page);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  // Restauramos la cookie anterior al logout: el servidor debe rechazarla (RN-08).
  await context.addCookies(cookiesWhileLoggedIn);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("tras el login vuelve a la ruta solicitada (callbackUrl interno)", async ({ page }) => {
  const user = await signUpIndependentTeacher(page, "Sara León");
  await logout(page);
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/login?callbackUrl=%2Fsubjects");
  await login(page, user.email);
  await expect(page).toHaveURL(/\/subjects$/);
});

test("ignora un callbackUrl externo (sin open redirect)", async ({ page }) => {
  const user = { name: "Raúl Mora", email: uniqueEmail() };
  await register(page, user);

  await page.goto("/login?callbackUrl=https%3A%2F%2Fevil.example");
  await login(page, user.email);
  await expect(page).toHaveURL(/localhost:3100\/onboarding$/);
});
