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
 * Avisos emergentes: abajo a la derecha en el escritorio; arriba y centrados en el celular y la
 * tableta, donde abajo vive el botón "Crear" y la barra inferior del recurso (SPEC-0013 RN-11).
 */
export function AppToaster() {
  const phone = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
  return phone ? (
    <Toaster position="top-center" offset={{ top: "calc(4.5rem + env(safe-area-inset-top))" }} />
  ) : (
    <Toaster position="bottom-right" />
  );
}
