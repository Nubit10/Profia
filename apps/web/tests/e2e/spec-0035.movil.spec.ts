import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { register, uniqueEmail } from "./helpers";
import { resetLink, waitForMail } from "./mail";

// SPEC-0035 en el celular: el recorrido completo a 390 px, botón de ver la contraseña de 44 px.

test("CA-0035-10: recuperar la contraseña en el celular, sin desbordes y con áreas de 44 px", async ({
  page,
}) => {
  const user = { name: "Rosa Díaz", email: uniqueEmail("rosa-movil") };
  await register(page, user);

  await page.getByLabel("Correo").fill(user.email);
  const forgot = page.getByRole("link", { name: "¿Olvidaste tu contraseña?" });
  expect((await forgot.boundingBox())!.height).toBeGreaterThanOrEqual(36);
  await forgot.click();
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();

  await page.goto(resetLink(await waitForMail(user.email)));
  const toggle = page.getByRole("button", { name: "Mostrar contraseña" }).first();
  const box = (await toggle.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  await page.getByLabel("Contraseña nueva").fill("mi-clave-nueva-2026");
  await toggle.click();
  await expect(page.getByLabel("Contraseña nueva")).toHaveAttribute("type", "text");
  await page.getByLabel("Confirmar contraseña").fill("mi-clave-nueva-2026");

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
});
