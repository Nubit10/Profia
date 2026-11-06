"use client";

import { useEffect } from "react";

/**
 * SPEC-0013 RN-12/13: registra el service worker de la app instalable. Solo en producción: en
 * desarrollo la caché de archivos estáticos confundiría los cambios en caliente.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin service worker Profe funciona igual; solo no se instala ni muestra «Sin conexión».
    });
  }, []);
  return null;
}
