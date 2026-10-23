"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowDown,
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineArrowUp,
  HiOutlineExclamationTriangle,
  HiOutlinePlus,
  HiOutlineSparkles,
  HiOutlineTrash,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { DRAFT_STORAGE_PREFIX } from "@/components/app-shell/app-shell";
import { SelectField } from "@/components/forms/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  EXAM_LIMITS,
  EXAM_QUESTION_TYPES,
  EXAM_QUESTION_TYPE_LABELS,
  LEVELS,
  LEVEL_LABELS,
  blueprintSchema,
  distributePoints,
  examBlueprintPoints,
  examDefaultsForGrade,
  examQuestionCount,
  type CognitiveLevel,
  type Difficulty,
  type ExamFormContext,
  type ExamQuestionType,
  type ExamScope,
} from "@/modules/resources/client";
import {
  PreferencesPanel,
  type PreferenceActions,
} from "../courses/[courseId]/resources/preferences-panel";

type SectionValues = {
  questionType: ExamQuestionType;
  questionCount: number;
  pointsPerQuestion: number;
  instructions: string;
};

type FormValues = {
  objectiveIds: string[];
  durationMinutes: number;
  difficulty: Difficulty;
  totalPoints: number;
  sections: SectionValues[];
  distribution: Record<CognitiveLevel, number>;
  notes: string;
  excludedPreferenceIds: string[];
};

const toBlueprint = (v: FormValues, topicIds: string[], scope: ExamScope) => ({
  type: "EXAM" as const,
  scope,
  topicIds,
  objectiveIds: v.objectiveIds,
  durationMinutes: Number(v.durationMinutes),
  difficulty: v.difficulty,
  totalPoints: Number(v.totalPoints),
  sections: v.sections.map((s) => ({
    questionType: s.questionType,
    questionCount: Number(s.questionCount),
    pointsPerQuestion: Number(s.pointsPerQuestion),
    instructions: s.instructions.trim() || null,
  })),
  cognitiveDistribution: Object.fromEntries(
    LEVELS.map((l) => [l, Number(v.distribution[l]) || 0]).filter(([, n]) => Number(n) > 0),
  ),
  notes: v.notes.trim() || null,
  excludedPreferenceIds: v.excludedPreferenceIds,
});

/** El mismo schema del servidor valida el formulario (convención del repo). */
const resolverFor =
  (topicIds: string[], scope: ExamScope): Resolver<FormValues> =>
  async (values) => {
    const parsed = blueprintSchema.safeParse(toBlueprint(values, topicIds, scope));
    if (parsed.success) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of parsed.error.issues) {
      const [root, index] = issue.path;
      const key = root === "cognitiveDistribution" ? "distribution" : String(root);
      const message =
        root === "sections" && typeof index === "number"
          ? `Sección ${index + 1}: ${issue.message}`
          : issue.message;
      errors[key] ??= { type: "validation", message };
    }
    return { values: {}, errors };
  };

const ADVANCED: (keyof FormValues)[] = [
  "objectiveIds",
  "distribution",
  "notes",
  "excludedPreferenceIds",
];

type Props = {
  step: "settings" | "confirm";
  context: ExamFormContext;
  scope: ExamScope;
  courseTitle: string;
  blocked: boolean;
  quotaText: string;
  onStep: (step: "settings" | "confirm") => void;
  create: (input: unknown) => Promise<ActionResult<{ id: string }>>;
  preferenceActions: PreferenceActions;
};

const points = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** SPEC-0011: ajustes del examen (secciones, puntos y duración) con valores según el grado. */
export function ExamSettingsStep(props: Props) {
  const { context, scope } = props;
  const router = useRouter();
  const topicIds = context.topics.map((t) => t.id);
  const defaults = examDefaultsForGrade(context.grade);
  const draftKey = `${DRAFT_STORAGE_PREFIX}EXAM:${topicIds.join(",")}`;
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const restored = useRef(false);

  const form = useForm<FormValues>({
    resolver: resolverFor(topicIds, scope),
    defaultValues: {
      objectiveIds: [],
      durationMinutes: defaults.durationMinutes,
      difficulty: defaults.difficulty,
      totalPoints: 100,
      sections: distributePoints(defaults.sections, 100).map((s) => ({ ...s, instructions: "" })),
      distribution: Object.fromEntries(
        LEVELS.map((l) => [l, defaults.distribution[l] ?? 0]),
      ) as Record<CognitiveLevel, number>,
      notes: "",
      excludedPreferenceIds: [],
    },
  });
  const sections = useFieldArray({ control: form.control, name: "sections" });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control }) as FormValues;

  // RN-04 (SPEC-0012): el borrador sobrevive a volver atrás y a recargar.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) form.reset({ ...form.getValues(), ...(JSON.parse(saved) as Partial<FormValues>) });
    } catch {
      // Un borrador ilegible se ignora: quedan los valores por defecto.
    }
  }, [draftKey, form]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(values));
    } catch {
      // Sin almacenamiento el asistente funciona igual, solo sin borrador.
    }
  }, [draftKey, values]);

  /** RN-06: Profe reparte el total; el docente puede ajustar los puntos de cada sección. */
  const redistribute = (total = Number(form.getValues("totalPoints")) || 0) => {
    const current = form.getValues("sections");
    distributePoints(current, total).forEach((s, i) =>
      form.setValue(`sections.${i}.pointsPerQuestion`, s.pointsPerQuestion, { shouldDirty: true }),
    );
  };

  const questionCount = examQuestionCount(values.sections ?? []);
  const realPoints = examBlueprintPoints(values.sections ?? []);
  const target = Number(values.totalPoints) || 0;
  const pointsMismatch = Math.abs(realPoints - target) > 0.05;
  const totalLevels = LEVELS.reduce((sum, l) => sum + (Number(values.distribution?.[l]) || 0), 0);
  const objectives = context.topics.flatMap((t) =>
    t.objectives.map((o) => ({ ...o, topic: t.title })),
  );

  const goConfirm = async () => {
    const ok = await form.trigger();
    if (!ok) {
      if (ADVANCED.some((k) => form.getFieldState(k).invalid)) setAdvancedOpen(true);
      return;
    }
    props.onStep("confirm");
  };

  const generate = form.handleSubmit(async (v) => {
    setSubmitting(true);
    const result = await props.create(toBlueprint(v, topicIds, scope));
    if (!result.ok) {
      setSubmitting(false);
      form.setError("root", { message: result.error });
      return;
    }
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // Nada que limpiar.
    }
    sileo.success({
      title: "Examen en preparación",
      description: "Puedes salir de esta página: lo encontrarás en Mis recursos.",
    });
    router.push(`/courses/${context.courseId}/resources/${result.data!.id}`);
    router.refresh();
  });

  const sectionSummary = (values.sections ?? []).map(
    (s) => `${s.questionCount} ${EXAM_QUESTION_TYPE_LABELS[s.questionType]?.toLowerCase() ?? ""}`,
  );

  if (props.step === "confirm") {
    return (
      <form onSubmit={generate} noValidate className="flex flex-col gap-6">
        <div className="rounded-3xl border border-brand-border bg-card p-6 shadow-soft sm:p-8">
          <p className="text-sm font-bold text-brand-strong">Todo listo</p>
          <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">
            Examen de {context.topics.length} {context.topics.length === 1 ? "tema" : "temas"}
          </h2>
          <p className="mt-1 text-muted-foreground">{props.courseTitle}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Temas</dt>
              <dd className="font-semibold">{context.topics.map((t) => t.title).join(", ")}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Preguntas y duración</dt>
              <dd className="font-semibold">
                {questionCount} preguntas · {values.durationMinutes} minutos
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Puntaje total</dt>
              <dd className="font-semibold">{points.format(realPoints)} puntos</dd>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Secciones, en este orden</dt>
              <dd className="font-semibold">{sectionSummary.join(" · ")}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Dificultad</dt>
              <dd className="font-semibold">{DIFFICULTY_LABELS[values.difficulty]}</dd>
            </div>
          </dl>
        </div>

        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <HiOutlineSparkles className="mt-0.5 shrink-0 text-brand" aria-hidden />
          La IA prepara el examen por secciones, en segundo plano; suele tardar uno o dos minutos.
          Usa {context.quota.cost} de tus recursos con IA del día. Luego lo revisas, lo editas y
          decides cuándo está listo.
        </p>

        <FieldError errors={[errors.root]} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => props.onStep("settings")}
          >
            <HiOutlineArrowLeft aria-hidden />
            Volver a ajustes
          </Button>
          <Button type="submit" variant="brand" size="xl" disabled={submitting || props.blocked}>
            <HiOutlineSparkles aria-hidden />
            {submitting ? "Enviando…" : "Generar examen"}
          </Button>
          <p className="text-sm text-muted-foreground sm:ml-auto">{props.quotaText}</p>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void goConfirm();
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <span className="text-sm font-semibold">
          Valores recomendados para {context.gradeLabel}:
        </span>
        <Badge variant="brand">{questionCount} preguntas</Badge>
        <Badge variant="brand">{values.durationMinutes} min</Badge>
        <Badge variant="brand">{sections.fields.length} secciones</Badge>
      </div>

      <FieldGroup className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <FieldSet>
          <FieldLegend className="font-bold">Secciones del examen</FieldLegend>
          <FieldDescription>
            Cada sección tiene un tipo de pregunta. El orden de esta lista es el del examen.
          </FieldDescription>
          <ol className="flex flex-col gap-3" aria-label="Secciones">
            {sections.fields.map((field, i) => {
              const type = values.sections?.[i]?.questionType ?? field.questionType;
              const cap = EXAM_LIMITS.perSection[type];
              return (
                <li
                  key={field.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">Sección {i + 1}</h3>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Subir sección ${i + 1}`}
                        disabled={i === 0}
                        onClick={() => sections.move(i, i - 1)}
                      >
                        <HiOutlineArrowUp aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Bajar sección ${i + 1}`}
                        disabled={i === sections.fields.length - 1}
                        onClick={() => sections.move(i, i + 1)}
                      >
                        <HiOutlineArrowDown aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Quitar sección ${i + 1}`}
                        disabled={sections.fields.length <= EXAM_LIMITS.sections.min}
                        onClick={() => {
                          sections.remove(i);
                          redistribute();
                        }}
                      >
                        <HiOutlineTrash aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field>
                      <FieldLabel htmlFor={`section-${i}-type`}>Tipo de pregunta</FieldLabel>
                      <Controller
                        control={form.control}
                        name={`sections.${i}.questionType`}
                        render={({ field: f }) => (
                          <SelectField
                            id={`section-${i}-type`}
                            value={f.value}
                            onChange={(v) => {
                              f.onChange(v as ExamQuestionType);
                              const limit = EXAM_LIMITS.perSection[v as ExamQuestionType];
                              if (form.getValues(`sections.${i}.questionCount`) > limit) {
                                form.setValue(`sections.${i}.questionCount`, limit);
                              }
                              redistribute();
                            }}
                            options={EXAM_QUESTION_TYPES.map((t) => ({
                              value: t,
                              label: EXAM_QUESTION_TYPE_LABELS[t],
                            }))}
                          />
                        )}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`section-${i}-count`}>
                        {type === "MATCHING" ? "Bloques de parejas" : "Preguntas"}
                      </FieldLabel>
                      <Input
                        id={`section-${i}-count`}
                        type="number"
                        min={1}
                        max={cap}
                        {...form.register(`sections.${i}.questionCount`, {
                          valueAsNumber: true,
                          onChange: () => redistribute(),
                        })}
                      />
                      <FieldDescription>Máximo {cap}.</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`section-${i}-points`}>Puntos por pregunta</FieldLabel>
                      <Input
                        id={`section-${i}-points`}
                        type="number"
                        min={0.1}
                        step={0.5}
                        {...form.register(`sections.${i}.pointsPerQuestion`, {
                          valueAsNumber: true,
                        })}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor={`section-${i}-instructions`}>
                      Indicaciones de la sección (opcional)
                    </FieldLabel>
                    <Input
                      id={`section-${i}-instructions`}
                      maxLength={300}
                      placeholder="Ej.: usa la tabla de la página 12"
                      {...form.register(`sections.${i}.instructions`)}
                    />
                  </Field>
                </li>
              );
            })}
          </ol>
          {sections.fields.length < EXAM_LIMITS.sections.max && (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => {
                sections.append({
                  questionType: "SHORT_ANSWER",
                  questionCount: 3,
                  pointsPerQuestion: 1,
                  instructions: "",
                });
                redistribute();
              }}
            >
              <HiOutlinePlus aria-hidden />
              Agregar sección
            </Button>
          )}
          <FieldError errors={[errors.sections as { message?: string } | undefined]} />
        </FieldSet>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={!!errors.totalPoints}>
            <FieldLabel htmlFor="total-points">Puntaje total</FieldLabel>
            <Input
              id="total-points"
              type="number"
              min={EXAM_LIMITS.totalPoints.min}
              max={EXAM_LIMITS.totalPoints.max}
              aria-invalid={!!errors.totalPoints}
              {...form.register("totalPoints", {
                valueAsNumber: true,
                onChange: (e) => redistribute(Number(e.target.value) || 0),
              })}
            />
            <FieldError errors={[errors.totalPoints]} />
          </Field>
          <Field data-invalid={!!errors.durationMinutes}>
            <FieldLabel htmlFor="duration">Duración (minutos)</FieldLabel>
            <Input
              id="duration"
              type="number"
              min={EXAM_LIMITS.duration.min}
              max={EXAM_LIMITS.duration.max}
              aria-invalid={!!errors.durationMinutes}
              {...form.register("durationMinutes", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.durationMinutes]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="difficulty">Dificultad</FieldLabel>
            <Controller
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <SelectField
                  id="difficulty"
                  value={field.value}
                  onChange={(v) => field.onChange(v as Difficulty)}
                  options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))}
                />
              )}
            />
          </Field>
        </div>
        <p
          className={cn(
            "text-sm",
            pointsMismatch ? "font-semibold text-warning" : "text-muted-foreground",
          )}
          role="status"
        >
          {questionCount} preguntas · Suman {points.format(realPoints)} de {points.format(target)}{" "}
          puntos.
          {pointsMismatch && (
            <>
              {" "}
              <button
                type="button"
                className="font-semibold text-brand-strong underline"
                onClick={() => redistribute()}
              >
                Repartir {points.format(target)} puntos
              </button>
            </>
          )}
        </p>
      </FieldGroup>

      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
        className="group rounded-3xl border border-border bg-card shadow-soft"
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-3xl p-5 sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
            <HiOutlineAdjustmentsHorizontal className="size-5" aria-hidden />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="font-bold">Más opciones</span>
            <span className="text-sm text-muted-foreground">
              Objetivos, niveles de pensamiento, indicaciones y preferencias. Opcional.
            </span>
          </span>
          <HiOutlineArrowRight
            className="size-4 text-muted-foreground transition group-open:rotate-90"
            aria-hidden
          />
        </summary>
        <FieldGroup className="border-t border-border p-5 sm:p-6">
          <FieldSet>
            <FieldLegend className="font-bold">Objetivos que evalúa</FieldLegend>
            {objectives.length === 0 ? (
              <FieldDescription>
                Los temas no tienen objetivos: se usarán sus títulos. Puedes agregarlos en la
                planeación.
              </FieldDescription>
            ) : (
              <Controller
                control={form.control}
                name="objectiveIds"
                render={({ field }) => (
                  <ul className="flex flex-col gap-2">
                    {objectives.map((o) => {
                      const id = `objective-${o.id}`;
                      const checked = field.value.includes(o.id);
                      return (
                        <li
                          key={o.id}
                          className="flex items-start gap-3 rounded-xl border border-border p-3"
                        >
                          <Checkbox
                            id={id}
                            aria-labelledby={`${id}-label`}
                            checked={checked}
                            disabled={!checked && field.value.length >= EXAM_LIMITS.objectives}
                            onCheckedChange={(c) =>
                              field.onChange(
                                c ? [...field.value, o.id] : field.value.filter((x) => x !== o.id),
                              )
                            }
                            className="mt-0.5"
                          />
                          <label id={`${id}-label`} htmlFor={id} className="text-sm leading-snug">
                            {o.statement}
                            <span className="text-muted-foreground"> · {o.topic}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              />
            )}
            <FieldDescription>
              Sin objetivos elegidos se usan los temas completos y los DBA del grado.
            </FieldDescription>
            <FieldError errors={[errors.objectiveIds]} />
          </FieldSet>

          <FieldSet>
            <FieldLegend className="font-bold">Niveles de pensamiento (%)</FieldLegend>
            <FieldDescription>
              Qué parte de las preguntas trabaja cada nivel.{" "}
              <span className={cn(totalLevels !== 100 && "font-semibold text-danger")}>
                Total: {totalLevels}%
              </span>
            </FieldDescription>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {LEVELS.map((l) => (
                <Field key={l}>
                  <FieldLabel htmlFor={`level-${l}`}>{LEVEL_LABELS[l]}</FieldLabel>
                  <Input
                    id={`level-${l}`}
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    {...form.register(`distribution.${l}`, { valueAsNumber: true })}
                  />
                </Field>
              ))}
            </div>
            <FieldError errors={[errors.distribution as { message?: string } | undefined]} />
          </FieldSet>

          <Field data-invalid={!!errors.notes}>
            <FieldLabel htmlFor="notes">Indicaciones para la IA (opcional)</FieldLabel>
            <Textarea
              id="notes"
              rows={2}
              maxLength={500}
              placeholder="Ej.: sin calculadora; incluir una pregunta de la salida de campo."
              {...form.register("notes")}
            />
            <FieldDescription>No escribas nombres ni datos de estudiantes.</FieldDescription>
            <FieldError errors={[errors.notes]} />
          </Field>

          <Controller
            control={form.control}
            name="excludedPreferenceIds"
            render={({ field }) => (
              <PreferencesPanel
                courseId={context.courseId}
                preferences={context.preferences}
                excluded={field.value}
                onExcludedChange={field.onChange}
                actions={props.preferenceActions}
              />
            )}
          />
        </FieldGroup>
      </details>

      {!context.hasDba && (
        <p
          className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm"
          role="note"
        >
          <HiOutlineExclamationTriangle className="mt-0.5 shrink-0 text-warning" aria-hidden />
          Esta asignatura no tiene DBA en el catálogo: el examen se generará con los temas y los
          objetivos, sin citas a referentes oficiales.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="xl">
          Continuar
          <HiOutlineArrowRight aria-hidden />
        </Button>
        <p className="text-sm text-muted-foreground">{props.quotaText}</p>
      </div>
    </form>
  );
}
