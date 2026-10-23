"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { HiOutlineArchiveBox, HiOutlineArrowUturnLeft, HiOutlinePlus } from "react-icons/hi2";
import { sileo } from "sileo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { subjectSchema, type SubjectInput } from "@/modules/courses/client";

type SubjectItem = { id: string; name: string; isPreloaded: boolean; archived: boolean };

type Props = {
  subjects: SubjectItem[];
  canArchive: boolean;
  createSubject: (input: SubjectInput) => Promise<ActionResult<{ id: string; name: string }>>;
  setSubjectArchived: (input: { subjectId: string; archived: boolean }) => Promise<ActionResult>;
};

export function SubjectsView({ subjects, canArchive, createSubject, setSubjectArchived }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<SubjectInput>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const add = form.handleSubmit(async (values) => {
    const result = await createSubject(values);
    if (!result.ok) {
      form.setError("name", { message: result.fieldErrors?.name?.[0] ?? result.error });
      return;
    }
    sileo.success({ title: "Asignatura agregada" });
    form.reset();
    router.refresh();
  });

  const toggle = (subject: SubjectItem) =>
    startTransition(async () => {
      const result = await setSubjectArchived({
        subjectId: subject.id,
        archived: !subject.archived,
      });
      if (!result.ok) {
        sileo.error({ title: "No pudimos actualizar la asignatura", description: result.error });
        return;
      }
      router.refresh();
    });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Asignaturas</h1>
        <p className="text-muted-foreground">
          Incluye las áreas obligatorias de la Ley 115. Agrega las que dictes y no estén.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agregar asignatura</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={add}
            noValidate
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <Field data-invalid={!!errors.name} className="flex-1">
              <FieldLabel htmlFor="subject-name" className="sr-only">
                Nombre de la asignatura
              </FieldLabel>
              <Input
                id="subject-name"
                placeholder="Ej.: Química, Estadística, Robótica"
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Button type="submit" disabled={isSubmitting}>
              <HiOutlinePlus aria-hidden />
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asignaturas del espacio</CardTitle>
          <CardDescription>{subjects.filter((s) => !s.archived).length} activas</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y" aria-label="Asignaturas">
            {subjects.map((subject) => (
              <li key={subject.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={subject.archived ? "text-muted-foreground line-through" : ""}>
                    {subject.name}
                  </span>
                  {subject.isPreloaded && <Badge variant="secondary">Ley 115</Badge>}
                  {subject.archived && <Badge variant="outline">Archivada</Badge>}
                </span>
                {canArchive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => toggle(subject)}
                    aria-label={`${subject.archived ? "Restaurar" : "Archivar"} ${subject.name}`}
                  >
                    {subject.archived ? (
                      <HiOutlineArrowUturnLeft aria-hidden />
                    ) : (
                      <HiOutlineArchiveBox aria-hidden />
                    )}
                    {subject.archived ? "Restaurar" : "Archivar"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
