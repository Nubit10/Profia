"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowRight,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { AiAvatar } from "@/components/brand/ai-avatar";
import { DbaChips } from "@/components/curriculum/dba-chip";
import { SelectField } from "@/components/forms/select-field";
import { SelectableOption } from "@/components/forms/selectable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  LESSON_PLAN_LIMITS,
  blueprintSchema,
  lessonPlanDefaultsForGrade,
  type Difficulty,
  type ResourceFormContext,
} from "@/modules/resources/client";
import {
  PreferencesPanel,
  type PreferenceActions,
} from "../courses/[courseId]/resources/preferences-panel";

type FormValues = {
  objectiveIds: string[];
  sessions: number;
  minutesPerSession: number;
  difficulty: Difficulty;
  notes: string;
  excludedPreferenceIds: string[];
};

const toBlueprint = (v: FormValues, topicId: string) => ({
  type: "LESSON_PLAN" as const,
  topicId,
  objectiveIds: v.objectiveIds,
  sessions: Number(v.sessions),
  minutesPerSession: Number(v.minutesPerSession),
  difficulty: v.difficulty,
  notes: v.notes.trim() || null,
  excludedPreferenceIds: v.excludedPreferenceIds,
});

/** El mismo schema del servidor valida el formulario (convención del repo). */
const resolverFor =
  (topicId: string): Resolver<FormValues> =>
  async (values) => {
    const parsed = blueprintSchema.safeParse(toBlueprint(values, topicId));
    if (parsed.success) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of parsed.error.issues) {
      errors[String(issue.path[0])] ??= { type: "validation", message: issue.message };
    }
    return { values: {}, errors };
  };

type Props = {
  context: ResourceFormContext;
  blocked: boolean;
  quotaText: string;
  create: (input: unknown) => Promise<ActionResult<{ id: string }>>;
  preferenceActions: PreferenceActions;
};

/** SPEC-0024 §2: sesiones, minutos por sesión, dificultad y, en "Más opciones", lo de siempre. */
export function LessonPlanSettingsStep(props: Props) {
  const { context } = props;
  const router = useRouter();
  const defaults = lessonPlanDefaultsForGrade(context.grade);
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const form = useForm<FormValues>({
    resolver: resolverFor(context.topic.id),
    defaultValues: {
      objectiveIds: context.objectives.slice(0, 5).map((o) => o.id),
      sessions: defaults.sessions,
      minutesPerSession: defaults.minutesPerSession,
      difficulty: defaults.difficulty,
      notes: "",
      excludedPreferenceIds: [],
    },
  });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control }) as FormValues;

  const generate = form.handleSubmit(
    async (v) => {
      setSubmitting(true);
      const result = await props.create(toBlueprint(v, context.topic.id));
      if (!result.ok) {
        setSubmitting(false);
        form.setError("root", { message: result.error });
        return;
      }
      sileo.success({
        title: "Plan de aula en preparación",
        description: "Puedes salir de esta página: lo encontrarás en Mis recursos.",
      });
      router.push(`/courses/${context.courseId}/resources/${result.data!.id}`);
      router.refresh();
    },
    () => {
      if (form.getFieldState("objectiveIds").invalid || form.getFieldState("notes").invalid) {
        setAdvancedOpen(true);
      }
    },
  );

  const summary = [
    `${values.sessions} ${Number(values.sessions) === 1 ? "sesión" : "sesiones"}`,
    `${values.minutesPerSession} min cada una`,
    `Dificultad ${DIFFICULTY_LABELS[values.difficulty]?.toLowerCase() ?? ""}`,
    "Rúbrica con tu escala",
  ];

  return (
    <form onSubmit={generate} noValidate className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <span className="text-sm font-semibold">
          Valores recomendados para {context.gradeLabel}:
        </span>
        {summary.map((s) => (
          <Badge key={s} variant="brand" className="h-auto max-w-full whitespace-normal">
            {s}
          </Badge>
        ))}
      </div>

      <FieldGroup className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field data-invalid={!!errors.sessions}>
            <FieldLabel htmlFor="sessions">Sesiones</FieldLabel>
            <Input
              id="sessions"
              type="number"
              min={LESSON_PLAN_LIMITS.sessions.min}
              max={LESSON_PLAN_LIMITS.sessions.max}
              aria-invalid={!!errors.sessions}
              {...form.register("sessions", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.sessions]} />
          </Field>
          <Field data-invalid={!!errors.minutesPerSession}>
            <FieldLabel htmlFor="minutes">Minutos por sesión</FieldLabel>
            <Input
              id="minutes"
              type="number"
              min={LESSON_PLAN_LIMITS.minutesPerSession.min}
              max={LESSON_PLAN_LIMITS.minutesPerSession.max}
              step={5}
              aria-invalid={!!errors.minutesPerSession}
              {...form.register("minutesPerSession", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.minutesPerSession]} />
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
        <FieldDescription>
          Cada sesión trae inicio, desarrollo y cierre. Al final, la evaluación y una rúbrica con
          los desempeños Superior, Alto, Básico y Bajo de tu{" "}
          <a href="/grading-scale" className="font-semibold text-brand-strong underline">
            escala de valoración
          </a>
          .
        </FieldDescription>
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
              Objetivos, indicaciones y preferencias. Opcional.
            </span>
          </span>
          <HiOutlineArrowRight
            className="size-4 text-muted-foreground transition group-open:rotate-90"
            aria-hidden
          />
        </summary>
        <FieldGroup className="border-t border-border p-5 sm:p-6">
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
                      const checked = field.value.includes(o.id);
                      return (
                        <li key={o.id} className="flex flex-col gap-1.5">
                          <SelectableOption
                            id={`objective-${o.id}`}
                            checked={checked}
                            disabled={!checked && field.value.length >= 5}
                            onCheckedChange={(c) =>
                              field.onChange(
                                c ? [...field.value, o.id] : field.value.filter((x) => x !== o.id),
                              )
                            }
                          >
                            {o.statement}
                          </SelectableOption>
                          <DbaChips codes={o.dbaCodes} label="DBA del objetivo" className="ml-8" />
                        </li>
                      );
                    })}
                  </ul>
                )}
              />
            )}
            <FieldError errors={[errors.objectiveIds]} />
          </FieldSet>

          <Field data-invalid={!!errors.notes}>
            <FieldLabel htmlFor="notes">Indicaciones para la IA (opcional)</FieldLabel>
            <Textarea
              id="notes"
              rows={2}
              maxLength={500}
              placeholder="Ej.: el grupo trabaja en parejas; hay sala de sistemas el jueves."
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
          Esta asignatura no tiene DBA en el catálogo: el plan se generará con el tema y los
          objetivos, sin citas a referentes oficiales.
        </p>
      )}

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <AiAvatar size={18} className="mt-0.5" />
        La IA lo prepara en segundo plano, normalmente en menos de un minuto. Luego lo revisas, lo
        editas y decides cuándo está listo.
      </p>

      <FieldError errors={[errors.root]} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" variant="brand" size="xl" disabled={submitting || props.blocked}>
          <AiAvatar size={20} tone="light" />
          {submitting ? "Enviando…" : "Generar plan de aula"}
        </Button>
        <p className="text-sm text-muted-foreground">{props.quotaText}</p>
      </div>
    </form>
  );
}
