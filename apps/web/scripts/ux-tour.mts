// Recorrido visual de SPEC-0012: registra un docente, crea un curso y un tema, y toma capturas de
// las pantallas principales en escritorio y celular. Uso: node --import tsx scripts/ux-tour.mts <dir>
import { chromium, type Page } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? "ux-tour";
const email = `tour-${Date.now()}@colegio.test`;
const password = "contraseña-segura-123";

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log("captura", name);
}

const browser = await chromium.launch();
const desktop = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const page = desktop;

await page.goto(`${base}/`);
await shot(page, "01-landing");
await page.goto(`${base}/register`);
await shot(page, "02-register");
await page.getByLabel("Nombre").fill("Ana Pérez");
await page.getByLabel("Correo").fill(email);
await page.getByLabel("Contraseña", { exact: true }).fill(password);
await page.getByLabel("Confirmar contraseña").fill(password);
await page.getByRole("button", { name: "Crear cuenta" }).click();
await page.waitForURL(/\/login/);
await shot(page, "03-login");
await page.getByLabel("Correo").fill(email);
await page.getByLabel("Contraseña").fill(password);
await page.getByRole("button", { name: "Ingresar" }).click();
await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
await shot(page, "04-onboarding");
await page.getByRole("button", { name: "Empezar por mi cuenta" }).click();
await page.waitForURL(/\/dashboard/);
await shot(page, "05-inicio-sin-cursos");

await page.getByRole("button", { name: "Crear mi primer curso" }).click();
await page.getByLabel("Asignatura", { exact: true }).click();
await page.getByRole("option", { name: "Matemáticas", exact: true }).click();
await page.getByLabel("Grado", { exact: true }).click();
await page.getByRole("option", { name: "6°", exact: true }).click();
await page.getByLabel("Grupo").fill("601");
await shot(page, "06-dialogo-curso");
await page.getByRole("button", { name: "Crear curso" }).click();
await page.getByRole("dialog").waitFor({ state: "detached" });
await shot(page, "07-inicio-planear");

await page.getByRole("link", { name: "Crear taller" }).first().click();
await page.waitForURL(/\/create/);
await shot(page, "08-asistente-tema");
await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
await page.getByRole("button", { name: "Usar este tema" }).click();
await page.getByRole("button", { name: "Continuar" }).waitFor();
await shot(page, "09-asistente-ajustes");
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByRole("button", { name: /Generar taller/ }).waitFor();
await shot(page, "10-asistente-confirmar");
await page.getByRole("button", { name: /Generar taller/ }).click();
await page.waitForURL(/\/resources\//, { timeout: 30_000 });
await shot(page, "11-recurso-generando");
await page.waitForTimeout(8000);
await shot(page, "12-recurso-despues");

await page.goto(`${base}/dashboard`);
await shot(page, "13-inicio-con-recurso");
await page.goto(`${base}/courses`);
await shot(page, "14-mis-cursos");
await page.goto(`${base}/resources`);
await shot(page, "15-mis-recursos");
await page.getByRole("link", { name: "Mis cursos" }).click();
await page.getByRole("link", { name: /Matemáticas · 6° · 601/ }).click();
await shot(page, "16-curso");
await page.goto(`${base}/create`);
await shot(page, "17-asistente-que-crear");
await page.goto(`${base}/formats`);
await shot(page, "18-formatos");

const mobile = await browser.newPage({ viewport: { width: 360, height: 780 } });
await mobile.context().addCookies(await page.context().cookies());
for (const [name, path] of [
  ["m01-landing", "/"],
  ["m02-inicio", "/dashboard"],
  ["m03-asistente", "/create?type=QUIZ"],
  ["m04-mis-recursos", "/resources"],
] as const) {
  await mobile.goto(`${base}${path}`);
  await shot(mobile, name);
}
await mobile.goto(`${base}/dashboard`);
await mobile.getByRole("button", { name: "Abrir menú" }).click();
await shot(mobile, "m05-menu");

await browser.close();
