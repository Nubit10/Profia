import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { PASSWORD, login, register, uniqueEmail } from "./helpers";
import { countMailsTo, resetLink, waitForMail } from "./mail";

// SPEC-0035: recuperar la contraseña por correo y ver la contraseña al escribirla.

const NEW_PASSWORD = "mi-clave-nueva-2026";

async function checkScreen(page: Page, name: string) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => `${name}: ${v.id}`)).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name}: scroll horizontal`).toBeLessThanOrEqual(0);
}

test("CA-0035-01 / 02 / 04: olvida la contraseña, le llega el enlace y entra con la nueva", async ({
  page,
}) => {
  const user = { name: "Rosa Díaz", email: uniqueEmail("rosa") };
  await register(page, user);

  await page.getByLabel("Correo").fill(user.email);
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page).toHaveURL(/\/forgot-password\?email=/);
  await expect(page.getByLabel("Correo")).toHaveValue(user.email);
  await checkScreen(page, "pedir enlace");

  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();
  await checkScreen(page, "revisa tu correo");

  const mail = await waitForMail(user.email);
  expect(mail.subject).toBe("Crea una contraseña nueva para ProfIA");
  const link = resetLink(mail);
  expect(link.startsWith("http://localhost:3100/reset-password/")).toBe(true);

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Crea tu contraseña nueva" })).toBeVisible();
  await checkScreen(page, "contraseña nueva");
  await page.getByLabel("Contraseña nueva").fill(NEW_PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });

  // La vieja ya no sirve; la nueva sí.
  await page.context().clearCookies();
  await page.goto("/login");
  await login(page, user.email, PASSWORD);
  await expect(
    page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos" }),
  ).toBeVisible();
  await page.goto("/login");
  await login(page, user.email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/onboarding$/);

  // CA-0035-05: el mismo enlace ya no sirve.
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Este enlace ya no sirve" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pedir un enlace nuevo" })).toBeVisible();
  await checkScreen(page, "enlace vencido");
});

test("CA-0035-03: un correo sin cuenta ve el mismo mensaje y no recibe nada", async ({ page }) => {
  const email = uniqueEmail("nadie");
  await page.goto("/forgot-password");
  await page.getByLabel("Correo").fill(email);
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();
  await expect(page.getByText(`Si hay una cuenta con ${email}`)).toBeVisible();
  await page.waitForTimeout(1_000);
  expect(await countMailsTo(email)).toBe(0);
});

test("CA-0035-05: un enlace inventado muestra que no sirve", async ({ page }) => {
  await page.goto(`/reset-password/${"x".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "Este enlace ya no sirve" })).toBeVisible();
  await page.getByRole("link", { name: "Pedir un enlace nuevo" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("CA-0035-09: el login y el registro dejan ver la contraseña", async ({ page }) => {
  await page.goto("/login");
  const password = page.getByLabel("Contraseña", { exact: true });
  await password.fill("secreta-123");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Ocultar contraseña" }).click();
  await expect(password).toHaveAttribute("type", "password");

  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Mostrar contraseña" })).toHaveCount(2);
  await page.getByRole("button", { name: "Mostrar contraseña" }).first().click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "text");
  await expect(page.getByLabel("Confirmar contraseña")).toHaveAttribute("type", "password");
  await checkScreen(page, "registro");
});
