import { expect, test } from "./fixtures";
import { Pool } from "pg";
import { choose, signUpIndependentTeacher } from "./helpers";

let pool: Pool | null = null;
const db = () => (pool ??= new Pool({ connectionString: process.env.TEST_DATABASE_URL }));
test.afterAll(async () => {
  await pool?.end();
  pool = null;
});

/** Un quiz del docente en "generando", insertado como lo deja la generación (ADR-0008). */
async function insertGenerating(email: string) {
  const { rows } = await db().query<Record<string, string>>(
    `SELECT m."institutionId", m.id AS "membershipId", c.id AS "courseId", t.id AS "topicId"
       FROM users u
       JOIN memberships m ON m."userId" = u.id
       JOIN courses c ON c."membershipId" = m.id
       JOIN units un ON un."courseId" = c.id
       JOIN topics t ON t."unitId" = un.id
      WHERE u.email = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  const ref = rows[0]!;
  const id = `push${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  await db().query(
    `INSERT INTO resources (id, "institutionId", "membershipId", "courseId", "topicId", type,
       status, title, blueprint, context, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'QUIZ', 'GENERATING', 'Quiz: La recta numérica', '{}',
       '{"topic":{"id":"x","title":"La recta numérica","description":null},"dba":[]}', now())`,
    [id, ref.institutionId, ref.membershipId, ref.courseId, ref.topicId],
  );
  return { id, courseId: ref.courseId! };
}

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

/**
 * El navegador de las pruebas no tiene servicio push ni aviso de permiso (sin pantalla, lo que no está
 * dado lo reporta como bloqueado). Se emulan: el permiso empieza "sin preguntar" y pasa a "dado" al
 * pedirlo; `subscribe` devuelve una suscripción falsa por HTTPS. Se cuenta cuántas veces se pidió.
 */
async function fakePushService(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const KEY = "e2e:permiso";
    const COUNT = "e2e:pedidos";
    Object.defineProperty(Notification, "permission", {
      get: () => sessionStorage.getItem(KEY) ?? "default",
    });
    Notification.requestPermission = async () => {
      sessionStorage.setItem(COUNT, String(Number(sessionStorage.getItem(COUNT) ?? 0) + 1));
      sessionStorage.setItem(KEY, "granted");
      return "granted";
    };
    PushManager.prototype.getSubscription = async () => null;
    PushManager.prototype.subscribe = async () =>
      ({
        endpoint: "https://push.example.test/send/e2e",
        toJSON: () => ({
          endpoint: "https://push.example.test/send/e2e",
          keys: { p256dh: "BPruebaClavePublicaDeE2E000000000000", auth: "auth-e2e-0000" },
        }),
        unsubscribe: async () => true,
      }) as unknown as PushSubscription;
  });
}

const permissionRequests = (page: import("@playwright/test").Page) =>
  page.evaluate(() => Number(sessionStorage.getItem("e2e:pedidos") ?? 0));

test("CA-0013-32: la tarjeta pide el permiso al generar, nunca al cargar, y guarda el dispositivo", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await fakePushService(page);
  const user = await signUpIndependentTeacher(page);
  await page
    .getByTestId("first-steps")
    .getByRole("button", { name: "Crear mi primer curso" })
    .click();
  await choose(page, "Asignatura", "Matemáticas");
  await choose(page, "Grado", "6°");
  await page.getByLabel("Grupo").fill("601");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/create?type=QUIZ");
  await page.getByLabel(/tema vas a trabajar/).fill("La recta numérica");
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await expect(page.getByRole("button", { name: "Generar quiz" })).toBeVisible();

  // Un quiz en preparación (la IA de prueba responde al instante; aquí se deja "generando").
  const resource = await insertGenerating(user.email);
  await page.goto(`/courses/${resource.courseId}/resources/${resource.id}`);
  const card = page.getByTestId("notify-card");
  await expect(card).toContainText("¿Te avisamos cuando esté listo?");
  // Cargar páginas nunca pide el permiso.
  expect(await permissionRequests(page)).toBe(0);

  await card.getByRole("button", { name: "Avisarme" }).click();
  await expect(page.getByText("Te avisaremos")).toBeVisible();
  expect(await permissionRequests(page)).toBe(1);
  const { rows } = await db().query(
    `SELECT p.endpoint FROM push_subscriptions p JOIN users u ON u.id = p."userId" WHERE u.email = $1`,
    [user.email.toLowerCase()],
  );
  expect(rows.map((r) => r.endpoint)).toEqual(["https://push.example.test/send/e2e"]);

  // Ajustes → Notificaciones lo muestra activo y lo desactiva.
  await page.goto("/notifications");
  await expect(page.getByText("Recibe avisos de tus talleres, quices y exámenes.")).toBeVisible();
  await page.getByRole("button", { name: "Desactivar avisos" }).click();
  await expect(page.getByRole("button", { name: "Activar avisos" })).toBeVisible();
});

/** Entrega un aviso al service worker como si viniera del servicio push (protocolo de Chrome). */
async function deliverPush(page: import("@playwright/test").Page, data: object, origin: string) {
  const cdp = await page.context().newCDPSession(page);
  const registrationId = await new Promise<string>((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const reg = registrations.find((r: { isDeleted: boolean }) => !r.isDeleted);
      if (reg) resolve(reg.registrationId);
    });
    void cdp.send("ServiceWorker.enable");
  });
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin,
    registrationId,
    data: JSON.stringify(data),
  });
}

/**
 * Chromium sin pantalla no muestra notificaciones del sistema (ni con permiso): se reemplaza
 * `showNotification` del service worker por un registro de lo que se pidió mostrar.
 */
async function recordNotifications(page: import("@playwright/test").Page) {
  const worker =
    page.context().serviceWorkers()[0] ?? (await page.context().waitForEvent("serviceworker"));
  await worker.evaluate(() => {
    const scope = self as unknown as {
      shown: string[];
      registration: { showNotification: (title: string) => Promise<void> };
    };
    scope.shown = [];
    scope.registration.showNotification = async (title: string) => {
      scope.shown.push(title);
    };
  });
  return () => worker.evaluate(() => (self as unknown as { shown: string[] }).shown);
}

test("CA-0013-33/34: el aviso se muestra con Profe cerrado y no con Profe a la vista", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await serviceWorkerReady(page);
  const shown = await recordNotifications(page);
  const origin = new URL(page.url()).origin;
  const message = {
    title: "Tu quiz está listo",
    body: "«La recta numérica» está listo para revisar.",
    url: "/courses/x/resources/y",
    tag: "resource-y",
  };

  // CA-0013-34: Profe abierto y a la vista → no se repite como notificación del sistema.
  await deliverPush(page, message, origin);
  await page.waitForTimeout(500);
  expect(await shown()).toEqual([]);

  // CA-0013-33: sin ninguna ventana de Profe abierta → notificación del sistema.
  const other = await context.newPage();
  await other.goto("about:blank");
  await page.close();
  await deliverPush(other, message, origin);
  await expect.poll(shown).toEqual(["Tu quiz está listo"]);
});
