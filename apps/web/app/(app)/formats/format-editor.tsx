"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import {
  HiOutlineArrowDown,
  HiOutlineArrowUp,
  HiOutlineExclamationTriangle,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { SelectField } from "@/components/forms/select-field";
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
  FIELD_SOURCES,
  FIELD_SOURCE_LABELS,
  MAX_HEADER_FIELDS,
  MAX_SECTIONS,
  SECTION_KINDS,
  SECTION_KIND_LABELS,
  saveFormatSchema,
  type FormatScope,
  type FormatStructure,
  type SaveFormatInput,
} from "@/modules/formats/client";

type Props = {
  initial: { id?: string; name: string; scope: FormatScope; structure: FormatStructure };
  warnings?: string[];
  aiUsed?: boolean;
  /** El administrador de un colegio elige si el formato es suyo o de todo el colegio. */
  scopes: FormatScope[];
  save: (input: SaveFormatInput) => Promise<ActionResult<{ id: string }>>;
  onDone: () => void;
  onCancel: () => void;
};

const SOURCE_OPTIONS = FIELD_SOURCES.map((s) => ({ value: s, label: FIELD_SOURCE_LABELS[s] }));
const KIND_OPTIONS = SECTION_KINDS.map((k) => ({ value: k, label: SECTION_KIND_LABELS[k] }));
const SCOPE_OPTIONS = {
  TEACHER: { value: "TEACHER", label: "Solo para mí" },
  INSTITUTION: { value: "INSTITUTION", label: "Para todos los docentes del colegio" },
};

/** RN-01: el docente revisa y corrige la estructura detectada antes de guardarla. */
export function FormatEditor({
  initial,
  warnings = [],
  aiUsed,
  scopes,
  save,
  onDone,
  onCancel,
}: Props) {
  const form = useForm<SaveFormatInput>({
    resolver: zodResolver(saveFormatSchema) as Resolver<SaveFormatInput>,
    defaultValues: initial,
  });
  const header = useFieldArray({ control: form.control, name: "structure.header" });
  const sections = useFieldArray({ control: form.control, name: "structure.sections" });
  const kinds = useWatch({ control: form.control, name: "structure.sections" });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await save(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    sileo.success({
      title: "Formato guardado",
      description: "Ya lo puedes elegir al crear un taller.",
    });
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 rounded-lg border p-4">
      {(warnings.length > 0 || aiUsed === false) && (
        <ul className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-sm" role="note">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <HiOutlineExclamationTriangle className="mt-0.5 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="format-name">Nombre del formato</FieldLabel>
            <Input id="format-name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          {scopes.length > 1 && (
            <Field>
              <FieldLabel htmlFor="format-scope">¿Quién lo usa?</FieldLabel>
              <Controller
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <SelectField
                    id="format-scope"
                    value={field.value}
                    onChange={(v) => field.onChange(v as FormatScope)}
                    disabled={!!initial.id}
                    options={scopes.map((s) => SCOPE_OPTIONS[s])}
                  />
                )}
              />
            </Field>
          )}
        </div>

        <FieldSet>
          <FieldLegend>Encabezado</FieldLegend>
          <FieldDescription>
            Los campos en el orden de tu formato. Elige de dónde sale cada dato; &quot;en
            blanco&quot; deja el espacio para que lo llene el estudiante.
          </FieldDescription>
          <ol className="flex flex-col gap-2" aria-label="Campos del encabezado">
            {header.fields.map((f, i) => (
              <li key={f.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  aria-label={`Etiqueta del campo ${i + 1}`}
                  className="sm:flex-1"
                  {...form.register(`structure.header.${i}.label`)}
                />
                <div className="sm:w-72">
                  <Controller
                    control={form.control}
                    name={`structure.header.${i}.source`}
                    render={({ field }) => (
                      <SelectField
                        id={`source-${i}`}
                        value={field.value}
                        onChange={field.onChange}
                        options={SOURCE_OPTIONS}
                      />
                    )}
                  />
                </div>
                <span className="flex gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Subir campo ${i + 1}`}
                    disabled={i === 0}
                    onClick={() => header.move(i, i - 1)}
                  >
                    <HiOutlineArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Bajar campo ${i + 1}`}
                    disabled={i === header.fields.length - 1}
                    onClick={() => header.move(i, i + 1)}
                  >
                    <HiOutlineArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Quitar campo ${i + 1}`}
                    onClick={() => header.remove(i)}
                  >
                    <HiOutlineTrash aria-hidden />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
          <FieldError errors={[errors.structure?.header?.root ?? errors.structure?.header]} />
          {header.fields.length < MAX_HEADER_FIELDS && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => header.append({ label: "", source: "BLANK" })}
            >
              <HiOutlinePlus aria-hidden />
              Agregar campo
            </Button>
          )}
        </FieldSet>

        <FieldSet>
          <FieldLegend>Secciones</FieldLegend>
          <FieldDescription>
            En el orden de tu formato. Las de actividades y texto las llena la IA según su
            propósito; las fijas se copian tal cual en cada taller.
          </FieldDescription>
          <ol className="flex flex-col gap-3" aria-label="Secciones del formato">
            {sections.fields.map((f, i) => {
              const kind = kinds?.[i]?.kind;
              const sectionErrors = errors.structure?.sections?.[i];
              return (
                <li key={f.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      aria-label={`Título de la sección ${i + 1}`}
                      className="sm:flex-1"
                      {...form.register(`structure.sections.${i}.title`)}
                    />
                    <div className="sm:w-72">
                      <Controller
                        control={form.control}
                        name={`structure.sections.${i}.kind`}
                        render={({ field }) => (
                          <SelectField
                            id={`kind-${i}`}
                            value={field.value}
                            onChange={field.onChange}
                            options={KIND_OPTIONS}
                          />
                        )}
                      />
                    </div>
                    <span className="flex gap-1">
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
                        disabled={sections.fields.length <= 1}
                        onClick={() => sections.remove(i)}
                      >
                        <HiOutlineTrash aria-hidden />
                      </Button>
                    </span>
                  </div>
                  {kind === "FIXED" ? (
                    <Field data-invalid={!!sectionErrors?.text}>
                      <FieldLabel htmlFor={`text-${i}`}>Texto fijo</FieldLabel>
                      <Textarea
                        id={`text-${i}`}
                        rows={3}
                        {...form.register(`structure.sections.${i}.text`)}
                      />
                      <FieldError errors={[sectionErrors?.text]} />
                    </Field>
                  ) : (
                    <Field>
                      <FieldLabel htmlFor={`purpose-${i}`}>¿Para qué usas esta sección?</FieldLabel>
                      <Input
                        id={`purpose-${i}`}
                        placeholder="Ej.: activar lo que los estudiantes ya saben del tema"
                        {...form.register(`structure.sections.${i}.purpose`)}
                      />
                    </Field>
                  )}
                  <FieldError errors={[sectionErrors?.title]} />
                </li>
              );
            })}
          </ol>
          <FieldError
            errors={[
              errors.structure?.sections?.root ??
                (errors.structure?.sections as { message?: string } | undefined),
            ]}
          />
          {sections.fields.length < MAX_SECTIONS && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() =>
                sections.append({ title: "", kind: "ACTIVITIES", purpose: "", text: "" })
              }
            >
              <HiOutlinePlus aria-hidden />
              Agregar sección
            </Button>
          )}
        </FieldSet>
      </FieldGroup>
      <FieldError errors={[errors.root]} />
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar formato"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
