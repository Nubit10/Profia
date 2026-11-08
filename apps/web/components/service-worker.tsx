"use client";

import { useEffect } from "react";

/**
 * SPEC-0013 RN-12/13: registra el service worker de la app instalable. Solo en producción: en
 * desarrollo la caché de archivos estáticos confundiría los cambios en caliente.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // Si quedó uno de una corrida de producción en el mismo puerto, serviría CSS viejo: se quita.
      void navigator.serviceWorker.getRegistrations().then(async (regs) => {
        if (regs.length === 0) return;
        await Promise.all(regs.map((r) => r.unregister()));
        await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
        window.location.reload();
      });
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin service worker Profe funciona igual; solo no se instala ni muestra «Sin conexión».
    });
  }, []);
  return null;
}
