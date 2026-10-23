"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action-result";
import type { CurriculumAreaId } from "@/lib/curriculum-areas";

type Props = {
  subjectId: string;
  subjectName: string;
  areas: { id: CurriculumAreaId; name: string }[];
  action: (input: { subjectId: string; areaId: CurriculumAreaId | null }) => Promise<ActionResult>;
};

/** RN-07: una asignatura sin área explica cómo vincularla, en vez de mostrar una lista vacía. */
export function LinkSubjectArea({ subjectId, subjectName, areas, action }: Props) {
  const router = useRouter();
  const [areaId, setAreaId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await action({ subjectId, areaId: areaId as CurriculumAreaId });
      if (!result.ok) {
        sileo.error({ title: "No pudimos vincular la asignatura", description: result.error });
        return;
      }
      sileo.success({ title: "Asignatura vinculada" });
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vincula «{subjectName}» a un área curricular</CardTitle>
        <CardDescription>
          Así verás los referentes oficiales del MEN para tus cursos de esta asignatura. Afecta a
          todos los cursos de «{subjectName}» en este espacio.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field className="flex-1">
          <FieldLabel htmlFor="areaId">Área curricular</FieldLabel>
          <SelectField
            id="areaId"
            value={areaId}
            onChange={setAreaId}
            placeholder="Elige el área"
            options={areas.map((a) => ({ value: a.id, label: a.name }))}
          />
        </Field>
        <Button onClick={save} disabled={!areaId || isPending}>
          Vincular a un área curricular
        </Button>
      </CardContent>
    </Card>
  );
}
