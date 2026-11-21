"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sileo";

const PHONE = "(max-width: 1023px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * Avisos emergentes: abajo a la derecha en el escritorio; en el celular y la tableta, abajo y
 * centrados, por encima de la barra inferior (bloque 8 de usabilidad: arriba tapaban el título).
 */
export function AppToaster() {
  const phone = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
  return phone ? (
    <Toaster
      position="bottom-center"
      offset={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    />
  ) : (
    <Toaster position="bottom-right" />
  );
}
