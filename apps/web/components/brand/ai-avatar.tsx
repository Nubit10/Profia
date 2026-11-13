import { cn } from "@/lib/utils";

// El avatar de la IA de Profe: un cerebro de líneas, sin fondo (elegido por el usuario el
// 2026-11-13). Marca todo lo que hace la IA (crear, proponer, sugerir) en lugar del ícono genérico
// de destellos. Mitad izquierda azul violeta y derecha de la marca; blanco sobre los botones con
// degradado. Solo tokens de color (CA-0012-17) y sin ids en el SVG.

type Tone =
  /** Colores de la marca: sobre fondos claros. */
  | "brand"
  /** Blanco: sobre botones con degradado o fondos oscuros. */
  | "light";

// Hemisferio izquierdo (contorno y pliegues) y su reflejo.
const LEFT = [
  "M11.3 4.9 C10 3.7 7.8 4 7 5.6 C5.3 5.7 4.1 7.2 4.4 8.9 C3.2 9.7 2.9 11.4 3.8 12.6 C3 13.8 3.3 15.6 4.6 16.3 C4.7 18.1 6.3 19.4 8.1 19.1 C9 20.3 10.6 20.5 11.3 19.4 Z",
  "M7 5.6 C7.3 6.8 8.4 7.5 9.6 7.3",
  "M4.4 8.9 C5.4 9.7 6.9 9.6 7.7 8.7",
  "M3.8 12.6 C5 13.1 6.3 12.7 6.9 11.7",
  "M4.6 16.3 C5.8 16.1 6.7 15.2 6.9 14.1",
  "M8.1 19.1 C8.4 18 8.1 16.9 7.3 16.2",
  "M11.3 11.2 C10.2 11.3 9.3 12.1 9.1 13.2",
  "M11.3 15.6 C10.4 15.5 9.6 15.9 9.2 16.6",
];
const RIGHT = [
  "M 12.70 4.90 C 14.00 3.70 16.20 4.00 17.00 5.60 C 18.70 5.70 19.90 7.20 19.60 8.90 C 20.80 9.70 21.10 11.40 20.20 12.60 C 21.00 13.80 20.70 15.60 19.40 16.30 C 19.30 18.10 17.70 19.40 15.90 19.10 C 15.00 20.30 13.40 20.50 12.70 19.40 Z",
  "M 17.00 5.60 C 16.70 6.80 15.60 7.50 14.40 7.30",
  "M 19.60 8.90 C 18.60 9.70 17.10 9.60 16.30 8.70",
  "M 20.20 12.60 C 19.00 13.10 17.70 12.70 17.10 11.70",
  "M 19.40 16.30 C 18.20 16.10 17.30 15.20 17.10 14.10",
  "M 15.90 19.10 C 15.60 18.00 15.90 16.90 16.70 16.20",
  "M 12.70 11.20 C 13.80 11.30 14.70 12.10 14.90 13.20",
  "M 12.70 15.60 C 13.60 15.50 14.40 15.90 14.80 16.60",
];

const LEFT_COLOR = "color-mix(in oklab, var(--info) 55%, var(--brand))";
const RIGHT_COLOR = "var(--brand)";

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
  const light = tone === "light";
  // Trazo más fino en tamaños grandes; en los pequeños, más grueso para que se lea.
  const strokeWidth = size >= 40 ? 1.25 : 1.6;
  const group = (paths: string[], color: string) => (
    <g style={{ stroke: light ? "var(--card)" : color }}>
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
  return (
    <span
      data-slot="ai-avatar"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* `size-full`: los botones fuerzan el tamaño de los svg sin clase de tamaño. */}
      <svg
        viewBox="0 0 24 24"
        className="size-full"
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {group(LEFT, LEFT_COLOR)}
        {group(RIGHT, RIGHT_COLOR)}
      </svg>
    </span>
  );
}

/** El avatar donde se espera un ícono de React Icons (menús, pasos del tutorial). */
export function AiIcon({ className, size }: { className?: string; size?: string | number }) {
  return <AiAvatar size={typeof size === "number" ? size : 18} className={className} />;
}
