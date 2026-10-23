"use client";

import { useState } from "react";
import { HiOutlineArrowRight } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { TopicOutline } from "@/modules/planning/client";
import { EXAM_LIMITS, type ExamScope } from "@/modules/resources/client";

type Props = {
  units: TopicOutline["units"];
  /** Temas marcados al llegar (los de la unidad o el periodo de origen, o los del borrador). */
  initial: string[];
  scope: ExamScope;
  onContinue: (topicIds: string[], scope: ExamScope) => void;
};

const periodLabel = (n: number | null) => (n ? `Periodo ${n}` : "Sin periodo");

/**
 * SPEC-0011 §2: el examen cubre varios temas del mismo curso, de cualquier unidad o periodo
 * (decisión 5). Se puede marcar una unidad o un periodo completo de un toque.
 */
export function ExamTopicsStep({ units, initial, scope, onContinue }: Props) {
  const [selected, setSelected] = useState<string[]>(initial);
  const withTopics = units.filter((u) => u.topics.length > 0);
  const periods = [...new Set(withTopics.map((u) => u.periodNumber))].sort(
    (a, b) => (a ?? 99) - (b ?? 99),
  );
  const max = EXAM_LIMITS.topics.max;

  const toggle = (ids: string[], on: boolean) =>
    setSelected((current) => {
      const next = on
        ? [...current, ...ids.filter((id) => !current.includes(id))]
        : current.filter((id) => !ids.includes(id));
      return next.slice(0, max);
    });

  // El alcance solo se conserva si lo marcado sigue siendo exactamente esa unidad o ese periodo.
  const scopeFor = (ids: string[]): ExamScope => {
    const same = (topicIds: string[]) =>
      topicIds.length === ids.length && topicIds.every((id) => ids.includes(id));
    if (scope.kind === "UNIT") {
      const unit = units.find((u) => u.id === scope.unitId);
      if (unit && same(unit.topics.map((t) => t.id))) return scope;
    }
    if (scope.kind === "PERIOD") {
      const topics = units
        .filter((u) => u.periodNumber === scope.periodNumber)
        .flatMap((u) => u.topics.map((t) => t.id));
      if (same(topics)) return scope;
    }
    return { kind: "TOPICS" };
  };

  // Los temas en el orden de la planeación, no en el orden en que se marcaron.
  const ordered = withTopics
    .flatMap((u) => u.topics.map((t) => t.id))
    .filter((id) => selected.includes(id));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold">¿Qué temas evalúa?</h2>
        <p className="text-sm text-muted-foreground">
          Marca los temas del examen. Puedes mezclar unidades y periodos (máximo {max}).
        </p>
      </div>
      {periods.map((period) => {
        const periodUnits = withTopics.filter((u) => u.periodNumber === period);
        const periodIds = periodUnits.flatMap((u) => u.topics.map((t) => t.id));
        const allPeriod = periodIds.every((id) => selected.includes(id));
        return (
          <section
            key={period ?? "none"}
            aria-label={periodLabel(period)}
            className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">{periodLabel(period)}</h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => toggle(periodIds, !allPeriod)}
              >
                {allPeriod ? "Quitar el periodo" : "Todo el periodo"}
              </Button>
            </div>
            {periodUnits.map((unit) => {
              const unitIds = unit.topics.map((t) => t.id);
              const allUnit = unitIds.every((id) => selected.includes(id));
              return (
                <div key={unit.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-muted-foreground">{unit.title}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="link"
                      onClick={() => toggle(unitIds, !allUnit)}
                    >
                      {allUnit ? "Quitar la unidad" : "Toda la unidad"}
                    </Button>
                  </div>
                  <ul aria-label={`Temas de ${unit.title}`} className="grid gap-2 sm:grid-cols-2">
                    {unit.topics.map((t) => {
                      const id = `exam-topic-${t.id}`;
                      const checked = selected.includes(t.id);
                      return (
                        <li
                          key={t.id}
                          className="flex items-center gap-3 rounded-2xl border border-border p-3"
                        >
                          <Checkbox
                            id={id}
                            aria-labelledby={`${id}-label`}
                            checked={checked}
                            disabled={!checked && selected.length >= max}
                            onCheckedChange={(c) => toggle([t.id], !!c)}
                          />
                          <label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold">
                            {t.title}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="xl"
          disabled={ordered.length === 0}
          onClick={() => onContinue(ordered, scopeFor(ordered))}
        >
          {ordered.length === 0
            ? "Elige al menos un tema"
            : `Continuar con ${ordered.length} ${ordered.length === 1 ? "tema" : "temas"}`}
          <HiOutlineArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
