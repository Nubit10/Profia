import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { choose, signUpIndependentTeacher } from "./helpers";

// SPEC-0031: compartir por WhatsApp e imprimir directo, en el computador (AI Engine de prueba).

async function quiz(page: Page) {
  await page.getByRole("button", { name: "Crear mi primer curso" }).first().click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("6A");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("Fracciones");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.getByRole("button", { name: "Generar quiz" }).click();
  await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible({ timeout: 30_000 });
}

test("CA-0031-01/02/03: imprimir abre el PDF en línea, sin «Compartir» de celular y con «Enviar por WhatsApp»", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpIndependentTeacher(page);
  await quiz(page);

  // CA-0031-02: Chromium de escritorio no comparte archivos: no aparece el ícono del celular.
  await expect(page.getByRole("button", { name: "Compartir (WhatsApp u otra app)" })).toHaveCount(
    0,
  );

  // Chromium sin interfaz no abre PDF en pestañas: se registra lo que recibe window.open.
  await page.evaluate(() => {
    const w = window as unknown as { opened: string[] };
    w.opened = [];
    window.open = (url?: string | URL) => {
      w.opened.push(String(url));
      return null;
    };
  });
  const opened = () => page.evaluate(() => (window as unknown as { opened: string[] }).opened);

  // CA-0031-01: "Imprimir" abre la hoja del estudiante en PDF, en línea.
  await page.getByRole("button", { name: "Imprimir" }).click();
  const printUrl = new URL((await opened())[0], page.url());
  expect(printUrl.searchParams.get("doc")).toBe("student");
  expect(printUrl.searchParams.get("format")).toBe("pdf");
  expect(printUrl.searchParams.get("inline")).toBe("1");
  const response = await page.request.get(printUrl.pathname + printUrl.search);
  expect(response.headers()["content-disposition"]).toMatch(/^inline/);

  // CA-0031-03: en el computador, "Enviar por WhatsApp" descarga la hoja en PDF y abre WhatsApp Web.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Enviar por WhatsApp" }).click(),
  ]);
  expect(download.url()).toMatch(/\/export\?doc=student&format=pdf/);
  expect((await opened())[1]).toBe("https://web.whatsapp.com/");
  await expect(page.getByText("Se descargó la hoja en PDF")).toBeVisible();
});

test("Ajustes: guardar los recursos sin conexión se activa y se apaga desde Ajustes", async ({
  page,
}) => {
  await signUpIndependentTeacher(page);
  await page.goto("/settings");
  const offline = page.getByRole("region", { name: "Usar sin conexión" });
  await offline.getByRole("button", { name: "Guardar en este dispositivo" }).click();
  await expect(offline.getByRole("status")).toContainText("Sin conexión: guardados");
  await offline.getByRole("button", { name: "Dejar de guardar en este dispositivo" }).click();
  await expect(offline.getByRole("button", { name: "Guardar en este dispositivo" })).toBeVisible();
});
