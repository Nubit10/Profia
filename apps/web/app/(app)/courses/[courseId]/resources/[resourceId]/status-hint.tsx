"use client";

import { useSyncExternalStore } from "react";
import { HiOutlineInformationCircle, HiOutlineXMark } from "react-icons/hi2";

const KEY = "profe:estado-explicado";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const seen = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
};

/**
 * Bloque 8 de usabilidad: la primera vez se explica en una línea qué es "Borrador" y "Listo". Se
 * oculta con "Entendido" y no vuelve en ese dispositivo. En el servidor no se muestra (sin saltos).
 */
export function StatusHint() {
  const hidden = useSyncExternalStore(subscribe, seen, () => true);
  if (hidden) return null;
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-2xl bg-brand-softer px-3 py-2 text-sm"
      data-testid="status-hint"
    >
      <HiOutlineInformationCircle className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
      <span className="flex-1">
        <strong>«Borrador»</strong>: lo estás revisando; se descarga con la marca «Borrador».{" "}
        <strong>«Listo»</strong>: ya lo revisaste; se descarga limpio.
      </span>
      <button
        type="button"
        aria-label="Entendido, no volver a mostrar"
        className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-brand-soft"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // Sin almacenamiento se vuelve a mostrar la próxima vez.
          }
          listeners.forEach((l) => l());
        }}
      >
        <HiOutlineXMark className="size-5" aria-hidden />
      </button>
    </p>
  );
}
