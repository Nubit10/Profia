"use client";

import Link from "next/link";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { DbaChip } from "@/components/curriculum/dba-chip";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_GRADING_BANDS,
  PERFORMANCE_LABELS,
  bandRange,
} from "@/modules/institutions/client";
import {
  LESSON_PLAN_LIMITS,
  RUBRIC_COLUMNS,
  sessionMinutes,
  type LessonPlanContent,
  type LessonSession,
  type ResourceDetail,
  type RubricRow,
} from "@/modules/resources/client";

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const MOMENTS = [
  { key: "start", minutes: "startMinutes", label: "Inicio" },
  { key: "development", minutes: "developmentMinutes", label: "Desarrollo" },
  { key: "closure", minutes: "closureMinutes", label: "Cierre" },
] as const;

type Props = {
  resource: ResourceDetail;
  content: LessonPlanContent;
  onChange: (content: LessonPlanContent) => void;
};

/**
 * SPEC-0024: el plan se edita a mano (no hay regenerar sesión). Cada cambio queda en la barra de
 * "Guardar cambios" y crea una versión nueva; la de la IA sigue intacta (CA-0024-05).
 */
export function LessonPlanEditor({ resource, content, onChange }: Props) {
  const dba = new Map(resource.context.dba.map((d) => [d.code, d.number]));
  const planned =
    resource.blueprint.type === "LESSON_PLAN" ? resource.blueprint.minutesPerSession : null;
  const scale = resource.gradingBands ?? DEFAULT_GRADING_BANDS;
  const setSession = (i: number, patch: Partial<LessonSession>) =>
    onChange({
      ...content,
      sessions: content.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });
  const setRow = (i: number, patch: Partial<RubricRow>) =>
    onChange({
      ...content,
      rubric: content.rubric.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    });

  return (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="lp-title">Título</FieldLabel>
        <Input
          id="lp-title"
          value={content.title}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="lp-purpose">Propósito</FieldLabel>
        <Textarea
          id="lp-purpose"
          rows={3}
          value={content.purpose}
          onChange={(e) => onChange({ ...content, purpose: e.target.value })}
        />
      </Field>

      <section aria-labelledby="lp-sessions" className="flex flex-col gap-4">
        <h2 id="lp-sessions" className="text-lg font-bold">
          Secuencia didáctica
        </h2>
        <ol className="flex flex-col gap-4" aria-label="Sesiones">
          {content.sessions.map((s, i) => {
            const total = sessionMinutes(s);
            const off = planned !== null && Math.abs(total - planned) > planned * 0.1;
            return (
              <li
                key={s.number}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
                data-testid="lesson-session"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">Sesión {s.number}</h3>
                  <span
                    className={off ? "text-sm text-warning" : "text-sm text-muted-foreground"}
                    role={off ? "status" : undefined}
                  >
                    {total} minutos{off && planned ? ` (planeado: ${planned})` : ""}
                  </span>
                </div>
                <Field>
                  <FieldLabel htmlFor={`lp-s${i}-title`}>Título de la sesión</FieldLabel>
                  <Input
                    id={`lp-s${i}-title`}
                    value={s.title}
                    onChange={(e) => setSession(i, { title: e.target.value })}
                  />
                </Field>
                {MOMENTS.map((m) => (
                  <div
                    key={m.key}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_6rem] sm:items-start"
                  >
                    <Field>
                      <FieldLabel htmlFor={`lp-s${i}-${m.key}`}>
                        {m.label} · sesión {s.number}
                      </FieldLabel>
                      <Textarea
                        id={`lp-s${i}-${m.key}`}
                        rows={m.key === "development" ? 5 : 3}
                        value={s[m.key]}
                        onChange={(e) => setSession(i, { [m.key]: e.target.value })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`lp-s${i}-${m.minutes}`}>Minutos</FieldLabel>
                      <Input
                        id={`lp-s${i}-${m.minutes}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={120}
                        value={s[m.minutes]}
                        onChange={(e) =>
                          setSession(i, { [m.minutes]: Number(e.target.value) || 0 })
                        }
                      />
                    </Field>
                  </div>
                ))}
                <Field>
                  <FieldLabel htmlFor={`lp-s${i}-resources`}>Recursos</FieldLabel>
                  <Textarea
                    id={`lp-s${i}-resources`}
                    rows={2}
                    defaultValue={s.resources.join("\n")}
                    onBlur={(e) =>
                      setSession(i, {
                        resources: lines(e.target.value).slice(0, LESSON_PLAN_LIMITS.resources),
                      })
                    }
                  />
                  <FieldDescription>
                    Uno por línea (máximo {LESSON_PLAN_LIMITS.resources}).
                  </FieldDescription>
                </Field>
                {s.dbaCodes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.dbaCodes.map((c) => (
                      <DbaChip key={c} code={c} number={dba.get(c)} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="lp-evaluation" className="flex flex-col gap-3">
        <h2 id="lp-evaluation" className="text-lg font-bold">
          Evaluación
        </h2>
        <Field>
          <FieldLabel htmlFor="lp-evidence">Evidencias de aprendizaje</FieldLabel>
          <Textarea
            id="lp-evidence"
            rows={3}
            value={content.evaluation.evidence}
            onChange={(e) =>
              onChange({
                ...content,
                evaluation: { ...content.evaluation, evidence: e.target.value },
              })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="lp-instruments">Instrumentos</FieldLabel>
          <Textarea
            id="lp-instruments"
            rows={2}
            defaultValue={content.evaluation.instruments.join("\n")}
            onBlur={(e) =>
              onChange({
                ...content,
                evaluation: { ...content.evaluation, instruments: lines(e.target.value) },
              })
            }
          />
          <FieldDescription>Uno por línea.</FieldDescription>
        </Field>
      </section>

      <section aria-labelledby="lp-rubric" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="lp-rubric" className="text-lg font-bold">
            Rúbrica por desempeños
          </h2>
          <Link
            href="/grading-scale"
            className="text-sm font-medium text-brand-strong underline-offset-4 hover:underline"
          >
            Escala de valoración
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Los rangos salen de la escala de tu espacio; si cambia, la rúbrica los muestra al día.
        </p>
        <ol className="flex flex-col gap-4" aria-label="Criterios de la rúbrica">
          {content.rubric.map((row, i) => (
            <li
              key={i}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
              data-testid="rubric-row"
            >
              <div className="flex items-end gap-2">
                <Field className="flex-1">
                  <FieldLabel htmlFor={`lp-r${i}-criterion`}>Criterio {i + 1}</FieldLabel>
                  <Input
                    id={`lp-r${i}-criterion`}
                    value={row.criterion}
                    onChange={(e) => setRow(i, { criterion: e.target.value })}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar criterio ${i + 1}`}
                  disabled={content.rubric.length <= LESSON_PLAN_LIMITS.rubric.min}
                  onClick={() =>
                    onChange({ ...content, rubric: content.rubric.filter((_, j) => j !== i) })
                  }
                >
                  <HiOutlineTrash aria-hidden />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {RUBRIC_COLUMNS.map(({ key, level }) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`lp-r${i}-${key}`}>
                      {PERFORMANCE_LABELS[level]}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({bandRange(scale, level)})
                      </span>
                    </FieldLabel>
                    <Textarea
                      id={`lp-r${i}-${key}`}
                      rows={3}
                      value={row[key]}
                      onChange={(e) => setRow(i, { [key]: e.target.value })}
                    />
                  </Field>
                ))}
              </div>
            </li>
          ))}
        </ol>
        {content.rubric.length < LESSON_PLAN_LIMITS.rubric.max && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-fit"
            onClick={() =>
              onChange({
                ...content,
                rubric: [
                  ...content.rubric,
                  { criterion: "", superior: "", high: "", basic: "", low: "" },
                ],
              })
            }
          >
            <HiOutlinePlus aria-hidden />
            Agregar criterio
          </Button>
        )}
      </section>

      <Field>
        <FieldLabel htmlFor="lp-diversity">Ajustes para la diversidad</FieldLabel>
        <Textarea
          id="lp-diversity"
          rows={4}
          value={content.diversity}
          onChange={(e) => onChange({ ...content, diversity: e.target.value })}
        />
        <FieldDescription>Sugerencias para el grupo, sin datos de estudiantes.</FieldDescription>
      </Field>
    </div>
  );
}
