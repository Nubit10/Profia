"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { HiOutlineArrowTopRightOnSquare, HiOutlineBookOpen } from "react-icons/hi2";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// SPEC-0014 CA-0014-12 (F-03): cada etiqueta "DBA n" se abre en el sitio y muestra el número, el
// enunciado, las evidencias y la fuente oficial. El texto sale siempre de la base (RN-01), nunca
// del modelo: la ficha recibe el DBA ya leído del catálogo o lo busca por código en el contexto.

/** Lo que la ficha necesita de un DBA. `CurriculumReference` y `PlanningLink` encajan tal cual. */
export type DbaInfo = {
  code: string;
  number: number;
  statement: string;
  evidences: string[];
  component?: string | null;
  superseded?: boolean;
  citation: {
    issuer?: string;
    title: string;
    version: string;
    year: number;
    page: number;
    url: string;
    reviewed?: boolean;
  };
};

const DbaCatalogContext = createContext<Map<string, DbaInfo> | null>(null);

/** Pone a la mano los DBA del curso para que `<DbaChip code="…">` encuentre su ficha. */
export function DbaCatalogProvider({
  references,
  children,
}: {
  references: readonly DbaInfo[];
  children: ReactNode;
}) {
  const parent = useContext(DbaCatalogContext);
  const catalog = useMemo(() => {
    const map = new Map(parent ?? []);
    for (const r of references) map.set(r.code, r);
    return map;
  }, [parent, references]);
  return <DbaCatalogContext.Provider value={catalog}>{children}</DbaCatalogContext.Provider>;
}

export function useDbaCatalog() {
  return useContext(DbaCatalogContext);
}

function sourceHref(citation: DbaInfo["citation"]) {
  return `${citation.url}#page=${citation.page}`;
}

/**
 * Botón "DBA n" que abre la ficha del DBA (hoja inferior en el teléfono). Escape, Atrás o la X la
 * cierran (`Dialog` usa `useBackToClose`). Si el DBA no está a la mano, queda solo la etiqueta.
 */
export function DbaChip({
  dba,
  code,
  number,
  className,
  children,
}: {
  /** El DBA ya leído (p. ej. el vínculo de un objetivo, con sus evidencias elegidas). */
  dba?: DbaInfo;
  /** O el código, para buscarlo en `DbaCatalogProvider`. */
  code?: string;
  /** Número de respaldo si el código no está en el catálogo. */
  number?: number;
  className?: string;
  /** Texto del botón; por omisión "DBA n". */
  children?: ReactNode;
}) {
  const catalog = useDbaCatalog();
  const info = dba ?? (code ? catalog?.get(code) : undefined);
  const [open, setOpen] = useState(false);
  const label = children ?? `DBA ${info?.number ?? number ?? "?"}`;

  const pill =
    "inline-flex items-center gap-1 rounded-full border border-brand-border bg-brand-softer px-2 py-0.5 text-xs font-medium text-brand-strong";
  const chipClass = cn(pill, className);

  if (!info) {
    return (
      <span className={cn(chipClass, "border-border bg-muted text-muted-foreground")}>{label}</span>
    );
  }

  return (
    <>
      {/* En el celular el botón mide 44 px de alto (área táctil) pero se ve la ficha compacta:
          el margen negativo evita que el área invisible separe las líneas. */}
      <button
        type="button"
        className={cn(
          "group/dba inline-flex cursor-pointer items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-sm:-my-2.5 max-sm:min-h-11",
          className,
        )}
        aria-haspopup="dialog"
        aria-label={`DBA ${info.number}: ver enunciado, evidencias y fuente`}
        onClick={(event) => {
          // La etiqueta puede estar dentro de una fila clicable o de un <label>.
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <span className={cn(pill, "transition-colors group-hover/dba:bg-brand-soft")}>
          <HiOutlineBookOpen className="size-3.5 shrink-0" aria-hidden />
          {label}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dba-sheet">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
              DBA {info.number}
              {info.component && (
                <span className="text-xs font-normal text-muted-foreground">
                  · {info.component}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-base text-foreground">
              {info.statement}
            </DialogDescription>
          </DialogHeader>
          {info.superseded && (
            <p className="rounded-md bg-warning-soft p-2 text-xs text-warning">
              Este DBA es de una versión anterior del MEN. El vínculo se conserva.
            </p>
          )}
          {info.evidences.length > 0 && (
            <section aria-labelledby={`dba-ev-${info.code}`} className="flex flex-col gap-1.5">
              <h3 id={`dba-ev-${info.code}`} className="text-sm font-medium">
                Evidencias de aprendizaje
              </h3>
              <ul className="ml-4 flex list-disc flex-col gap-1 text-sm">
                {info.evidences.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>
          )}
          <section className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
            <h3 className="font-medium text-foreground">Fuente</h3>
            <p>
              {info.citation.issuer ? `${info.citation.issuer} · ` : ""}
              {info.citation.title}, {info.citation.version} ({info.citation.year}) · pág.{" "}
              {info.citation.page}
            </p>
            {info.citation.reviewed === false && <p>Pendiente de revisión docente.</p>}
            <a
              href={sourceHref(info.citation)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 underline max-sm:min-h-11"
            >
              Abrir el documento del MEN
              <HiOutlineArrowTopRightOnSquare className="size-3" aria-hidden />
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Lista de chips para varios códigos (temas, propuestas, ítems de un recurso). */
export function DbaChips({
  codes,
  className,
  label = "DBA",
}: {
  codes: readonly string[];
  className?: string;
  label?: string;
}) {
  if (codes.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label={label}>
      {codes.map((c) => (
        <li key={c}>
          <DbaChip code={c} />
        </li>
      ))}
    </ul>
  );
}
