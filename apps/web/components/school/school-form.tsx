"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { sileo } from "sileo";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import {
  SECTORS,
  SECTOR_LABELS,
  registerSchoolSchema,
  type RegisterSchoolInput,
} from "@/modules/institutions/client";

type Props = {
  mode: "register" | "edit";
  defaultValues?: Partial<RegisterSchoolInput>;
  action: (input: RegisterSchoolInput) => Promise<ActionResult>;
  onSuccess: () => void;
  submitLabel: string;
};

const TEXT_FIELDS: {
  name: FieldPath<RegisterSchoolInput>;
  label: string;
  placeholder?: string;
  hint?: string;
}[] = [
  { name: "name", label: "Nombre del colegio", placeholder: "Institución Educativa…" },
  {
    name: "daneCode",
    label: "Código DANE",
    hint: "12 dígitos. Obligatorio para colegios oficiales.",
  },
  { name: "department", label: "Departamento" },
  { name: "municipality", label: "Municipio" },
  { name: "nit", label: "NIT (opcional)" },
];

export function SchoolForm({ mode, defaultValues, action, onSuccess, submitLabel }: Props) {
  const form = useForm<RegisterSchoolInput>({
    resolver: zodResolver(registerSchoolSchema),
    defaultValues: {
      name: "",
      daneCode: "",
      department: "",
      municipality: "",
      nit: "",
      calendar: "A",
      alsoTeaches: false,
      ...defaultValues,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await action(values);
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0])
          form.setError(name as FieldPath<RegisterSchoolInput>, { message: messages[0] });
      }
      sileo.error({ title: "No pudimos guardar", description: result.error });
      return;
    }
    onSuccess();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {TEXT_FIELDS.slice(0, 1).map((f) => (
          <TextField key={f.name} form={form} {...f} />
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.sector}>
            <FieldLabel htmlFor="sector">Sector</FieldLabel>
            <Controller
              control={form.control}
              name="sector"
              render={({ field }) => (
                <SelectField
                  id="sector"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Elige el sector"
                  invalid={!!errors.sector}
                  options={SECTORS.map((s) => ({ value: s, label: SECTOR_LABELS[s] }))}
                />
              )}
            />
            <FieldError errors={[errors.sector]} />
          </Field>
          <Field data-invalid={!!errors.calendar}>
            <FieldLabel htmlFor="calendar">Calendario</FieldLabel>
            <Controller
              control={form.control}
              name="calendar"
              render={({ field }) => (
                <SelectField
                  id="calendar"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "A", label: "Calendario A (feb–nov)" },
                    { value: "B", label: "Calendario B (ago–jun)" },
                  ]}
                />
              )}
            />
          </Field>
        </div>
        {TEXT_FIELDS.slice(1, 2).map((f) => (
          <TextField key={f.name} form={form} {...f} />
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.slice(2, 4).map((f) => (
            <TextField key={f.name} form={form} {...f} />
          ))}
        </div>
        {TEXT_FIELDS.slice(4).map((f) => (
          <TextField key={f.name} form={form} {...f} />
        ))}
        {mode === "register" && (
          <Controller
            control={form.control}
            name="alsoTeaches"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="alsoTeaches"
                  aria-labelledby="alsoTeaches-label"
                  checked={!!field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
                <FieldLabel id="alsoTeaches-label" htmlFor="alsoTeaches" className="font-normal">
                  También doy clases en este colegio
                </FieldLabel>
              </Field>
            )}
          />
        )}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}

function TextField({
  form,
  name,
  label,
  placeholder,
  hint,
}: {
  form: ReturnType<typeof useForm<RegisterSchoolInput>>;
  name: FieldPath<RegisterSchoolInput>;
  label: string;
  placeholder?: string;
  hint?: string;
}) {
  const error = form.formState.errors[name as keyof RegisterSchoolInput];
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} placeholder={placeholder} aria-invalid={!!error} {...form.register(name)} />
      {hint && !error && <FieldDescription>{hint}</FieldDescription>}
      <FieldError errors={[error as { message?: string } | undefined]} />
    </Field>
  );
}
