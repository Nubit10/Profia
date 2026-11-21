import { expect, test } from "./fixtures";
import { signUpIndependentTeacher } from "./helpers";

// Canal de soporte del piloto: WhatsApp del equipo de ProfIA en la página pública, el ingreso y el menú.
const WA = /^https:\/\/wa\.me\/573205685222\?text=Hola%2C%20equipo%20de%20ProfIA/;

test("soporte: la burbuja de WhatsApp está en la página pública y en el login", async ({
  page,
}) => {
  for (const path of ["/", "/login", "/register", "/forgot-password"]) {
    await page.goto(path);
    const bubble = page.getByRole("link", { name: "¿Necesitas ayuda? Escríbenos por WhatsApp" });
    await expect(bubble).toHaveAttribute("href", WA);
    await expect(bubble).toHaveAttribute("target", "_blank");
  }
});

test("soporte: el menú tiene «¿Necesitas ayuda?» por WhatsApp", async ({ page }) => {
  await signUpIndependentTeacher(page);
  const help = page.getByRole("link", { name: /¿Necesitas ayuda\?/ });
  await expect(help).toHaveAttribute("href", WA);
  await expect(help).toBeVisible();
});
