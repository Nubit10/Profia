"use client";

import Link from "next/link";
import { HiCheck, HiChevronLeft } from "react-icons/hi2";
import { cn } from "@/lib/utils";

/**
 * Pasos de un flujo (patrón de CliqCut, `BookingWizard`).
 * - Celular: "Atrás", "Paso 2 de 3 · Curso y tema", una barra de progreso y puntos que se alargan al
 *   avanzar. Nunca hay una fila de nombres que se corte ni pasos a medias en el borde.
 * - Escritorio: la fila completa con el número y el nombre de cada paso; los hechos son enlaces.
 */
export function Stepper({
  labels,
  current,
  hrefFor,
  className,
}: {
  labels: readonly string[];
  /** Índice del paso activo (desde 0). */
  current: number;
  /** Enlace de un paso ya hecho, para volver a él; null si no se puede. */
  hrefFor?: (index: number) => string | null;
  className?: string;
}) {
  const total = labels.length;
  const back = current > 0 ? (hrefFor?.(current - 1) ?? null) : null;
  const progress = ((current + 1) / total) * 100;

  return (
    <nav aria-label="Pasos" className={className}>
      {/* Celular */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex min-h-11 items-center justify-between gap-3">
          {back ? (
            <Link
              href={back}
              className="-ml-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <HiChevronLeft className="size-4" aria-hidden />
              Atrás
            </Link>
          ) : (
            <span />
          )}
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
      </div>

      {/* Escritorio */}
      <ol className="hidden items-center gap-2 sm:flex">
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
              <span
                className={cn(
                  "text-sm font-semibold whitespace-nowrap",
                  !active && "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </>
          );
          return (
            <li key={label} className="flex items-center gap-2">
              {target ? (
                <Link
                  href={target}
                  className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-muted"
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
              {index < total - 1 && <span aria-hidden className="h-px w-10 bg-border" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
