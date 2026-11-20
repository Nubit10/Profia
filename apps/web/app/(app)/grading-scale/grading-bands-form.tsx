"use client";

import { useState } from "react";
import { HiOutlineScale } from "react-icons/hi2";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import {
  DEFAULT_GRADING_BANDS,
  PERFORMANCE_LABELS,
  PERFORMANCE_LEVELS,
  SCALE_MAXIMUMS,
  formatScore,
  gradingBandsSchema,
  scaleStep,
  suggestedBands,
  type GradingBands,
  type PerformanceLevel,
  type ScaleMax,
} from "@/modules/institutions/client";
import { useRun } from "../courses/[courseId]/planning/use-run";

type Props = {
  initial: GradingBands;
  canEdit: boolean;
  save: (input: GradingBands) => Promise<ActionResult>;
};

const num = (v: string) => Number(v.replace(",", ".").trim());
const show = (v: number, max: number) => formatScore(v, max);

/**
 * SPEC-0024 RN-04: el docente escribe la nota mínima y hasta dónde llega cada desempeño; el
 * "desde" de cada uno sale del anterior (así no hay huecos). Superior termina en la nota máxima.
 */
export function GradingBandsForm({ initial, canEdit, save }: Props) {
  const { run, isPending } = useRun();
  const [max, setMax] = useState<ScaleMax>(initial.max as ScaleMax);
  const [min, setMin] = useState(show(initial.min, initial.max));
  const [tops, setTops] = useState<Record<Exclude<PerformanceLevel, "SUPERIOR">, string>>({
    LOW: show(initial.bands.LOW.to, initial.max),
    BASIC: show(initial.bands.BASIC.to, initial.max),
    HIGH: show(initial.bands.HIGH.to, initial.max),
  });

  const reset = (scale: GradingBands) => {
    setMax(scale.max as ScaleMax);
    setMin(show(scale.min, scale.max));
    setTops({
      LOW: show(scale.bands.LOW.to, scale.max),
      BASIC: show(scale.bands.BASIC.to, scale.max),
      HIGH: show(scale.bands.HIGH.to, scale.max),
    });
  };

  const step = scaleStep(max);
  const next = (v: number) => Math.round((v + step) * 10) / 10;
  const minValue = num(min);
  const candidate: GradingBands = {
    min: minValue,
    max,
    bands: {
      LOW: { from: minValue, to: num(tops.LOW) },
      BASIC: { from: next(num(tops.LOW)), to: num(tops.BASIC) },
      HIGH: { from: next(num(tops.BASIC)), to: num(tops.HIGH) },
      SUPERIOR: { from: next(num(tops.HIGH)), to: max },
    },
  };
  const parsed = gradingBandsSchema.safeParse(candidate);
  const error = parsed.success ? null : (parsed.error.issues[0]?.message ?? "Revisa la escala");

  return (
    <section
      aria-labelledby="bands-title"
      className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
          <HiOutlineScale className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="bands-title" className="font-bold">
            Desempeños (Decreto 1290)
          </h2>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "Escribe hasta dónde llega cada desempeño. El siguiente empieza justo después."
              : "Solo el administrador del colegio puede cambiar la escala."}
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed.success || !canEdit) return;
          run(() => save(parsed.data), "Escala guardada");
        }}
      >
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="scale-max">Nota máxima</FieldLabel>
              <SelectField
                id="scale-max"
                value={String(max)}
                disabled={!canEdit}
                onChange={(v) => reset(suggestedBands(Number(v) as ScaleMax))}
                options={SCALE_MAXIMUMS.map((m) => ({ value: String(m), label: String(m) }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="scale-min">Nota mínima</FieldLabel>
              <Input
                id="scale-min"
                inputMode="decimal"
                value={min}
                onChange={(e) => setMin(e.target.value)}
              />
            </Field>
          </div>

          <ol className="flex flex-col gap-3" aria-label="Rangos de los desempeños">
            {PERFORMANCE_LEVELS.map((level) => {
              const band = candidate.bands[level];
              const from = Number.isFinite(band.from) ? show(band.from, max) : "—";
              return (
                <li
                  key={level}
                  className="grid grid-cols-[6rem_1fr] items-center gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[8rem_1fr_1fr]"
                >
                  <span className="font-medium">{PERFORMANCE_LABELS[level]}</span>
                  <span className="text-sm text-muted-foreground">Desde {from}</span>
                  {level === "SUPERIOR" ? (
                    <span className="text-sm text-muted-foreground max-sm:col-start-2">
                      Hasta {show(max, max)}
                    </span>
                  ) : (
                    <Field className="max-sm:col-start-2">
                      <FieldLabel htmlFor={`band-${level}`} className="sr-only">
                        {PERFORMANCE_LABELS[level]}: hasta
                      </FieldLabel>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground" aria-hidden>
                          Hasta
                        </span>
                        <Input
                          id={`band-${level}`}
                          inputMode="decimal"
                          className="max-w-28"
                          value={tops[level]}
                          onChange={(e) => setTops({ ...tops, [level]: e.target.value })}
                        />
                      </div>
                    </Field>
                  )}
                </li>
              );
            })}
          </ol>
        </fieldset>

        <FieldError errors={error ? [{ message: error }] : []} />
        {!error && (
          <FieldDescription>
            {step < 1 ? "Usa una cifra decimal (por ejemplo 3,9)." : "Usa números enteros."}
          </FieldDescription>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isPending || !!error}>
              Guardar escala
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => reset(DEFAULT_GRADING_BANDS)}
            >
              Usar la nacional (1,0 a 5,0)
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
