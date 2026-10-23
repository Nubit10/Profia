"use client";

import { useState } from "react";
import { HiOutlineCalculator } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import {
  gradeFor,
  gradingScaleSchema,
  passingPointsFor,
  type GradingScale,
} from "@/modules/resources/client";
import { useRun } from "../../planning/use-run";

const fmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const grade = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type Props = {
  resourceId: string;
  total: number;
  initial: GradingScale;
  save: (input: {
    resourceId: string;
    passingGrade: number;
    passingPoints: number | null;
  }) => Promise<ActionResult>;
};

/**
 * SPEC-0011 RN-14: la clave trae la tabla de conversión a 1,0–5,0. El docente ajusta la nota
 * mínima y, si quiere, el puntaje con el que se aprueba. No cambia la versión del examen.
 */
export function GradingScalePanel({ resourceId, total, initial, save }: Props) {
  const { run, isPending } = useRun();
  const [passingGrade, setPassingGrade] = useState(String(initial.passingGrade));
  const [passingPoints, setPassingPoints] = useState(
    initial.passingPoints === null ? "" : String(initial.passingPoints),
  );
  const parsed = gradingScaleSchema.safeParse({
    passingGrade: Number(passingGrade.replace(",", ".")),
    passingPoints: passingPoints.trim() === "" ? null : Number(passingPoints.replace(",", ".")),
  });
  const tooHigh = parsed.success && (parsed.data.passingPoints ?? 0) >= total;
  const error = !parsed.success
    ? parsed.error.issues[0]?.message
    : tooHigh
      ? `El puntaje para aprobar debe ser menor que el total (${fmt.format(total)})`
      : null;
  const scale = parsed.success && !tooHigh ? parsed.data : initial;
  const passing = passingPointsFor(total, scale);

  return (
    <section
      aria-labelledby="grading-title"
      className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
          <HiOutlineCalculator className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="grading-title" className="font-bold">
            Nota del examen (1,0 a 5,0)
          </h2>
          <p className="text-sm text-muted-foreground">
            La clave trae la tabla para pasar de puntos a nota. Ajústala a la escala de tu colegio.
          </p>
        </div>
      </div>
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed.success || tooHigh) return;
          run(
            () =>
              save({
                resourceId,
                passingGrade: parsed.data.passingGrade,
                passingPoints: parsed.data.passingPoints,
              }),
            "Escala guardada",
          );
        }}
      >
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="passing-grade">Nota mínima para aprobar</FieldLabel>
          <Input
            id="passing-grade"
            inputMode="decimal"
            value={passingGrade}
            onChange={(e) => setPassingGrade(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="passing-points">Puntos para aprobar (opcional)</FieldLabel>
          <Input
            id="passing-points"
            inputMode="decimal"
            placeholder={fmt.format(passingPointsFor(total, { ...scale, passingPoints: null }))}
            value={passingPoints}
            onChange={(e) => setPassingPoints(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="outline" disabled={isPending || !!error}>
          Guardar escala
        </Button>
        <div className="sm:col-span-3">
          <FieldError errors={error ? [{ message: error }] : []} />
          {!error && (
            <FieldDescription>
              Con {fmt.format(passing)} de {fmt.format(total)} puntos la nota es{" "}
              {grade.format(gradeFor(passing, total, scale))}; con {fmt.format(total)}, 5,0.
            </FieldDescription>
          )}
        </div>
      </form>
    </section>
  );
}
