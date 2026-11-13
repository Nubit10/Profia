import { cn } from "@/lib/utils";

// El avatar de la IA de Profe: una pila de tres libros en los tonos de la marca, dentro de un
// círculo suave (elegido por el usuario el 2026-11-13). Marca todo lo que hace la IA (crear,
// proponer, sugerir) en lugar del ícono genérico de destellos. Solo tokens de color (CA-0012-17)
// y sin ids en el SVG, así puede repetirse en la misma página.

type Tone =
  /** Círculo lila suave: sobre fondos claros. */
  | "brand"
  /** Círculo blanco: sobre botones con degradado o fondos oscuros. */
  | "light";

const TOP = "color-mix(in oklab, var(--brand) 55%, var(--card))";
const MIDDLE = "var(--brand)";
const BOTTOM = "color-mix(in oklab, var(--brand-strong) 82%, var(--foreground))";
const PAGES = "var(--card)";

export function AiAvatar({
  size = 20,
  tone = "brand",
  className,
  label,
}: {
  size?: number;
  tone?: Tone;
  className?: string;
  /** Nombre accesible; sin él es decorativo (el texto del botón ya dice qué hace). */
  label?: string;
}) {
  return (
    <span
      data-slot="ai-avatar"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        tone === "brand" ? "bg-brand-soft" : "bg-card",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* `size-full`: los botones fuerzan el tamaño de los svg sin clase de tamaño. */}
      <svg viewBox="0 0 24 24" className="size-full" fill="none" aria-hidden>
        {/* Libro de arriba, un poco girado */}
        <g transform="rotate(-8 12 7.6)">
          <rect x="5.6" y="4.6" width="13.4" height="4" rx="1.1" style={{ fill: TOP }} />
          <rect x="8" y="5.75" width="10.4" height="1.7" rx=".5" style={{ fill: PAGES }} />
        </g>
        {/* Libro del medio */}
        <rect x="4.2" y="9.9" width="15.4" height="4.4" rx="1.2" style={{ fill: MIDDLE }} />
        <rect x="6.6" y="11.1" width="12.4" height="2" rx=".5" style={{ fill: PAGES }} />
        {/* Libro de abajo */}
        <rect x="3.4" y="15.2" width="16.8" height="4.6" rx="1.2" style={{ fill: BOTTOM }} />
        <rect x="5.8" y="16.45" width="13.8" height="2.1" rx=".5" style={{ fill: PAGES }} />
      </svg>
    </span>
  );
}

/** El avatar donde se espera un ícono de React Icons (menús, pasos del tutorial). */
export function AiIcon({ className, size }: { className?: string; size?: string | number }) {
  return <AiAvatar size={typeof size === "number" ? size : 18} className={className} />;
}
