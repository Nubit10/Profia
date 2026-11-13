"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineArchiveBox,
  HiOutlineBars3BottomLeft,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineDocumentDuplicate,
  HiOutlineEllipsisHorizontal,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { AiAvatar } from "@/components/brand/ai-avatar";
import { requestOfflineSync } from "@/components/offline/offline-sync";
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
  const [compact, setCompact] = useState(false);
  // Contenido y versión del último guardado: "Listo" guarda seguido, sin esperar al refresco.
  const [saved, setSaved] = useState({ content: initial.content, version: resource.version });
  const dirty = JSON.stringify(content) !== JSON.stringify(saved.content);
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
    if (!dirty || saving) return;
    setSaving(true);
    const result = await actions.save({
      resourceId: resource.id,
      version: saved.version,
      content,
    });
    setSaving(false);
    if (!result.ok) {
      sileo.error({ title: "No pudimos guardar", description: result.error });
      return;
    }
    setSaved({ content, version: result.data!.version });
    requestOfflineSync();
    sileo.success({ title: "Cambios guardados", description: `Versión ${result.data!.version}` });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6" data-compact={compact || undefined}>
      {/* SPEC-0013 CA-0013-17: vista compacta, solo enunciados y títulos, para recorrer rápido. */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={compact}
          onClick={() => setCompact(!compact)}
        >
          <HiOutlineBars3BottomLeft aria-hidden />
          {compact ? "Vista completa" : "Vista compacta"}
        </Button>
      </div>
      {initial.type === "QUIZ" ? (
        <QuizEditor
          resource={resource}
          content={content as QuizContent}
          onChange={setContent}
          dirty={dirty}
          onItemDone={() => void save()}
          savedKeys={savedKeys}
          actions={actions}
        />
      ) : initial.type === "EXAM" ? (
        <ExamEditor
          resource={resource}
          content={content as ExamContent}
          onChange={setContent}
          dirty={dirty}
          onItemDone={() => void save()}
          savedKeys={savedKeys}
          actions={actions}
        />
      ) : (
        <WorkshopEditor
          resource={resource}
          content={content as WorkshopContent}
          onChange={setContent}
          dirty={dirty}
          onItemDone={() => void save()}
          savedKeys={savedKeys}
          actions={actions}
        />
      )}
      {/* SPEC-0013 RN-05: los ítems se guardan con "Listo"; la barra solo aparece para lo demás
          (título, instrucciones, orden) mientras haya algo sin guardar. */}
      {(dirty || saving) && (
        <div
          data-floating="save-bar"
          className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-2xl sm:border sm:shadow-soft"
        >
          <Button type="button" disabled={!dirty || saving} onClick={save}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
          {dirty && (
            <>
              <Button type="button" variant="ghost" onClick={() => setContent(saved.content)}>
                Descartar cambios
              </Button>
              <span className="text-sm text-muted-foreground">Tienes cambios sin guardar.</span>
            </>
          )}
        </div>
      )}
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
        <AiAvatar size={48} className="motion-safe:animate-pulse" />
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
  // SPEC-0013 RN-14: listo, archivado o restaurado cambia lo que se guarda sin conexión.
  const setStatus: ResourceActions["setStatus"] = async (input) => {
    const result = await actions.setStatus(input);
    if (result.ok) requestOfflineSync();
    return result;
  };
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
          {/* SPEC-0016: el docente eligió el enfoque DUA. */}
          {resource.blueprint.type === "WORKSHOP" && resource.blueprint.udl && (
            <Badge variant="brand" title="Diseño Universal para el Aprendizaje">
              Con DUA
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {resource.type === "EXAM" ? "Temas" : "Tema"}: {resource.context.topic.title}
            {resource.model ? " · Generado con IA" : ""}
            {resource.version > 1 ? ` · Versión ${resource.version}` : ""}
          </span>
        </div>

        {hasContent && (resource.status === "DRAFT" || resource.status === "READY") && (
          // SPEC-0013 CA-0013-18: en el celular las acciones van en una barra fija abajo, al
          // alcance del pulgar; en pantallas grandes siguen en el encabezado.
          <div
            data-floating="bottom-bar"
            className="flex flex-wrap items-center gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex-nowrap max-md:border-t max-md:border-border max-md:bg-card/95 max-md:px-3 max-md:pt-2 max-md:pb-[calc(0.5rem+env(safe-area-inset-bottom))] max-md:shadow-lift max-md:backdrop-blur max-md:[&>button:last-child]:shrink-0 max-md:[&>button:not(:last-child)]:min-w-0 max-md:[&>button:not(:last-child)]:flex-1 max-md:[&>button:not(:last-child)]:px-3"
          >
            {resource.status === "DRAFT" ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="border-success/40 text-success hover:bg-success-soft"
                aria-label="Marcar como listo"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => setStatus({ resourceId: resource.id, status: "READY" }),
                    "Recurso listo",
                  )
                }
              >
                <HiOutlineCheckCircle aria-hidden />
                {/* En el celular la barra tiene poco ancho: texto corto, mismo nombre accesible. */}
                <span className="md:hidden">Listo</span>
                <span className="max-md:hidden">Marcar como listo</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={isPending}
                aria-label="Volver a borrador"
                onClick={() => run(() => setStatus({ resourceId: resource.id, status: "DRAFT" }))}
              >
                <span className="md:hidden">A borrador</span>
                <span className="max-md:hidden">Volver a borrador</span>
              </Button>
            )}
            <Downloads
              courseId={resource.courseId}
              resourceId={resource.id}
              type={resource.type}
              version={resource.version}
              answerSheet={resource.data?.type === "EXAM" && hasAnswerSheet(resource.data.content)}
              draft={resource.status === "DRAFT"}
              markReady={async () => {
                const result = await setStatus({
                  resourceId: resource.id,
                  status: "READY",
                });
                if (!result.ok) {
                  sileo.error({
                    title: "No pudimos marcarlo como listo",
                    description: result.error,
                  });
                  return false;
                }
                sileo.success({ title: "Recurso listo" });
                router.refresh();
                return true;
              }}
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
                      () => setStatus({ resourceId: resource.id, status: "ARCHIVED" }),
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
              onClick={() => run(() => setStatus({ resourceId: resource.id, status: "ARCHIVED" }))}
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
                () => setStatus({ resourceId: resource.id, status: "RESTORE" }),
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
          {/* Espacio para que la barra fija del celular no tape el final de la página. */}
          <div aria-hidden className="h-16 md:hidden" />
        </>
      )}
    </div>
  );
}
