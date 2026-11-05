"use client";

import Link from "next/link";
import {
  HiCheck,
  HiOutlineArrowDownTray,
  HiOutlineArrowRight,
  HiOutlineBookOpen,
  HiOutlinePencilSquare,
  HiOutlineSparkles,
  HiXMark,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RESOURCE_TYPE_LABELS,
  type FirstStepKey,
  type FirstSteps,
} from "@/modules/resources/client";

type StepView = { title: string; text: string; cta: string; href: string | null; icon: IconType };

const ORDER: FirstStepKey[] = ["COURSE", "TOPIC", "RESOURCE", "DOWNLOAD"];

/** Texto y destino de cada paso (SPEC-0013 RN-02). `href: null` abre el diálogo de curso. */
function stepView(key: FirstStepKey, steps: FirstSteps): StepView {
  switch (key) {
    case "COURSE":
      return {
        title: "Crea tu curso",
        text: "Asignatura, grado y grupo. Toma menos de un minuto.",
        cta: "Crear mi primer curso",
        href: null,
        icon: HiOutlineBookOpen,
      };
    case "TOPIC":
      return {
        title: "Escribe tu primer tema",
        text: steps.courseTitle
          ? `El tema que vas a enseñar en ${steps.courseTitle}. Lo escribes al crear tu taller.`
          : "El tema que vas a enseñar. Lo escribes al crear tu taller.",
        cta: "Escribir mi primer tema",
        href: `/create?type=WORKSHOP${steps.courseId ? `&courseId=${steps.courseId}` : ""}`,
        icon: HiOutlinePencilSquare,
      };
    case "RESOURCE":
      return {
        title: "Crea tu primer taller con IA",
        text: steps.topicTitle
          ? `Para «${steps.topicTitle}». La IA lo prepara y tú lo revisas.`
          : "La IA lo prepara y tú lo revisas.",
        cta: "Crear mi primer taller",
        href:
          steps.courseId && steps.topicId
            ? `/create?type=WORKSHOP&courseId=${steps.courseId}&topicId=${steps.topicId}`
            : "/create?type=WORKSHOP",
        icon: HiOutlineSparkles,
      };
    case "DOWNLOAD":
      return {
        title: "Descárgalo en Word o PDF",
        text: steps.resource
          ? `${steps.resource.title}: la hoja del estudiante y la clave, listas para imprimir.`
          : "La hoja del estudiante y la clave, listas para imprimir.",
        cta: steps.resource
          ? `Abrir mi ${RESOURCE_TYPE_LABELS[steps.resource.type].toLowerCase()}`
          : "Ver mis recursos",
        href: steps.resource
          ? `/courses/${steps.resource.courseId}/resources/${steps.resource.id}`
          : "/resources",
        icon: HiOutlineArrowDownTray,
      };
  }
}

/**
 * SPEC-0013 RN-02 / CA-0013-02: un solo bloque con los cuatro primeros pasos y su progreso, en lugar
 * del tutorial y la tarjeta "Siguiente paso". Un solo botón principal: el del paso actual.
 */
export function FirstStepsCard({
  steps,
  onCreateCourse,
  onDismiss,
}: {
  steps: FirstSteps;
  onCreateCourse: () => void;
  onDismiss: () => void;
}) {
  const doneCount = ORDER.filter((k) => steps.done[k]).length;
  return (
    <section
      aria-labelledby="first-steps-title"
      data-testid="first-steps"
      className="relative overflow-hidden rounded-3xl border border-brand-border bg-card p-5 shadow-soft sm:p-8"
    >
      <div aria-hidden className="absolute inset-0 bg-hero opacity-80" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-sm font-bold text-brand-strong">
              <HiOutlineSparkles aria-hidden />
              {doneCount} de {ORDER.length} listos
            </p>
            <h2 id="first-steps-title" className="text-xl font-extrabold sm:text-2xl">
              Primeros pasos
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Ocultar primeros pasos"
            onClick={onDismiss}
          >
            <HiXMark className="size-5" aria-hidden />
          </Button>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Progreso de los primeros pasos"
          aria-valuemin={0}
          aria-valuemax={ORDER.length}
          aria-valuenow={doneCount}
        >
          <div
            className="h-full rounded-full bg-brand-gradient transition-transform motion-reduce:transition-none"
            style={{ width: `${(doneCount / ORDER.length) * 100}%` }}
          />
        </div>
        <ol className="flex flex-col gap-2" aria-label="Pasos">
          {ORDER.map((key, index) => {
            const view = stepView(key, steps);
            const done = steps.done[key];
            const current = steps.current === key;
            const Icon = view.icon;
            return (
              <li
                key={key}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:p-4",
                  current ? "border-brand-border bg-card" : "border-transparent",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      done
                        ? "bg-success-soft text-success"
                        : current
                          ? "bg-brand text-white"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <HiCheck className="size-5" /> : <Icon className="size-5" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("font-bold", done && "text-muted-foreground line-through")}>
                      <span className="sr-only">
                        {done ? "Hecho: " : current ? "Paso actual: " : "Pendiente: "}
                      </span>
                      {index + 1}. {view.title}
                    </span>
                    {current && <span className="text-sm text-muted-foreground">{view.text}</span>}
                  </span>
                </div>
                {current &&
                  (view.href ? (
                    <Link
                      href={view.href}
                      className={buttonVariants({ variant: "brand", size: "xl" })}
                    >
                      {view.cta}
                      <HiOutlineArrowRight aria-hidden />
                    </Link>
                  ) : (
                    <Button variant="brand" size="xl" onClick={onCreateCourse}>
                      {view.cta}
                      <HiOutlineArrowRight aria-hidden />
                    </Button>
                  ))}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
