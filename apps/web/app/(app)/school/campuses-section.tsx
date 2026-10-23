"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  HiOutlineArchiveBox,
  HiOutlineArrowUturnLeft,
  HiOutlineCheck,
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineXMark,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { campusNameSchema } from "@/modules/institutions/client";

type Campus = { id: string; name: string; archived: boolean };
type NameInput = { name: string };

type Props = {
  campuses: Campus[];
  createCampus: (input: NameInput) => Promise<ActionResult>;
  renameCampus: (input: NameInput & { campusId: string }) => Promise<ActionResult>;
  setCampusArchived: (input: { campusId: string; archived: boolean }) => Promise<ActionResult>;
};

export function CampusesSection({
  campuses,
  createCampus,
  renameCampus,
  setCampusArchived,
}: Props) {
  const router = useRouter();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<NameInput>({
    resolver: zodResolver(campusNameSchema),
    defaultValues: { name: "" },
  });

  const add = form.handleSubmit(async (values) => {
    const result = await createCampus(values);
    if (!result.ok) {
      form.setError("name", { message: result.fieldErrors?.name?.[0] ?? result.error });
      return;
    }
    sileo.success({ title: "Sede agregada" });
    form.reset();
    router.refresh();
  });

  const toggle = (campus: Campus) =>
    startTransition(async () => {
      const result = await setCampusArchived({ campusId: campus.id, archived: !campus.archived });
      if (!result.ok) {
        sileo.error({ title: "No pudimos actualizar la sede", description: result.error });
        return;
      }
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sedes</CardTitle>
        <CardDescription>
          Los profesores eligen la sede al crear sus cursos. Siempre queda al menos una activa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="divide-y" aria-label="Sedes">
          {campuses.map((campus) => (
            <li key={campus.id} className="flex items-center justify-between gap-3 py-2.5">
              {renaming === campus.id ? (
                <RenameCampus
                  campus={campus}
                  onCancel={() => setRenaming(null)}
                  onSave={async (name) => {
                    const result = await renameCampus({ campusId: campus.id, name });
                    if (result.ok) {
                      setRenaming(null);
                      router.refresh();
                    }
                    return result;
                  }}
                />
              ) : (
                <>
                  <span className="flex items-center gap-2">
                    <span className={campus.archived ? "text-muted-foreground line-through" : ""}>
                      {campus.name}
                    </span>
                    {campus.archived && <Badge variant="outline">Archivada</Badge>}
                  </span>
                  <span className="flex gap-1">
                    {!campus.archived && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRenaming(campus.id)}
                        aria-label={`Renombrar ${campus.name}`}
                      >
                        <HiOutlinePencilSquare aria-hidden />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => toggle(campus)}
                    >
                      {campus.archived ? (
                        <HiOutlineArrowUturnLeft aria-hidden />
                      ) : (
                        <HiOutlineArchiveBox aria-hidden />
                      )}
                      {campus.archived ? "Restaurar" : "Archivar"}
                    </Button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={add} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field data-invalid={!!form.formState.errors.name} className="flex-1">
            <FieldLabel htmlFor="campus-name" className="sr-only">
              Nombre de la nueva sede
            </FieldLabel>
            <Input
              id="campus-name"
              placeholder="Nombre de la nueva sede"
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
            <HiOutlinePlus aria-hidden />
            Agregar sede
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RenameCampus({
  campus,
  onCancel,
  onSave,
}: {
  campus: Campus;
  onCancel: () => void;
  onSave: (name: string) => Promise<ActionResult>;
}) {
  const form = useForm<NameInput>({
    resolver: zodResolver(campusNameSchema),
    defaultValues: { name: campus.name },
  });
  const submit = form.handleSubmit(async ({ name }) => {
    const result = await onSave(name);
    if (!result.ok)
      form.setError("name", { message: result.fieldErrors?.name?.[0] ?? result.error });
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-1 items-start gap-2">
      <Field data-invalid={!!form.formState.errors.name} className="flex-1">
        <FieldLabel htmlFor={`rename-${campus.id}`} className="sr-only">
          Nuevo nombre
        </FieldLabel>
        <Input id={`rename-${campus.id}`} autoFocus {...form.register("name")} />
        <FieldError errors={[form.formState.errors.name]} />
      </Field>
      <Button type="submit" size="sm" aria-label="Guardar nombre">
        <HiOutlineCheck aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} aria-label="Cancelar">
        <HiOutlineXMark aria-hidden />
      </Button>
    </form>
  );
}
