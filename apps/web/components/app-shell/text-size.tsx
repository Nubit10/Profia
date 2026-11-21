"use client";

import { useSyncExternalStore } from "react";

const KEY = "profia:letra";
const listeners = new Set<() => void>();

function read(): boolean {
  return document.documentElement.dataset.letra === "grande";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Bloque 8 de usabilidad: "Letra más grande" para docentes que la necesitan. Es una preferencia
 * del dispositivo (no de la cuenta): se guarda en el navegador y se aplica antes de pintar
 * (`TEXT_SIZE_SCRIPT` en `app/layout.tsx`). Se elige en Ajustes.
 */
export function useLargeText(): [boolean, (large: boolean) => void] {
  const large = useSyncExternalStore(subscribe, read, () => false);
  const set = (next: boolean) => {
    if (next) document.documentElement.dataset.letra = "grande";
    else delete document.documentElement.dataset.letra;
    try {
      if (next) localStorage.setItem(KEY, "grande");
      else localStorage.removeItem(KEY);
    } catch {
      // Sin almacenamiento, vale solo para esta visita.
    }
    listeners.forEach((l) => l());
  };
  return [large, set];
}
