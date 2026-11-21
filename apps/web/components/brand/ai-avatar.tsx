import { cn } from "@/lib/utils";

// El avatar de la IA de Profe: un foco de líneas con tres destellos, sin fondo (elegido por el
// usuario el 2026-11-21; antes era un cerebro, que a 14–18 px no se leía). Marca todo lo que hace la
// IA (crear, proponer, sugerir). Vidrio y base de la marca, destellos azul violeta; blanco sobre los
// botones con degradado o de color. Solo tokens de color (CA-0012-17) y sin ids en el SVG.

type Tone =
  /** Colores de la marca: sobre fondos claros. */
  | "brand"
  /** Blanco: sobre botones con degradado o fondos oscuros. */
  | "light";

/** Vidrio del foco y su base. */
const BULB = [
  "M12 6.2a4.9 4.9 0 0 0-2.95 8.8c.5.38.75.95.75 1.57v.63h4.4v-.63c0-.62.25-1.19.75-1.57A4.9 4.9 0 0 0 12 6.2Z",
  "M10.2 20.5h3.6",
];
/** Tres destellos arriba: la idea encendida. */
const RAYS = ["M12 2v1.6", "M5.2 4.8l1.1 1.1", "M18.8 4.8l-1.1 1.1"];

const BULB_COLOR = "var(--brand)";
const RAYS_COLOR = "color-mix(in oklab, var(--info) 55%, var(--brand))";

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
  const strokeWidth = size >= 40 ? 1.4 : size <= 16 ? 2 : 1.75;
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
        {group(BULB, BULB_COLOR)}
        {group(RAYS, RAYS_COLOR)}
      </svg>
    </span>
  );
}

/** El avatar donde se espera un ícono de React Icons (menús, pasos del tutorial). */
export function AiIcon({ className, size }: { className?: string; size?: string | number }) {
  return <AiAvatar size={typeof size === "number" ? size : 18} className={className} />;
}
