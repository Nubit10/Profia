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
