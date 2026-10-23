"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineExclamationTriangle,
  HiOutlineSparkles,
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
  ITEM_COUNT_LIMITS,
  LEVELS,
  LEVEL_LABELS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  RESOURCE_TYPE_LABELS,
  STRUCTURES,
  WORKSHOP_STRUCTURES,
  blueprintSchema,
  defaultsForGrade,
  type CognitiveLevel,
  type Difficulty,
  type QuestionType,
  type ResourceFormContext,
  type ResourceType,
  type WorkshopStructure,
} from "@/modules/resources/client";
import {
  PreferencesPanel,
  type PreferenceActions,
} from "../courses/[courseId]/resources/preferences-panel";

type FormValues = {
  objectiveIds: string[];
  durationMinutes: number;
  difficulty: Difficulty;
  itemCount: number;
  questionTypes: QuestionType[];
  /** Estructura estándar o `format:<id>` para un formato propio o del colegio (SPEC-0010). */
  structure: string;
  distribution: Record<CognitiveLevel, number>;
  notes: string;
  excludedPreferenceIds: string[];
};

const toBlueprint = (v: FormValues, type: ResourceType, topicId: string) => ({
  type,
  topicId,
  objectiveIds: v.objectiveIds,
  durationMinutes: Number(v.durationMinutes),
  difficulty: v.difficulty,
  itemCount: Number(v.itemCount),
  cognitiveDistribution: Object.fromEntries(
    LEVELS.map((l) => [l, Number(v.distribution[l]) || 0]).filter(([, n]) => Number(n) > 0),
  ),
  notes: v.notes.trim() || null,
  excludedPreferenceIds: v.excludedPreferenceIds,
  ...(type === "QUIZ"
    ? { questionTypes: v.questionTypes }
    : v.structure.startsWith("format:")
      ? { structure: "CUSTOM", formatId: v.structure.slice("format:".length) }
      : { structure: v.structure }),
});

/** El mismo schema del servidor valida el formulario (convención del repo). */
const resolverFor =
  (type: ResourceType, topicId: string): Resolver<FormValues> =>
  async (values) => {
    const parsed = blueprintSchema.safeParse(toBlueprint(values, type, topicId));
    if (parsed.success) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of parsed.error.issues) {
      const key =
        issue.path[0] === "cognitiveDistribution" ? "distribution" : String(issue.path[0]);
      errors[key] ??= { type: "validation", message: issue.message };
    }
    return { values: {}, errors };
  };

/** Campos que viven en "Más opciones": si uno tiene error, el panel se abre. */
const ADVANCED: (keyof FormValues)[] = [
  "durationMinutes",
  "questionTypes",
  "distribution",
  "notes",
  "excludedPreferenceIds",
];

type Props = {
  type: "QUIZ" | "WORKSHOP";
  step: "settings" | "confirm";
  context: ResourceFormContext;
  courseTitle: string;
  blocked: boolean;
  quotaText: string;
  onStep: (step: "settings" | "confirm") => void;
  create: (input: unknown) => Promise<ActionResult<{ id: string }>>;
  preferenceActions: PreferenceActions;
};

export function SettingsStep(props: Props) {
  const { type, context } = props;
  const router = useRouter();
  const defaults = defaultsForGrade(context.grade);
  const draftKey = `${DRAFT_STORAGE_PREFIX}${type}:${context.topic.id}`;
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const restored = useRef(false);

  /** Cada momento o sección de actividades necesita al menos una actividad. */
  const minActivities = (value: string) => {
    if (!value.startsWith("format:")) {
      return (
        WORKSHOP_STRUCTURES[value as WorkshopStructure]?.moments.length ??
        ITEM_COUNT_LIMITS.WORKSHOP.min
      );
    }
    const format = context.formats.find((f) => `format:${f.id}` === value);
    return Math.max(2, format?.sections.filter((s) => s.kind === "ACTIVITIES").length ?? 2);
  };

  // RN-08 de SPEC-0010: el formato predeterminado viene preseleccionado.
  const initialStructure = context.defaultFormatId
    ? `format:${context.defaultFormatId}`
    : "START_DEVELOPMENT_CLOSE";
  const form = useForm<FormValues>({
    resolver: resolverFor(type, context.topic.id),
    defaultValues: {
      objectiveIds: context.objectives.slice(0, 5).map((o) => o.id),
      durationMinutes: defaults.durationMinutes,
      difficulty: defaults.difficulty,
      itemCount:
        type === "QUIZ"
          ? defaults.quizCount
          : Math.max(defaults.workshopCount, minActivities(initialStructure)),
      questionTypes: defaults.questionTypes,
      structure: initialStructure,
      distribution: Object.fromEntries(
        LEVELS.map((l) => [l, defaults.distribution[l] ?? 0]),
      ) as Record<CognitiveLevel, number>,
      notes: "",
      excludedPreferenceIds: [],
    },
  });
  const { errors } = form.formState;

  const values = useWatch({ control: form.control }) as FormValues;

  // RN-04 (SPEC-0012): el borrador sobrevive a volver atrás y a recargar. Vive solo en esta
  // pestaña del navegador (identificadores y opciones; nunca contenido generado).
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

  const total = LEVELS.reduce((sum, l) => sum + (Number(values.distribution?.[l]) || 0), 0);
  const limits = ITEM_COUNT_LIMITS[type];
  const label = RESOURCE_TYPE_LABELS[type].toLowerCase();
  const unit = type === "QUIZ" ? "preguntas" : "actividades";

  const structureLabel = (value: string) => {
    if (value.startsWith("format:")) {
      const format = context.formats.find((f) => `format:${f.id}` === value);
      return format ? `Formato: ${format.name}` : "Formato propio";
    }
    return WORKSHOP_STRUCTURES[value as WorkshopStructure]?.label ?? value;
  };

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
    const result = await props.create(toBlueprint(v, type, context.topic.id));
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
      title: `${RESOURCE_TYPE_LABELS[type]} en preparación`,
      description: "Puedes salir de esta página: lo encontrarás en Mis recursos.",
    });
    router.push(`/courses/${context.courseId}/resources/${result.data!.id}`);
    router.refresh();
  });

  const summary = [
    `${values.itemCount} ${unit}`,
    `${values.durationMinutes} min`,
    `Dificultad ${DIFFICULTY_LABELS[values.difficulty]?.toLowerCase() ?? ""}`,
    type === "WORKSHOP"
      ? structureLabel(values.structure)
      : (values.questionTypes ?? []).map((t) => QUESTION_TYPE_LABELS[t]).join(", "),
  ];

  if (props.step === "confirm") {
    const chosen = context.objectives.filter((o) => values.objectiveIds?.includes(o.id));
    return (
      <form onSubmit={generate} noValidate className="flex flex-col gap-6">
        <div className="rounded-3xl border border-brand-border bg-card p-6 shadow-soft sm:p-8">
          <p className="text-sm font-bold text-brand-strong">Todo listo</p>
          <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">
            {RESOURCE_TYPE_LABELS[type]}: {context.topic.title}
          </h2>
          <p className="mt-1 text-muted-foreground">{props.courseTitle}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Cantidad y duración</dt>
              <dd className="font-semibold">
                {values.itemCount} {unit} · {values.durationMinutes} minutos
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Dificultad</dt>
              <dd className="font-semibold">{DIFFICULTY_LABELS[values.difficulty]}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">
                {type === "WORKSHOP" ? "Estructura" : "Tipos de pregunta"}
              </dt>
              <dd className="font-semibold">{summary[3]}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Objetivos</dt>
              <dd className="font-semibold">
                {chosen.length === 0
                  ? "El tema completo"
                  : `${chosen.length} ${chosen.length === 1 ? "objetivo" : "objetivos"}`}
              </dd>
            </div>
            {values.notes?.trim() && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Indicaciones</dt>
                <dd className="font-semibold">{values.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <HiOutlineSparkles className="mt-0.5 shrink-0 text-brand" aria-hidden />
          La IA lo prepara en segundo plano, normalmente en menos de un minuto. Luego lo revisas, lo
          editas y decides cuándo está listo.
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
            {submitting ? "Enviando…" : `Generar ${label}`}
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
        {summary.map((s) => (
          <Badge key={s} variant="brand">
            {s}
          </Badge>
        ))}
      </div>

      <FieldGroup className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <FieldSet>
          <FieldLegend className="font-bold">Objetivos que cubre</FieldLegend>
          {context.objectives.length === 0 ? (
            <FieldDescription>
              El tema no tiene objetivos: se usará el título del tema. Puedes agregarlos en la
              planeación.
            </FieldDescription>
          ) : (
            <Controller
              control={form.control}
              name="objectiveIds"
              render={({ field }) => (
                <ul className="flex flex-col gap-2">
                  {context.objectives.map((o) => {
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
                          disabled={!checked && field.value.length >= 5}
                          onCheckedChange={(c) =>
                            field.onChange(
                              c ? [...field.value, o.id] : field.value.filter((x) => x !== o.id),
                            )
                          }
                          className="mt-0.5"
                        />
                        <label id={`${id}-label`} htmlFor={id} className="text-sm leading-snug">
                          {o.statement}
                          {o.dbaCodes.length > 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {o.dbaCodes.length} DBA
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            />
          )}
          {values.objectiveIds?.length === 0 && context.objectives.length > 0 && (
            <FieldDescription>Sin objetivos elegidos se usará el tema completo.</FieldDescription>
          )}
          <FieldError errors={[errors.objectiveIds]} />
        </FieldSet>

        {type === "WORKSHOP" && (
          <FieldSet>
            <FieldLegend className="font-bold">Estructura del taller</FieldLegend>
            <FieldDescription>
              Cómo se organizan las actividades. Cada momento tendrá al menos una. Puedes subir tu
              propio formato en{" "}
              <a href="/formats" className="font-semibold text-brand-strong underline">
                Formatos
              </a>
              .
            </FieldDescription>
            <Controller
              control={form.control}
              name="structure"
              render={({ field }) => (
                <div
                  className="grid gap-2 md:grid-cols-2"
                  role="radiogroup"
                  aria-label="Estructura del taller"
                >
                  {context.formats.map((f) => {
                    const value = `format:${f.id}`;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role="radio"
                        aria-checked={field.value === value}
                        onClick={() => {
                          field.onChange(value);
                          const min = minActivities(value);
                          if (form.getValues("itemCount") < min) form.setValue("itemCount", min);
                        }}
                        className={cn(
                          "rounded-2xl border border-border p-4 text-left text-sm transition hover:border-brand-border hover:bg-brand-softer",
                          field.value === value && "border-brand bg-brand-softer ring-2 ring-brand",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          {f.scope === "INSTITUTION" ? "Formato del colegio" : "Mi formato"}:{" "}
                          {f.name}
                          {f.id === context.defaultFormatId && (
                            <Badge variant="brand">Predeterminado</Badge>
                          )}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1">
                          {f.sections.map((section, i) => (
                            <Badge
                              key={section.title}
                              variant={section.kind === "ACTIVITIES" ? "secondary" : "outline"}
                            >
                              {i + 1}. {section.title}
                            </Badge>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                  {STRUCTURES.map((s) => {
                    const info = WORKSHOP_STRUCTURES[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={field.value === s}
                        onClick={() => {
                          field.onChange(s);
                          if (form.getValues("itemCount") < info.moments.length) {
                            form.setValue("itemCount", info.moments.length);
                          }
                        }}
                        className={cn(
                          "rounded-2xl border border-border p-4 text-left text-sm transition hover:border-brand-border hover:bg-brand-softer",
                          field.value === s && "border-brand bg-brand-softer ring-2 ring-brand",
                        )}
                      >
                        <span className="font-semibold">{info.label}</span>
                        <span className="mt-1 block text-muted-foreground">{info.description}</span>
                        <span className="mt-2 flex flex-wrap gap-1">
                          {info.moments.map((m, i) => (
                            <Badge key={m} variant="secondary">
                              {i + 1}. {m}
                            </Badge>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
            <FieldError errors={[errors.structure]} />
          </FieldSet>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.itemCount}>
            <FieldLabel htmlFor="item-count">
              {type === "QUIZ" ? "Número de preguntas" : "Número de actividades"}
            </FieldLabel>
            <Input
              id="item-count"
              type="number"
              min={type === "WORKSHOP" ? minActivities(values.structure) : limits.min}
              max={limits.max}
              aria-invalid={!!errors.itemCount}
              {...form.register("itemCount", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.itemCount]} />
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
              Duración, {type === "QUIZ" ? "tipos de pregunta, " : ""}niveles de pensamiento,
              indicaciones y preferencias. Opcional.
            </span>
          </span>
          <HiOutlineArrowRight
            className="size-4 text-muted-foreground transition group-open:rotate-90"
            aria-hidden
          />
        </summary>
        <FieldGroup className="border-t border-border p-5 sm:p-6">
          <Field data-invalid={!!errors.durationMinutes} className="sm:max-w-xs">
            <FieldLabel htmlFor="duration">Duración (minutos)</FieldLabel>
            <Input
              id="duration"
              type="number"
              min={15}
              max={180}
              aria-invalid={!!errors.durationMinutes}
              {...form.register("durationMinutes", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.durationMinutes]} />
          </Field>

          {type === "QUIZ" && (
            <FieldSet>
              <FieldLegend className="font-bold">Tipos de pregunta</FieldLegend>
              <Controller
                control={form.control}
                name="questionTypes"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4">
                    {QUESTION_TYPES.map((t) => {
                      const id = `type-${t}`;
                      return (
                        <div key={t} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            aria-labelledby={`${id}-label`}
                            checked={field.value.includes(t)}
                            onCheckedChange={(c) =>
                              field.onChange(
                                c ? [...field.value, t] : field.value.filter((x) => x !== t),
                              )
                            }
                          />
                          <label id={`${id}-label`} htmlFor={id} className="text-sm">
                            {QUESTION_TYPE_LABELS[t]}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              />
              <FieldError errors={[errors.questionTypes]} />
            </FieldSet>
          )}

          <FieldSet>
            <FieldLegend className="font-bold">Niveles de pensamiento (%)</FieldLegend>
            <FieldDescription>
              Qué parte de las {unit} trabaja cada nivel. Deja en 0 los que no quieras.{" "}
              <span className={cn(total !== 100 && "font-semibold text-danger")}>
                Total: {total}%
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
              placeholder="Ej.: trabajarán en parejas; sin calculadora; usar situaciones del campo."
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
          Esta asignatura no tiene DBA en el catálogo: el recurso se generará con el tema y los
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
