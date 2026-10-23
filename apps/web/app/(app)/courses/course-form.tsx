"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { sileo } from "sileo";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import {
  GRADES,
  GRADE_LABELS,
  courseSchema,
  currentAcademicYear,
  type CourseInput,
} from "@/modules/courses/client";

export type Option = { id: string; name: string };

type Props = {
  course?: CourseInput & { subjectName?: string };
  subjects: Option[];
  campuses: Option[];
  /** Al crear, la acción devuelve el id del curso (el asistente sigue con él). */
  onSubmit: (values: CourseInput) => Promise<ActionResult<{ id: string } | void>>;
  onDone: (created?: { id: string }) => void;
  submitLabel?: string;
};

export function CourseForm({ course, subjects, campuses, onSubmit, onDone, submitLabel }: Props) {
  // Si la asignatura del curso fue archivada, se sigue mostrando para poder editar lo demás.
  const subjectOptions = [...subjects];
  if (course && !subjects.some((s) => s.id === course.subjectId)) {
    subjectOptions.unshift({ id: course.subjectId, name: course.subjectName ?? "Asignatura" });
  }

  const form = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      subjectId: course?.subjectId ?? "",
      grade: course?.grade,
      groupName: course?.groupName ?? "",
      academicYear: course?.academicYear ?? currentAcademicYear(),
      campusId: course?.campusId ?? campuses[0]?.id,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (!result.ok) {
      const fields = Object.entries(result.fieldErrors ?? {});
      for (const [name, messages] of fields) {
        if (messages?.[0]) form.setError(name as FieldPath<CourseInput>, { message: messages[0] });
      }
      if (fields.length === 0) form.setError("root", { message: result.error });
      sileo.error({ title: "No pudimos guardar el curso", description: result.error });
      return;
    }
    onDone(result.data || undefined);
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.subjectId}>
          <FieldLabel htmlFor="subjectId">Asignatura</FieldLabel>
          <Controller
            control={form.control}
            name="subjectId"
            render={({ field }) => (
              <SelectField
                id="subjectId"
                value={field.value}
                onChange={field.onChange}
                placeholder="Elige la asignatura"
                invalid={!!errors.subjectId}
                options={subjectOptions.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
          />
          <FieldDescription>
            ¿No está la tuya? Agrégala en <strong>Asignaturas</strong>.
          </FieldDescription>
          <FieldError errors={[errors.subjectId]} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.grade}>
            <FieldLabel htmlFor="grade">Grado</FieldLabel>
            <Controller
              control={form.control}
              name="grade"
              render={({ field }) => (
                <SelectField
                  id="grade"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Grado"
                  invalid={!!errors.grade}
                  options={GRADES.map((g) => ({ value: g, label: GRADE_LABELS[g] }))}
                />
              )}
            />
            <FieldError errors={[errors.grade]} />
          </Field>
          <Field data-invalid={!!errors.groupName}>
            <FieldLabel htmlFor="groupName">Grupo</FieldLabel>
            <Input
              id="groupName"
              placeholder="601, B…"
              aria-invalid={!!errors.groupName}
              {...form.register("groupName")}
            />
            <FieldError errors={[errors.groupName]} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.academicYear}>
            <FieldLabel htmlFor="academicYear">Año lectivo</FieldLabel>
            <Input
              id="academicYear"
              inputMode="numeric"
              aria-invalid={!!errors.academicYear}
              {...form.register("academicYear")}
            />
            <FieldError errors={[errors.academicYear]} />
          </Field>
          {campuses.length > 1 && (
            <Field data-invalid={!!errors.campusId}>
              <FieldLabel htmlFor="campusId">Sede</FieldLabel>
              <Controller
                control={form.control}
                name="campusId"
                render={({ field }) => (
                  <SelectField
                    id="campusId"
                    value={field.value}
                    onChange={field.onChange}
                    options={campuses.map((c) => ({ value: c.id, label: c.name }))}
                  />
                )}
              />
              <FieldError errors={[errors.campusId]} />
            </Field>
          )}
        </div>

        <FieldError errors={[errors.root]} />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Guardando…"
            : (submitLabel ?? (course ? "Guardar cambios" : "Crear curso"))}
        </Button>
      </FieldGroup>
    </form>
  );
}
