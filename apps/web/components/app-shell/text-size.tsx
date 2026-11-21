"use client";

import { useSyncExternalStore } from "react";
import { RiFontSize2 } from "react-icons/ri";

const KEY = "profe:letra";
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
 * del dispositivo (no de la cuenta): se guarda en el navegador y se aplica antes de pintar.
 */
export function TextSizeToggle({ className }: { className?: string }) {
  const large = useSyncExternalStore(subscribe, read, () => false);
  const toggle = () => {
    const next = !large;
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
  return (
    <button type="button" aria-pressed={large} onClick={toggle} className={className}>
      <RiFontSize2 className="size-[18px] text-brand" aria-hidden />
      <span className="flex-1">Letra más grande</span>
      <span
        aria-hidden
        className={
          large
            ? "rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground"
            : "rounded-full bg-muted px-2 text-[11px] font-bold text-muted-foreground"
        }
      >
        {large ? "Sí" : "No"}
      </span>
    </button>
  );
}
