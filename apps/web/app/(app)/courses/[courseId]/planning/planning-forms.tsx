"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { HiOutlineMinus, HiOutlinePlus } from "react-icons/hi2";
import { SelectField } from "@/components/forms/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { normalizeName } from "@/lib/text";
import type { CurriculumReference } from "@/modules/curriculum/client";
import {
  MAX_PERIODS,
  coursePeriodsSchema,
  objectiveSchema,
  topicSchema,
  unitSchema,
  type CoursePeriodsInput,
  type CurriculumLinkInput,
  type ObjectiveInput,
  type PlanningPeriod,
  type TopicInput,
  type UnitInput,
} from "@/modules/planning/client";

type Submit<T> = (values: T) => Promise<ActionResult<unknown>>;

/** Traslada los errores por campo del servidor al formulario; devuelve true si salió bien. */
function applyResult<T extends FieldValues>(form: UseFormReturn<T>, result: ActionResult<unknown>) {
  if (result.ok) return true;
  const fields = Object.entries(result.fieldErrors ?? {});
  for (const [name, messages] of fields) {
    if (messages?.[0]) form.setError(name as FieldPath<T>, { message: messages[0] });
  }
  if (fields.length === 0) form.setError("root" as FieldPath<T>, { message: result.error });
  return false;
}

// Campo numérico opcional: vacío (o null/undefined, que RHF puede pasar) → null; Number(null) daría 0.
const emptyToNull = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

// ---------- Unidad ----------

export function UnitForm({
  courseId,
  periods,
  initial,
  onSubmit,
  onDone,
}: {
  courseId: string;
  periods: PlanningPeriod[];
  initial?: { title: string; description: string | null; periodNumber: number | null };
  onSubmit: Submit<UnitInput>;
  onDone: () => void;
}) {
  const form = useForm<UnitInput>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      courseId,
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      periodNumber: initial ? initial.periodNumber : (periods[0]?.number ?? null),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    if (applyResult(form, await onSubmit(values))) onDone();
  });
  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="unit-title">Título de la unidad</FieldLabel>
          <Input
            id="unit-title"
            placeholder="Ej.: Números enteros"
            aria-invalid={!!errors.title}
            {...form.register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="unit-period">Periodo</FieldLabel>
          <Controller
            control={form.control}
            name="periodNumber"
            render={({ field }) => (
              <SelectField
                id="unit-period"
                value={field.value === null ? "none" : String(field.value)}
                onChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                options={[
                  ...periods.map((p) => ({ value: String(p.number), label: p.name })),
                  { value: "none", label: "Sin periodo" },
                ]}
              />
            )}
          />
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="unit-description">Descripción (opcional)</FieldLabel>
          <Textarea id="unit-description" rows={3} {...form.register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>
        <FieldError errors={[errors.root]} />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : initial ? "Guardar unidad" : "Crear unidad"}
        </Button>
      </FieldGroup>
    </form>
  );
}

// ---------- Tema ----------

export function TopicForm({
  unitId,
  initial,
  onSubmit,
  onDone,
}: {
  unitId: string;
  initial?: { title: string; description: string | null; plannedSessions: number | null };
  onSubmit: Submit<TopicInput>;
  onDone: () => void;
}) {
  const form = useForm<TopicInput>({
    resolver: zodResolver(topicSchema),
    defaultValues: {
      unitId,
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      plannedSessions: initial?.plannedSessions ?? null,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    if (applyResult(form, await onSubmit(values))) onDone();
  });
  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="topic-title">Título del tema</FieldLabel>
          <Input
            id="topic-title"
            placeholder="Ej.: La recta numérica"
            aria-invalid={!!errors.title}
            {...form.register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field data-invalid={!!errors.plannedSessions}>
          <FieldLabel htmlFor="topic-sessions">Sesiones estimadas (opcional)</FieldLabel>
          <Input
            id="topic-sessions"
            type="number"
            min={1}
            max={60}
            className="w-32"
            {...form.register("plannedSessions", { setValueAs: emptyToNull })}
          />
          <FieldError errors={[errors.plannedSessions]} />
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="topic-description">Descripción (opcional)</FieldLabel>
          <Textarea id="topic-description" rows={3} {...form.register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>
        <FieldError errors={[errors.root]} />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : initial ? "Guardar tema" : "Crear tema"}
        </Button>
      </FieldGroup>
    </form>
  );
}

// ---------- Objetivo con vínculo a DBA ----------

function DbaPicker({
  references,
  value,
  onChange,
}: {
  references: CurriculumReference[];
  value: CurriculumLinkInput[];
  onChange: (links: CurriculumLinkInput[]) => void;
}) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const q = normalizeName(filter);
    return q
      ? references.filter((r) =>
          [r.statement, ...r.evidences].some((t) => normalizeName(t).includes(q)),
        )
      : references;
  }, [filter, references]);
  const selected = new Map(value.map((l) => [l.code, l.evidenceIndexes ?? []]));

  const toggleDba = (code: string, checked: boolean) =>
    onChange(
      checked ? [...value, { code, evidenceIndexes: [] }] : value.filter((l) => l.code !== code),
    );
  const toggleEvidence = (code: string, index: number, checked: boolean) =>
    onChange(
      value.map((l) => {
        if (l.code !== code) return l;
        const current = l.evidenceIndexes ?? [];
        return {
          ...l,
          evidenceIndexes: checked ? [...current, index] : current.filter((i) => i !== index),
        };
      }),
    );

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar DBA por palabra"
        aria-label="Filtrar DBA"
      />
      <ul
        className="max-h-72 divide-y overflow-y-auto rounded-lg border"
        aria-label="DBA del curso"
      >
        {visible.map((ref) => {
          const isOn = selected.has(ref.code);
          const id = `dba-${ref.code}`;
          return (
            <li key={ref.code} className="p-2.5">
              <div className="flex items-start gap-2">
                <Checkbox
                  id={id}
                  aria-labelledby={`${id}-label`}
                  checked={isOn}
                  onCheckedChange={(c) => toggleDba(ref.code, c)}
                  className="mt-0.5"
                />
                <label id={`${id}-label`} htmlFor={id} className="text-sm leading-snug">
                  <span className="font-medium">DBA {ref.number}.</span> {ref.statement}
                </label>
              </div>
              {isOn && (
                <fieldset className="mt-2 ml-6 flex flex-col gap-1.5">
                  <legend className="mb-1 text-xs text-muted-foreground">
                    Evidencias (opcional; sin marcar = el DBA completo)
                  </legend>
                  {ref.evidences.map((evidence, index) => {
                    const evId = `${id}-ev-${index}`;
                    return (
                      <div key={evId} className="flex items-start gap-2">
                        <Checkbox
                          id={evId}
                          aria-labelledby={`${evId}-label`}
                          checked={selected.get(ref.code)?.includes(index) ?? false}
                          onCheckedChange={(c) => toggleEvidence(ref.code, index, c)}
                          className="mt-0.5"
                        />
                        <label id={`${evId}-label`} htmlFor={evId} className="text-xs leading-snug">
                          {evidence}
                        </label>
                      </div>
                    );
                  })}
                </fieldset>
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">Ningún DBA coincide.</li>
        )}
      </ul>
    </div>
  );
}

export function ObjectiveForm({
  topicId,
  references,
  hasArea,
  initial,
  onSubmit,
  onDone,
}: {
  topicId: string;
  references: CurriculumReference[];
  hasArea: boolean;
  initial?: { statement: string; links: CurriculumLinkInput[] };
  onSubmit: Submit<ObjectiveInput>;
  onDone: () => void;
}) {
  const form = useForm<ObjectiveInput>({
    resolver: zodResolver(objectiveSchema),
    defaultValues: { topicId, statement: initial?.statement ?? "", links: initial?.links ?? [] },
  });
  const { errors, isSubmitting } = form.formState;
  const links = useWatch({ control: form.control, name: "links" }) ?? [];
  const submit = form.handleSubmit(async (values) => {
    if (applyResult(form, await onSubmit(values))) onDone();
  });
  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.statement}>
          <FieldLabel htmlFor="objective-statement">Objetivo de aprendizaje</FieldLabel>
          <Textarea
            id="objective-statement"
            rows={2}
            placeholder="Ej.: Ubica números enteros en la recta numérica y los compara."
            aria-invalid={!!errors.statement}
            {...form.register("statement")}
          />
          <FieldError errors={[errors.statement]} />
        </Field>
        <Field>
          <FieldLabel>
            DBA vinculados {links.length > 0 && <Badge variant="secondary">{links.length}</Badge>}
          </FieldLabel>
          {!hasArea ? (
            <FieldDescription>
              Vincula la asignatura a un área curricular (pestaña DBA y Estándares) para elegir DBA.
            </FieldDescription>
          ) : references.length === 0 ? (
            <FieldDescription>
              Esta área no tiene DBA para este grado en el catálogo.
            </FieldDescription>
          ) : (
            <Controller
              control={form.control}
              name="links"
              render={({ field }) => (
                <DbaPicker
                  references={references}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          )}
          <FieldError errors={[errors.links as { message?: string } | undefined]} />
        </Field>
        <FieldError errors={[errors.root]} />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : initial ? "Guardar objetivo" : "Crear objetivo"}
        </Button>
      </FieldGroup>
    </form>
  );
}

// ---------- Periodos del curso ----------

export function PeriodsForm({
  courseId,
  periods,
  onSubmit,
  onDone,
}: {
  courseId: string;
  periods: PlanningPeriod[];
  onSubmit: Submit<CoursePeriodsInput>;
  onDone: () => void;
}) {
  const form = useForm<CoursePeriodsInput>({
    resolver: zodResolver(coursePeriodsSchema),
    defaultValues: {
      courseId,
      periods: periods.map((p) => ({
        number: p.number,
        name: p.name,
        startDate: p.startDate ?? "",
        endDate: p.endDate ?? "",
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "periods" });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    if (applyResult(form, await onSubmit(values))) onDone();
  });
  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <ol className="flex flex-col gap-3" aria-label="Periodos">
          {fields.map((f, i) => {
            const e = errors.periods?.[i];
            return (
              <li key={f.id} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Field data-invalid={!!e?.name}>
                  <FieldLabel htmlFor={`p-${i}-name`}>Periodo {i + 1}</FieldLabel>
                  <Input id={`p-${i}-name`} {...form.register(`periods.${i}.name`)} />
                  <FieldError errors={[e?.name]} />
                </Field>
                <Field data-invalid={!!e?.startDate}>
                  <FieldLabel htmlFor={`p-${i}-start`}>Inicio</FieldLabel>
                  <Input
                    id={`p-${i}-start`}
                    type="date"
                    {...form.register(`periods.${i}.startDate`)}
                  />
                  <FieldError errors={[e?.startDate]} />
                </Field>
                <Field data-invalid={!!e?.endDate}>
                  <FieldLabel htmlFor={`p-${i}-end`}>Fin</FieldLabel>
                  <Input id={`p-${i}-end`} type="date" {...form.register(`periods.${i}.endDate`)} />
                  <FieldError errors={[e?.endDate]} />
                </Field>
              </li>
            );
          })}
        </ol>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= MAX_PERIODS}
            onClick={() =>
              append({
                number: fields.length + 1,
                name: `Periodo ${fields.length + 1}`,
                startDate: "",
                endDate: "",
              })
            }
          >
            <HiOutlinePlus aria-hidden />
            Agregar periodo
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={fields.length <= 1}
            onClick={() => remove(fields.length - 1)}
          >
            <HiOutlineMinus aria-hidden />
            Quitar el último
          </Button>
        </div>
        <FieldError
          errors={[errors.root, errors.periods?.root as { message?: string } | undefined]}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar periodos"}
        </Button>
      </FieldGroup>
    </form>
  );
}
