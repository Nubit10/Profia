"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineArchiveBox,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineDocumentDuplicate,
  HiOutlineEllipsisHorizontal,
  HiOutlineExclamationTriangle,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { StatusBadge } from "@/components/resource-list";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/action-result";
import { hasAnswerSheet } from "@/modules/documents/client";
import {
  RESOURCE_TYPE_LABELS,
  examTotalPoints,
  type ExamContent,
  type QuizContent,
  type ResourceDetail,
  type ResourceStatus,
  type WorkshopContent,
} from "@/modules/resources/client";
import { useRun } from "../../planning/use-run";
import { Downloads } from "./downloads";
import { ExamEditor } from "./exam-editor";
import { GradingScalePanel } from "./grading-scale";
import { ResourceRating, type FeedbackActions } from "./item-tools";
import { QuizEditor } from "./quiz-editor";
import { WorkshopEditor } from "./workshop-editor";

const FAILURE_MESSAGES = {
  unavailable: "La IA no está disponible en este momento. Intenta más tarde.",
  invalid:
    "La IA no logró un resultado que cumpla con lo que pediste. Intenta de nuevo o cambia los ajustes.",
  interrupted: "La creación se interrumpió antes de terminar. Intenta de nuevo.",
} as const;

export type ResourceActions = FeedbackActions & {
  status: (input: { resourceId: string }) => Promise<ActionResult<{ status: ResourceStatus }>>;
  retry: (input: { resourceId: string }) => Promise<ActionResult<{ id: string }>>;
  save: (input: {
    resourceId: string;
    version: number;
    content: unknown;
  }) => Promise<ActionResult<{ version: number }>>;
  setStatus: (input: {
    resourceId: string;
    status: "READY" | "DRAFT" | "ARCHIVED" | "RESTORE";
  }) => Promise<ActionResult>;
  duplicate: (input: { resourceId: string }) => Promise<ActionResult<{ id: string }>>;
  /** SPEC-0011 RN-14: escala de notas de la clave del examen. */
  gradingScale: (input: {
    resourceId: string;
    passingGrade: number;
    passingPoints: number | null;
  }) => Promise<ActionResult>;
};

/** ADR-0008 §3: mientras se genera, la página consulta el estado cada pocos segundos. */
function useGenerationPolling(
  resourceId: string,
  active: boolean,
  check: ResourceActions["status"],
) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      const result = await check({ resourceId });
      if (result.ok && result.data!.status !== "GENERATING") router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [active, check, resourceId, router]);
}

function Editor({ resource, actions }: { resource: ResourceDetail; actions: ResourceActions }) {
  const router = useRouter();
  const initial = resource.data!;
  const [content, setContent] = useState(initial.content);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(content) !== JSON.stringify(initial.content);
  const savedKeys = useMemo(
    () =>
      new Set<string>(
        initial.type === "QUIZ"
          ? initial.content.questions.map((q) => q.id)
          : initial.type === "EXAM"
            ? initial.content.sections.flatMap((s) => s.questions.map((q) => q.id))
            : initial.content.moments.flatMap((m) => m.activities.map((a) => a.id)),
      ),
    [initial],
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    const result = await actions.save({
      resourceId: resource.id,
      version: resource.version,
      content,
    });
    setSaving(false);
    if (!result.ok) {
      sileo.error({ title: "No pudimos guardar", description: result.error });
      return;
    }
    sileo.success({ title: "Cambios guardados", description: `Versión ${result.data!.version}` });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      {initial.type === "QUIZ" ? (
        <QuizEditor
          resource={resource}
          content={content as QuizContent}
          onChange={setContent}
          dirty={dirty}
          savedKeys={savedKeys}
          actions={actions}
        />
      ) : initial.type === "EXAM" ? (
        <ExamEditor
          resource={resource}
          content={content as ExamContent}
          onChange={setContent}
          dirty={dirty}
          savedKeys={savedKeys}
          actions={actions}
        />
      ) : (
        <WorkshopEditor
          resource={resource}
          content={content as WorkshopContent}
          onChange={setContent}
          dirty={dirty}
          savedKeys={savedKeys}
          actions={actions}
        />
      )}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:shadow-soft">
        <Button type="button" disabled={!dirty || saving} onClick={save}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
        {dirty && (
          <>
            <Button type="button" variant="ghost" onClick={() => setContent(initial.content)}>
              Descartar cambios
            </Button>
            <span className="text-sm text-muted-foreground">Tienes cambios sin guardar.</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Mensajes mientras la IA trabaja (CA-0012-11): dicen qué pasa, no solo que espere. */
const PROGRESS_STEPS = [
  "Leyendo el tema y los objetivos que elegiste…",
  "Buscando los DBA que corresponden…",
  "Redactando el contenido…",
  "Revisando que cumpla con la estructura y el nivel…",
];
// SPEC-0011 RN-10: el examen se arma sección por sección.
const EXAM_PROGRESS_STEPS = [
  "Leyendo los temas y los objetivos del examen…",
  "Repartiendo los temas y los niveles entre las secciones…",
  "Redactando las preguntas, sección por sección…",
  "Revisando puntos, criterios y que cada tema tenga su pregunta…",
];

function GenerationProgress({ type }: { type: ResourceDetail["type"] }) {
  const [index, setIndex] = useState(0);
  const steps = type === "EXAM" ? EXAM_PROGRESS_STEPS : PROGRESS_STEPS;
  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
      type === "EXAM" ? 15000 : 6000,
    );
    return () => clearInterval(timer);
  }, [steps.length, type]);
  const label = RESOURCE_TYPE_LABELS[type].toLowerCase();
  return (
    <div
      className="flex flex-col gap-5 rounded-3xl border border-brand-border bg-card p-6 shadow-soft sm:p-8"
      role="status"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lift">
          <HiOutlineSparkles className="size-6 motion-safe:animate-pulse" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-extrabold">Estamos creando tu {label}</p>
          <p className="text-muted-foreground" aria-live="polite">
            {steps[index]}
          </p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-brand-soft" aria-hidden>
        <div className="h-full w-1/3 rounded-full bg-brand-gradient motion-safe:animate-[progress_1.6s_ease-in-out_infinite]" />
      </div>
      <p className="text-sm text-muted-foreground">
        {type === "EXAM"
          ? "Un examen suele tardar uno o dos minutos."
          : "Suele tardar menos de un minuto."}{" "}
        Puedes salir de esta página: lo encontrarás en Mis recursos.
      </p>
    </div>
  );
}

export function ResourceView({
  resource,
  actions,
}: {
  resource: ResourceDetail;
  actions: ResourceActions;
}) {
  const router = useRouter();
  const { run, isPending } = useRun();
  useGenerationPolling(resource.id, resource.status === "GENERATING", actions.status);
  const hasContent = !!resource.data;
  const label = RESOURCE_TYPE_LABELS[resource.type].toLowerCase();

  const duplicate = async () => {
    const result = await actions.duplicate({ resourceId: resource.id });
    if (!result.ok) {
      sileo.error({ title: "No pudimos duplicar", description: result.error });
      return;
    }
    sileo.success({ title: "Copia creada" });
    router.push(`/courses/${resource.courseId}/resources/${result.data!.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{RESOURCE_TYPE_LABELS[resource.type]}</Badge>
          <StatusBadge status={resource.status} />
          <span className="text-sm text-muted-foreground">
            {resource.type === "EXAM" ? "Temas" : "Tema"}: {resource.context.topic.title}
            {resource.model ? " · Generado con IA" : ""}
            {resource.version > 1 ? ` · Versión ${resource.version}` : ""}
          </span>
        </div>

        {hasContent && (resource.status === "DRAFT" || resource.status === "READY") && (
          <div className="flex flex-wrap items-center gap-2">
            {resource.status === "DRAFT" ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="border-success/40 text-success hover:bg-success-soft"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => actions.setStatus({ resourceId: resource.id, status: "READY" }),
                    "Recurso listo",
                  )
                }
              >
                <HiOutlineCheckCircle aria-hidden />
                Marcar como listo
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(() => actions.setStatus({ resourceId: resource.id, status: "DRAFT" }))
                }
              >
                Volver a borrador
              </Button>
            )}
            <Downloads
              courseId={resource.courseId}
              resourceId={resource.id}
              type={resource.type}
              version={resource.version}
              answerSheet={resource.data?.type === "EXAM" && hasAnswerSheet(resource.data.content)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Más acciones"
                className={buttonVariants({ variant: "ghost", size: "icon-lg" })}
              >
                <HiOutlineEllipsisHorizontal className="size-5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={isPending} onClick={duplicate}>
                  <HiOutlineDocumentDuplicate aria-hidden />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isPending}
                  onClick={() =>
                    run(
                      () => actions.setStatus({ resourceId: resource.id, status: "ARCHIVED" }),
                      "Recurso archivado",
                    )
                  }
                >
                  <HiOutlineArchiveBox aria-hidden />
                  Archivar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {resource.status === "GENERATING" && <GenerationProgress type={resource.type} />}

      {resource.status === "FAILED" && (
        <div
          className="flex flex-col gap-4 rounded-3xl border border-warning/30 bg-warning-soft p-6 sm:p-8"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <HiOutlineExclamationTriangle
              className="mt-0.5 size-6 shrink-0 text-warning"
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-extrabold">No pudimos crear tu {label}</p>
              <p>{FAILURE_MESSAGES[resource.failureReason ?? "unavailable"]}</p>
              <p className="text-sm text-muted-foreground">
                Este intento no se descuenta de tu cupo diario.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="lg"
              disabled={isPending}
              onClick={() => run(() => actions.retry({ resourceId: resource.id }))}
            >
              <HiOutlineArrowPath aria-hidden />
              Reintentar
            </Button>
            <Link
              href={`/courses/${resource.courseId}`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Volver al curso
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={isPending}
              onClick={() =>
                run(() => actions.setStatus({ resourceId: resource.id, status: "ARCHIVED" }))
              }
            >
              Archivar
            </Button>
          </div>
        </div>
      )}

      {resource.status === "ARCHIVED" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted p-4">
          <p className="text-sm">Este recurso está archivado: no aparece en tus listas.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              run(
                () => actions.setStatus({ resourceId: resource.id, status: "RESTORE" }),
                "Recurso restaurado",
              )
            }
          >
            Restaurar
          </Button>
        </div>
      )}

      {hasContent && (resource.status === "DRAFT" || resource.status === "READY") && (
        <>
          {resource.context.dba.length === 0 && (
            <p className="text-sm text-muted-foreground" role="note">
              Este recurso no cita DBA: la asignatura no tiene DBA en el catálogo.
            </p>
          )}
          {/* La clave fuerza a reiniciar el borrador local cuando llega una versión nueva. */}
          <Editor key={resource.version} resource={resource} actions={actions} />
          {resource.data?.type === "EXAM" && resource.gradingScale && (
            <GradingScalePanel
              resourceId={resource.id}
              total={examTotalPoints(resource.data.content)}
              initial={resource.gradingScale}
              save={actions.gradingScale}
            />
          )}
          <ResourceRating
            resourceId={resource.id}
            courseId={resource.courseId}
            initial={resource.rating}
            initialComment={resource.ratingComment}
            actions={actions}
          />
        </>
      )}
    </div>
  );
}
