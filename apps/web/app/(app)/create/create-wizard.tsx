"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { IconType } from "react-icons";
import {
  HiCheck,
  HiOutlineCalendarDays,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClipboardDocumentList,
  HiOutlineExclamationTriangle,
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { sileo } from "sileo";
import type { QuotaView } from "@/components/app-shell/identity-card";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { subjectTint } from "@/lib/subject-tint";
import { cn } from "@/lib/utils";
import type { CourseInput } from "@/modules/courses/client";
import type { TopicOutline } from "@/modules/planning/client";
import {
  EXAM_QUOTA_COST,
  type ExamFormContext,
  type ExamScope,
  type ResourceFormContext,
} from "@/modules/resources/client";
import { CourseForm, type Option } from "../courses/course-form";
import type { PreferenceActions } from "../courses/[courseId]/resources/preferences-panel";
import { ExamSettingsStep } from "./exam-settings-step";
import { ExamTopicsStep } from "./exam-topics-step";
import { SettingsStep } from "./settings-step";

export type WizardKind = "WORKSHOP" | "QUIZ" | "EXAM" | "PLAN";
type Step = "settings" | "confirm";

type CourseOption = { id: string; title: string; subjectId: string; subjectName: string };

type Props = {
  kind: WizardKind | null;
  step: Step;
  courses: CourseOption[];
  outline: TopicOutline[];
  courseId: string | null;
  topicId: string | null;
  formContext: ResourceFormContext | null;
  /** SPEC-0011: alcance, temas marcados al llegar y datos del examen (si ya hay temas). */
  exam: { scope: ExamScope; preselected: string[]; context: ExamFormContext | null };
  quota: QuotaView;
  subjects: Option[];
  campuses: Option[];
  actions: {
    createCourse: (input: CourseInput) => Promise<ActionResult<{ id: string }>>;
    createQuickTopic: (input: {
      courseId: string;
      title: string;
    }) => Promise<ActionResult<{ topicId: string }>>;
    createResource: (input: unknown) => Promise<ActionResult<{ id: string }>>;
    preferences: PreferenceActions;
  };
};

const KIND_CARDS: {
  kind: WizardKind | null;
  label: string;
  description: string;
  icon: IconType;
}[] = [
  {
    kind: "WORKSHOP",
    label: "Taller",
    description: "Actividades de clase organizadas por momentos, con tu formato si lo tienes.",
    icon: HiOutlinePencilSquare,
  },
  {
    kind: "QUIZ",
    label: "Quiz",
    description: "Preguntas cortas con su respuesta, su justificación y versiones A–D.",
    icon: HiOutlineClipboardDocumentCheck,
  },
  {
    kind: "EXAM",
    label: "Examen",
    description: "De una unidad o un periodo, por secciones, con puntaje y hoja de respuestas.",
    icon: HiOutlineClipboardDocumentList,
  },
  {
    kind: "PLAN",
    label: "Planeación",
    description: "Periodos, unidades y temas del curso, con objetivos alineados a los DBA.",
    icon: HiOutlineCalendarDays,
  },
];

const STEP_LABELS = ["Qué crear", "Curso y tema", "Ajustes", "Confirmar"];
const EXAM_STEP_LABELS = ["Qué crear", "Curso y temas", "Ajustes", "Confirmar"];

const scopeParam = (scope: ExamScope) =>
  scope.kind === "UNIT"
    ? `UNIT:${scope.unitId}`
    : scope.kind === "PERIOD"
      ? `PERIOD:${scope.periodNumber}`
      : null;

function href(params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const qs = query.toString();
  return qs ? `/create?${qs}` : "/create";
}

export function CreateWizard(props: Props) {
  const { kind, courses, outline, quota } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [topicTitle, setTopicTitle] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);

  const isResource = kind === "WORKSHOP" || kind === "QUIZ" || kind === "EXAM";
  const isExam = kind === "EXAM";
  const examTopics = props.exam.context?.topics.map((t) => t.id) ?? [];
  const course = courses.find((c) => c.id === props.courseId) ?? null;
  const units = outline.find((o) => o.courseId === course?.id)?.units ?? [];
  const topics = units.flatMap((u) => u.topics);
  const ready = isExam ? props.exam.context !== null : isResource && props.formContext !== null;
  const current = !kind ? 0 : !ready ? 1 : props.step === "settings" ? 2 : 3;
  const labels =
    kind === "PLAN" ? STEP_LABELS.slice(0, 2) : isExam ? EXAM_STEP_LABELS : STEP_LABELS;

  // SPEC-0011 RN-11: un examen gasta 2 recursos del cupo.
  const cost = isExam ? EXAM_QUOTA_COST : 1;
  const left = quota.limit - quota.used;
  const blocked = left < cost;
  const quotaText =
    left <= 0
      ? `Llegaste al límite de ${quota.limit} recursos con IA en 24 horas.`
      : blocked
        ? `Un examen usa ${cost} recursos con IA y te queda ${left}.`
        : `Te quedan ${left} de ${quota.limit} recursos con IA hoy.${isExam ? ` El examen usa ${cost}.` : ""}`;

  const go = (params: Record<string, string | null | undefined>) => router.push(href(params));
  const base = { type: kind, courseId: props.courseId };
  const examBase = { ...base, scope: scopeParam(props.exam.scope) };

  const stepHref = (index: number) => {
    if (index === 0) return href({ courseId: props.courseId, topicId: props.topicId });
    if (isExam) {
      // Volver a los temas conserva lo marcado (RN-04 de SPEC-0012).
      if (index === 1) return href({ ...examBase, seleccion: examTopics.join(",") || null });
      if (index === 2) return href({ ...examBase, topics: examTopics.join(",") });
      return null;
    }
    if (index === 1) return href({ type: kind, courseId: props.courseId });
    if (index === 2) return href({ ...base, topicId: props.topicId });
    return null;
  };

  const createTopic = () =>
    startTransition(async () => {
      if (!course) return;
      const result = await props.actions.createQuickTopic({
        courseId: course.id,
        title: topicTitle,
      });
      if (!result.ok) {
        setTopicError(result.fieldErrors?.title?.[0] ?? result.error);
        return;
      }
      setTopicTitle("");
      setTopicError(null);
      sileo.success({ title: "Tema agregado", description: "Lo encuentras en la planeación." });
      if (isExam) {
        go({ ...examBase, seleccion: [...props.exam.preselected, result.data!.topicId].join(",") });
      } else {
        go({ ...base, topicId: result.data!.topicId });
      }
      router.refresh();
    });

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <PageHeader
        eyebrow="Crear con IA"
        title={
          kind === "PLAN"
            ? "Planear un curso"
            : kind
              ? `Crear ${kind === "QUIZ" ? "un quiz" : kind === "EXAM" ? "un examen" : "un taller"}`
              : "Crear con IA"
        }
        description="Unos pocos pasos. Puedes volver atrás sin perder lo que elegiste."
      />

      <ol aria-label="Pasos" className="flex flex-wrap items-center gap-2">
        {labels.map((label, index) => {
          const done = index < current;
          const active = index === current;
          const target = done ? stepHref(index) : null;
          const content = (
            <>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                  done && "bg-brand text-white",
                  active && "bg-brand-gradient text-white shadow-lift",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <HiCheck aria-hidden /> : index + 1}
              </span>
              <span className={cn("text-sm font-semibold", !active && "text-muted-foreground")}>
                {label}
              </span>
            </>
          );
          return (
            <li key={label} className="flex items-center gap-2">
              {target ? (
                <Link
                  href={target}
                  className="flex items-center gap-2 rounded-full pr-2 hover:bg-muted"
                >
                  {content}
                </Link>
              ) : (
                <span
                  className="flex items-center gap-2 pr-2"
                  aria-current={active ? "step" : undefined}
                >
                  {content}
                </span>
              )}
              {index < labels.length - 1 && (
                <span aria-hidden className="h-px w-6 bg-border sm:w-10" />
              )}
            </li>
          );
        })}
      </ol>

      {/* CA-0012-10: el aviso de cupo llega antes de llenar los ajustes. */}
      {kind !== "PLAN" && blocked && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4"
        >
          <HiOutlineExclamationTriangle
            className="mt-0.5 size-5 shrink-0 text-danger"
            aria-hidden
          />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-bold">
              {left > 0
                ? "No te alcanza el cupo de recursos con IA para un examen"
                : "Llegaste al límite de recursos con IA de hoy"}
            </p>
            <p>
              {left > 0 ? `Un examen usa ${cost} recursos y te queda ${left}. ` : ""}
              Puedes generar hasta {quota.limit} en 24 horas.
              {quota.freesAtLabel ? ` Podrás crear otro desde las ${quota.freesAtLabel}.` : ""}{" "}
              Mientras tanto puedes revisar y descargar los que ya tienes.
            </p>
          </div>
        </div>
      )}

      {current === 0 && (
        <section aria-labelledby="kind-title" className="flex flex-col gap-4">
          <h2 id="kind-title" className="text-lg font-extrabold">
            ¿Qué quieres crear?
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {KIND_CARDS.map(({ kind: k, label, description, icon: Icon }) => (
              <li key={label}>
                {k ? (
                  <Link
                    href={href({
                      type: k,
                      courseId: props.courseId,
                      topicId: k === "PLAN" ? null : props.topicId,
                    })}
                    className="group flex h-full items-start gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-border hover:shadow-lift"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong transition group-hover:bg-brand-gradient group-hover:text-white">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="text-base font-bold">{label}</span>
                      <span className="text-sm text-muted-foreground">{description}</span>
                    </span>
                  </Link>
                ) : (
                  <div
                    aria-disabled="true"
                    className="flex h-full items-start gap-4 rounded-3xl border border-dashed border-border bg-muted/50 p-5"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="flex items-center gap-2 text-base font-bold text-muted-foreground">
                        {label}
                        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold text-muted-foreground ring-1 ring-border">
                          Próximamente
                        </span>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Exámenes por periodo con varias secciones.
                      </span>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {current === 1 && (
        <section aria-labelledby="course-title" className="flex flex-col gap-6">
          {courses.length === 0 ? (
            <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
              <div>
                <h2 id="course-title" className="text-lg font-extrabold">
                  Primero, crea tu curso
                </h2>
                <p className="text-sm text-muted-foreground">
                  Un curso es una asignatura que dictas en un grado y grupo. Después seguimos con el
                  tema.
                </p>
              </div>
              <CourseForm
                subjects={props.subjects}
                campuses={props.campuses}
                onSubmit={props.actions.createCourse}
                submitLabel="Crear curso y continuar"
                onDone={(created) => {
                  sileo.success({ title: "Curso creado" });
                  if (created) go({ type: kind, courseId: created.id });
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <h2 id="course-title" className="text-lg font-extrabold">
                  {kind === "PLAN" ? "¿Qué curso vas a planear?" : "¿Para qué curso?"}
                </h2>
                <div role="radiogroup" aria-label="Curso" className="grid gap-3 sm:grid-cols-2">
                  {courses.map((c) => {
                    const tint = subjectTint(c.subjectId);
                    const selected = c.id === course?.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          kind === "PLAN"
                            ? router.push(`/courses/${c.id}?tab=planeacion`)
                            : go({ type: kind, courseId: c.id })
                        }
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition hover:border-brand-border hover:bg-brand-softer",
                          selected && "border-brand bg-brand-softer ring-2 ring-brand",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-xl font-extrabold",
                            tint.bg,
                            tint.fg,
                          )}
                        >
                          {c.subjectName.charAt(0)}
                        </span>
                        <span className="font-semibold">{c.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {kind !== "PLAN" && course && (
                <div className="flex flex-col gap-3">
                  {!isExam && <h2 className="text-lg font-extrabold">¿Sobre qué tema?</h2>}
                  {isExam && topics.length > 0 && (
                    <ExamTopicsStep
                      key={`${course.id}:${props.exam.preselected.join(",")}`}
                      units={units}
                      initial={props.exam.preselected}
                      scope={props.exam.scope}
                      onContinue={(ids, scope) =>
                        go({ ...base, scope: scopeParam(scope), topics: ids.join(",") })
                      }
                    />
                  )}
                  {!isExam && topics.length > 0 && (
                    <div className="flex flex-col gap-4">
                      {units
                        .filter((u) => u.topics.length > 0)
                        .map((unit) => (
                          <div key={unit.id} className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-muted-foreground">
                              {unit.title}
                            </p>
                            <ul
                              aria-label={`Temas de ${unit.title}`}
                              className="grid gap-2 sm:grid-cols-2"
                            >
                              {unit.topics.map((t) => (
                                <li key={t.id}>
                                  <Link
                                    href={href({ ...base, topicId: t.id })}
                                    className="group flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-brand-border hover:bg-brand-softer"
                                  >
                                    <span className="flex min-w-0 flex-1 flex-col">
                                      <span className="font-semibold">{t.title}</span>
                                      <span className="text-sm text-muted-foreground">
                                        {t.objectiveCount === 0
                                          ? "Sin objetivos: se usa el tema"
                                          : `${t.objectiveCount} ${t.objectiveCount === 1 ? "objetivo" : "objetivos"}`}
                                      </span>
                                    </span>
                                    <HiOutlineSparkles
                                      className="size-5 shrink-0 text-muted-foreground transition group-hover:text-brand"
                                      aria-hidden
                                    />
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* §7: un curso sin temas no deja al docente en un callejón. */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createTopic();
                    }}
                    className="flex flex-col gap-3 rounded-2xl border border-dashed border-brand-border bg-brand-softer p-4"
                  >
                    <Field data-invalid={!!topicError}>
                      <FieldLabel htmlFor="quick-topic">
                        {topics.length === 0
                          ? "Este curso aún no tiene temas. ¿Qué tema vas a trabajar?"
                          : "¿Es un tema nuevo? Escríbelo"}
                      </FieldLabel>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          id="quick-topic"
                          value={topicTitle}
                          onChange={(e) => setTopicTitle(e.target.value)}
                          placeholder="Ej.: Fracciones equivalentes"
                          aria-invalid={!!topicError}
                          className="bg-card"
                        />
                        <Button type="submit" disabled={isPending || topicTitle.trim().length < 3}>
                          <HiOutlinePlus aria-hidden />
                          {isPending ? "Agregando…" : "Usar este tema"}
                        </Button>
                      </div>
                      <FieldError errors={topicError ? [{ message: topicError }] : []} />
                    </Field>
                    <p className="text-sm text-muted-foreground">
                      Queda guardado en la planeación del curso.{" "}
                      <Link
                        href={`/courses/${course.id}?tab=planeacion`}
                        className="font-semibold text-brand-strong underline"
                      >
                        Ir a la planeación
                      </Link>
                    </p>
                  </form>
                </div>
              )}

              {kind !== "PLAN" && !course && (
                <p className="text-sm text-muted-foreground">Elige un curso para ver sus temas.</p>
              )}
            </>
          )}
        </section>
      )}

      {ready && isExam && props.exam.context && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Para:</span>
            <span className="font-semibold">{course?.title}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold">
              {props.exam.context.topics.length}{" "}
              {props.exam.context.topics.length === 1 ? "tema" : "temas"}:{" "}
              {props.exam.context.topics.map((t) => t.title).join(", ")}
            </span>
            <Link href={stepHref(1)!} className={buttonVariants({ variant: "link", size: "sm" })}>
              Cambiar
            </Link>
          </div>
          <ExamSettingsStep
            key={examTopics.join(",")}
            step={props.step}
            context={props.exam.context}
            scope={props.exam.scope}
            courseTitle={course?.title ?? ""}
            blocked={blocked}
            quotaText={quotaText}
            onStep={(next) =>
              go({
                ...examBase,
                topics: examTopics.join(","),
                step: next === "confirm" ? "confirmar" : null,
              })
            }
            create={props.actions.createResource}
            preferenceActions={props.actions.preferences}
          />
        </>
      )}

      {ready && !isExam && props.formContext && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Para:</span>
            <span className="font-semibold">{course?.title}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold">Tema: {props.formContext.topic.title}</span>
            <Link
              href={href({ type: kind, courseId: props.courseId })}
              className={buttonVariants({ variant: "link", size: "sm" })}
            >
              Cambiar
            </Link>
          </div>
          <SettingsStep
            key={`${kind}:${props.formContext.topic.id}`}
            type={kind as "WORKSHOP" | "QUIZ"}
            step={props.step}
            context={props.formContext}
            courseTitle={course?.title ?? ""}
            blocked={blocked}
            quotaText={quotaText}
            onStep={(next) =>
              go({
                ...base,
                topicId: props.topicId,
                step: next === "confirm" ? "confirmar" : null,
              })
            }
            create={props.actions.createResource}
            preferenceActions={props.actions.preferences}
          />
        </>
      )}
    </div>
  );
}
