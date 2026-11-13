import { cn } from "@/lib/utils";

// El avatar de la IA de Profe: una carita amable con visor y una chispa por antena. Marca todo lo
// que hace la IA (crear, proponer, sugerir) en lugar del ícono genérico de destellos.
// Sin identificadores en el SVG: el degradado es el fondo CSS de la marca, así puede repetirse en
// la misma página sin ids duplicados.

type Tone =
  /** Degradado de la marca con la cara blanca: sobre fondos claros. */
  | "brand"
  /** Fondo blanco con la cara de la marca: sobre botones con degradado o fondos oscuros. */
  | "light";

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
  const face = tone === "brand" ? "var(--card)" : "var(--brand-strong)";
  const eyes = tone === "brand" ? "var(--brand-strong)" : "var(--card)";
  return (
    <span
      data-slot="ai-avatar"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[38%] shadow-sm",
        tone === "brand" ? "bg-brand-gradient" : "bg-card",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* `size-full`: los botones fuerzan el tamaño de los svg sin clase de tamaño. */}
      <svg viewBox="0 0 24 24" className="size-full" fill="none" aria-hidden>
        {/* Chispa por antena */}
        <path d="M12 2.2l.75 1.6 1.6.75-1.6.75L12 6.9l-.75-1.6-1.6-.75 1.6-.75z" fill={face} />
        {/* Visor */}
        <rect x="4.2" y="8" width="15.6" height="9.4" rx="4.7" fill={face} />
        {/* Ojos */}
        <ellipse cx="9.3" cy="12.7" rx="1.45" ry="1.85" fill={eyes} />
        <ellipse cx="14.7" cy="12.7" rx="1.45" ry="1.85" fill={eyes} />
        {/* Sonrisa */}
        <path d="M10 19.6c1.2.9 2.8.9 4 0" stroke={face} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** El avatar donde se espera un ícono de React Icons (menús, pasos del tutorial). */
export function AiIcon({ className, size }: { className?: string; size?: string | number }) {
  return <AiAvatar size={typeof size === "number" ? size : 18} className={className} />;
}
