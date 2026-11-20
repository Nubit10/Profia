"use client";

import { cn } from "@/lib/utils";

/**
 * Interruptor con título y una línea que explica qué cambia (patrón del DUA, SPEC-0016). Es un
 * `role="switch"` con su estado anunciado; el bloque entero no es clicable para no confundir.
 */
export function OptionSwitch({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-border bg-brand-softer p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span id={`${id}-label`} className="font-bold">
          {label}
        </span>
        <span id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
        onClick={() => onChange(!checked)}
        // Prueba de usabilidad: el área táctil es de 44 × 56 px; el riel se ve igual que antes.
        className="group -my-2 flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none"
      >
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full border-2 border-transparent transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring",
            checked ? "bg-brand" : "bg-muted-foreground/40",
          )}
        >
          <span
            className={cn(
              "inline-block size-6 rounded-full bg-white shadow transition-transform",
              checked ? "translate-x-5" : "translate-x-0",
            )}
          />
        </span>
      </button>
    </div>
  );
}

/** SPEC-0023: textos del interruptor del estilo Saber, iguales en quiz y examen. */
export const SABER_SWITCH = {
  label: "Estilo Saber (ICFES)",
  help: "Cada pregunta de selección múltiple parte de una situación, evalúa una competencia de las pruebas Saber y, en Matemáticas, puede traer una figura (recta, gráfica, tabla).",
};
