import { expect, test } from "./fixtures";
import { signUpIndependentTeacher } from "./helpers";

// SPEC-0013 RN-12/13 y ADR-0012: Profe instalable y su service worker.

/** Espera a que el service worker controle la página. */
async function serviceWorkerReady(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
    }
  });
}

test("CA-0013-28: Chrome considera instalable a Profe y el manifiesto trae lo necesario", async ({
  page,
}) => {
  await page.goto("/");
  await serviceWorkerReady(page);

  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);

  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    name: "Profe",
    display: "standalone",
    start_url: "/dashboard",
    theme_color: expect.any(String),
    background_color: expect.any(String),
  });
  const sizes = manifest.icons.map(
    (i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`,
  );
  expect(sizes).toEqual(["192x192 any", "512x512 any", "512x512 maskable"]);
  for (const icon of [
    ...manifest.icons,
    { src: "/icons/apple-touch-icon.png", sizes: "180x180" },
  ]) {
    const response = await page.request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    const [w, h] = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    }, icon.src);
    expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
  }
});

test("CA-0013-29: 'Instalar Profe' abre el aviso del navegador y no aparece con la app instalada", async ({
  page,
  browser,
}) => {
  await signUpIndependentTeacher(page);
  const install = page.getByRole("button", { name: "Instalar Profe" });
  // Sin aviso del navegador (p. ej. Firefox de escritorio) no se ofrece.
  await expect(install).toHaveCount(0);

  // El navegador avisa que se puede instalar.
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<unknown>;
    };
    (window as unknown as { prompted: number }).prompted = 0;
    event.prompt = async () => {
      (window as unknown as { prompted: number }).prompted += 1;
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await install.click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { prompted: number }).prompted))
    .toBe(1);

  // Abierta como app instalada: la opción no aparece.
  const installed = await browser.newContext({ storageState: await page.context().storageState() });
  await installed.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes("display-mode: standalone")
        ? ({ ...original(query), matches: true, media: query } as MediaQueryList)
        : original(query);
  });
  const app = await installed.newPage();
  await app.goto("/dashboard");
  await expect(app.getByRole("heading", { name: /^Hola,/ })).toBeVisible();
  await app.evaluate(() => window.dispatchEvent(new Event("beforeinstallprompt")));
  await expect(app.getByRole("button", { name: "Instalar Profe" })).toHaveCount(0);
  await installed.close();
});

test("CA-0013-30: sin red se ve 'Sin conexión' y la caché no guarda páginas del docente", async ({
  page,
  context,
}) => {
  await signUpIndependentTeacher(page);
  await serviceWorkerReady(page);
  await page.goto("/courses");
  await page.goto("/resources");

  await context.setOffline(true);
  await page.goto("/courses").catch(() => null);
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await page.goto("/dashboard").catch(() => null);
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((r) => new URL(r.url).pathname));
    }
    return urls;
  });
  expect(cached).toContain("/offline");
  expect(cached.filter((u) => /^\/(courses|resources|dashboard|create)/.test(u))).toEqual([]);
  await context.setOffline(false);
});
