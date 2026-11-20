"use client";

import Link from "next/link";
import { HiCheck, HiOutlinePencil } from "react-icons/hi2";
import { ScrollableRow } from "@/components/scrollable-row";
import { cn } from "@/lib/utils";

/**
 * Pasos de un flujo (patrón de CliqCut, `BookingWizard`).
 * - Celular: "Paso 2 de 3 · Curso", una barra de progreso y puntos que se alargan al
 *   avanzar. Nunca hay una fila de nombres que se corte ni pasos a medias en el borde.
 * - Escritorio: la fila completa con el número y el nombre de cada paso; los hechos son enlaces.
 * - SPEC-0019: con `values`, cada paso hecho muestra lo elegido (p. ej. el curso) y tocarlo lo cambia;
 *   en el celular, lo elegido va en una fila de fichas que se desliza de lado, con flechas. Así no hace falta una tarjeta de resumen.
 *   Volver al paso anterior va en el encabezado de la página (`PageHeader` con `back`), no aquí.
 */
export function Stepper({
  labels,
  current,
  hrefFor,
  values,
  className,
}: {
  labels: readonly string[];
  /** Índice del paso activo (desde 0). */
  current: number;
  /** Enlace de un paso ya hecho, para volver a él; null si no se puede. */
  hrefFor?: (index: number) => string | null;
  /** Lo elegido en cada paso hecho (null si no aplica). */
  values?: readonly (string | null)[];
  className?: string;
}) {
  const total = labels.length;
  const progress = ((current + 1) / total) * 100;
  const chosen = labels
    .map((label, index) => ({ label, index, value: values?.[index] ?? null }))
    .filter((c) => c.index < current && c.value);

  return (
    <nav aria-label="Pasos" className={className}>
      {/* Celular */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground" aria-current="step">
            Paso {current + 1} de {total} ·{" "}
            <span className="font-semibold text-foreground">{labels[current]}</span>
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Avance"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={current + 1}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-brand-gradient transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div aria-hidden className="flex justify-center gap-1.5">
          {labels.map((label, i) => (
            <span
              key={label}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i <= current ? "w-4 bg-brand" : "w-2 bg-border",
              )}
            />
          ))}
        </div>
        {chosen.length > 0 && (
          // SPEC-0019: una sola fila que se desliza de lado, con flechas (como los filtros).
          <ScrollableRow
            label="Lo que elegiste"
            role="group"
            className="-mx-4"
            rowClassName="gap-2 px-4"
          >
            {chosen.map(({ label, index, value }) => {
              const target = hrefFor?.(index) ?? null;
              const chip = (
                <>
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="max-w-56 truncate font-semibold">{value}</span>
                  {target && (
                    <HiOutlinePencil className="size-3.5 shrink-0 text-brand-strong" aria-hidden />
                  )}
                </>
              );
              const chipClass =
                "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm whitespace-nowrap";
              return target ? (
                <Link
                  key={label}
                  href={target}
                  aria-label={`Cambiar ${label.toLowerCase()}: ${value}`}
                  className={chipClass}
                >
                  {chip}
                </Link>
              ) : (
                <span key={label} className={chipClass}>
                  {chip}
                </span>
              );
            })}
          </ScrollableRow>
        )}
      </div>

      {/* Escritorio */}
      <div className="hidden sm:block">
        <ol className="flex flex-wrap items-center gap-2">
          {labels.map((label, index) => {
            const done = index < current;
            const active = index === current;
            const target = done ? (hrefFor?.(index) ?? null) : null;
            const content = (
              <>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    done && "bg-brand text-white",
                    active && "bg-brand-gradient text-white shadow-lift",
                    !done && !active && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <HiCheck aria-hidden /> : index + 1}
                  {done && <span className="sr-only">(hecho)</span>}
                </span>
                {done && values?.[index] ? (
                  <span className="flex min-w-0 flex-col text-left leading-tight">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span
                      className="max-w-40 truncate text-sm font-semibold"
                      title={values[index]!}
                    >
                      {values[index]}
                    </span>
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-sm font-semibold whitespace-nowrap",
                      !active && "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                )}
              </>
            );
            return (
              <li key={label} className="flex min-w-0 items-center gap-2">
                {target ? (
                  <Link
                    href={target}
                    title={values?.[index] ? `Cambiar ${label.toLowerCase()}` : undefined}
                    className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-muted"
                  >
                    {content}
                  </Link>
                ) : (
                  <span
                    className="flex items-center gap-2 py-1 pr-3 pl-1"
                    aria-current={active ? "step" : undefined}
                  >
                    {content}
                  </span>
                )}
                {index < total - 1 && (
                  <span aria-hidden className="h-px w-4 shrink-0 bg-border xl:w-8" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
