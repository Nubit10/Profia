"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HiOutlinePlus } from "react-icons/hi2";
import { sileo } from "sileo";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { navigatingFromLayer } from "@/lib/use-back-to-close";
import { createPiarSchema } from "@/modules/piar/client";

/** SPEC-0017 RN-04: crear un PIAR pide el curso, el nombre y la autorización. */
export function NewPiar({
  courses,
  create,
  label = "Nuevo PIAR",
}: {
  courses: { id: string; title: string }[];
  create: (input: unknown) => Promise<ActionResult<{ id: string }>>;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses.length === 1 ? courses[0]!.id : "");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const submit = () => {
    const parsed = createPiarSchema.safeParse({ courseId, studentName: name, consent });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    start(async () => {
      const result = await create(parsed.data);
      if (!result.ok) {
        sileo.error({ title: "No pudimos crear el PIAR", description: result.error });
        return;
      }
      // Se navega desde una capa abierta: al cerrarse no debe retroceder (SPEC-0013 RN-11).
      navigatingFromLayer();
      setOpen(false);
      router.push(`/piar/${result.data!.id}`);
    });
  };

  return (
    <>
      <Button variant="brand" size="lg" onClick={() => setOpen(true)}>
        <HiOutlinePlus aria-hidden />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo PIAR</DialogTitle>
            <DialogDescription>
              Datos privados de un menor de edad: solo tú los ves y se guardan cifrados.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field data-invalid={!!errors.courseId}>
              <FieldLabel htmlFor="piar-course">Curso</FieldLabel>
              <SelectField
                id="piar-course"
                value={courseId || undefined}
                onChange={setCourseId}
                placeholder="Elige el curso"
                options={courses.map((c) => ({ value: c.id, label: c.title }))}
                invalid={!!errors.courseId}
              />
              <FieldError errors={[errors.courseId ? { message: errors.courseId } : undefined]} />
            </Field>
            <Field data-invalid={!!errors.studentName}>
              <FieldLabel htmlFor="piar-name">Nombre del estudiante</FieldLabel>
              <Input
                id="piar-name"
                value={name}
                autoComplete="off"
                maxLength={120}
                aria-invalid={!!errors.studentName}
                onChange={(e) => setName(e.target.value)}
              />
              <FieldError
                errors={[errors.studentName ? { message: errors.studentName } : undefined]}
              />
            </Field>
            <Field data-invalid={!!errors.consent}>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="piar-consent"
                  checked={consent}
                  onCheckedChange={(c) => setConsent(c === true)}
                  aria-invalid={!!errors.consent}
                  className="mt-0.5"
                />
                <label htmlFor="piar-consent" className="text-sm leading-snug">
                  Tengo la autorización del acudiente y del colegio para registrar estos datos (Ley
                  1581 de 2012).
                </label>
              </div>
              <FieldError errors={[errors.consent ? { message: errors.consent } : undefined]} />
            </Field>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Creando…" : "Crear PIAR"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
