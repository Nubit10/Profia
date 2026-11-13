"use client";

import type { ReactNode } from "react";
import { HiCheck } from "react-icons/hi2";
import { cn } from "@/lib/utils";

// Profe no usa casillas de verificación sueltas: cada opción es un botón seleccionable que se toca
// entero (44 px en el celular) y muestra su estado con color y un círculo con check. Para lectores
// de pantalla siguen siendo casillas (`role="checkbox"` + `aria-checked`).

type Base = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
};

function Indicator({ checked, size = "md" }: { checked: boolean; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        size === "sm" ? "size-4" : "size-5",
        checked ? "border-brand bg-brand text-white" : "border-muted-foreground/40 bg-card",
      )}
    >
      {checked && <HiCheck className={size === "sm" ? "size-2.5" : "size-3"} strokeWidth={1} />}
    </span>
  );
}

/** Opción completa: el texto va dentro del botón. Para listas de elección múltiple o un sí/no. */
export function SelectableOption({
  checked,
  onCheckedChange,
  disabled,
  invalid,
  id,
  className,
  children,
  description,
  size = "md",
}: Base & { children: ReactNode; description?: ReactNode; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group flex w-full cursor-pointer items-start gap-3 rounded-xl border text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "min-h-10 px-2.5 py-2 text-xs" : "min-h-11 px-3 py-2.5 text-sm",
        checked
          ? "border-brand bg-brand-softer"
          : "border-border bg-card hover:border-brand-border hover:bg-brand-softer/60",
        invalid && !checked && "border-danger",
        className,
      )}
    >
      <span className={size === "sm" ? "mt-px" : "mt-0.5"}>
        <Indicator checked={checked} size={size} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
        <span className={cn(checked && "font-medium")}>{children}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
    </button>
  );
}

/**
 * Botón redondo de "incluir" junto a un campo editable (propuestas de la IA). El nombre va en
 * `label` porque el botón no tiene texto visible.
 */
export function SelectToggle({
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
  label,
}: Base & { label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      aria-label={label}
      title={checked ? "Incluido: toca para quitarlo" : "Quitado: toca para incluirlo"}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "hover:bg-brand-softer" : "hover:bg-muted",
        className,
      )}
    >
      <Indicator checked={checked} />
    </button>
  );
}
