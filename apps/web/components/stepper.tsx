"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { HiCheck } from "react-icons/hi2";
import { cn } from "@/lib/utils";

/**
 * Pasos de un flujo en una sola fila. En el celular la fila se desliza sola hasta el paso activo
 * (sin barra visible), así nunca se parte en dos líneas ni queda el paso actual fuera de la vista.
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
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = list.current;
    const active = el?.querySelector<HTMLElement>("[data-step-active]");
    if (!el || !active) return;
    // Centra el paso activo moviendo solo la fila (scrollIntoView movería también la página).
    const left = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [current]);

  return (
    <ol
      ref={list}
      aria-label="Pasos"
      className={cn(
        // Borde desvanecido en el celular: se nota que la fila sigue y se puede deslizar.
        "-mx-4 flex snap-x [scrollbar-width:none] items-center gap-1 overflow-x-auto px-4 max-sm:[mask-image:linear-gradient(to_right,transparent,#000_1rem,#000_calc(100%-1rem),transparent)] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
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
          <li
            key={label}
            className="flex shrink-0 snap-center items-center gap-1"
            data-step-active={active ? "" : undefined}
          >
            {target ? (
              <Link
                href={target}
                className="flex min-h-11 items-center gap-2 rounded-full pr-3 pl-1 hover:bg-muted"
              >
                {content}
              </Link>
            ) : (
              <span
                className="flex min-h-11 items-center gap-2 pr-3 pl-1"
                aria-current={active ? "step" : undefined}
              >
                {content}
              </span>
            )}
            {index < labels.length - 1 && (
              <span aria-hidden className="h-px w-5 shrink-0 bg-border sm:w-10" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
