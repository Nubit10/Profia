import { Badge } from "@/components/ui/badge";
import { FigureImage } from "@/components/figure-image";
import type { Figure } from "@/lib/figures/schema";

/** SPEC-0023 RN-06: situación, figura y competencia de una pregunta tipo Saber (antes del enunciado). */
export function SaberContext({ context, figure }: { context?: string; figure?: Figure }) {
  if (!context && !figure) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="saber-context">
      {context && (
        <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm whitespace-pre-line">
          {context}
        </p>
      )}
      {figure && <FigureImage figure={figure} />}
    </div>
  );
}

export function CompetencyBadge({ competency }: { competency?: string }) {
  if (!competency) return null;
  return (
    <Badge variant="outline" className="h-auto max-w-full whitespace-normal">
      Competencia: {competency}
    </Badge>
  );
}
