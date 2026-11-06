/*
 * Service worker de Profe (SPEC-0013, ADR-0012). Sin librerías.
 * - Nunca guarda páginas del área de trabajo ni respuestas de acciones: van a la red.
 * - Guarda solo los archivos estáticos con huella de Next (inmutables), los íconos y la página
 *   «Sin conexión». Sin red, una navegación muestra esa página en vez del error del navegador.
 * - Cada caché lleva la versión en el nombre; al activarse una versión nueva se borran las viejas.
 */
const VERSION = "v1";
const SHELL_CACHE = `profe-shell-${VERSION}`;
const STATIC_CACHE = `profe-static-${VERSION}`;
const OFFLINE_URL = "/offline";
const SHELL = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];
const OWN = [SHELL_CACHE, STATIC_CACHE];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("profe-") && !key.startsWith("profe-offline-"))
            .filter((key) => !OWN.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegaciones: siempre la red; sin red, «Sin conexión».
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(OFFLINE_URL, { cacheName: SHELL_CACHE })
          .then((page) => page || Response.error()),
      ),
    );
    return;
  }

  // Archivos estáticos con huella: caché primero (nunca cambian).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request, { cacheName: SHELL_CACHE }).then((hit) => hit || fetch(request)),
    );
  }
});

// --- Notificaciones del navegador (SPEC-0013 RN-15) ----------------------------------------------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Profe está abierto y a la vista: el docente ya ve el aviso dentro de la app (como Claude).
      if (windows.some((w) => w.visibilityState === "visible")) return undefined;
      return self.registration.showNotification(
        typeof data.title === "string" && data.title ? data.title : "Profe",
        {
          body: typeof data.body === "string" ? data.body : "Tienes una novedad en Profe.",
          tag: typeof data.tag === "string" ? data.tag : undefined,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          lang: "es-CO",
          data: { url: typeof data.url === "string" ? data.url : "/dashboard" },
        },
      );
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Solo rutas de este mismo sitio: un aviso nunca abre otra página.
  let target = new URL("/dashboard", self.location.origin);
  try {
    const url = new URL(
      event.notification.data && event.notification.data.url,
      self.location.origin,
    );
    if (url.origin === self.location.origin) target = url;
  } catch {
    // URL inválida: se abre el Inicio.
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(target.href).then((w) => (w || open).focus());
      return self.clients.openWindow(target.href);
    }),
  );
});
