import type { Figure } from "@/lib/figures/schema";
import { drawFigure, figureDataUri } from "@/lib/figures/svg";

/**
 * SPEC-0023 RN-05 / ADR-0018: la figura de una pregunta tipo Saber. El SVG se muestra como imagen
 * (`img` con `data:`), nunca como HTML: el texto del modelo no puede inyectar nada. El texto
 * alternativo describe la figura para lectores de pantalla.
 */
export function FigureImage({ figure, className }: { figure: Figure; className?: string }) {
  const drawing = drawFigure(figure);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG en data: generado en el cliente
    <img
      src={figureDataUri(drawing)}
      alt={drawing.alt}
      width={drawing.width}
      height={drawing.height}
      data-testid="figure"
      className={className ?? "h-auto max-w-full rounded-lg border border-border bg-white"}
    />
  );
}
