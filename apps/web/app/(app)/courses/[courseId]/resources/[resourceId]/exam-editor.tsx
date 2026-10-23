"use client";

import { useState } from "react";
import {
  HiCheckCircle,
  HiOutlineArrowDown,
  HiOutlineArrowUp,
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import { SelectField } from "@/components/forms/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EXAM_LIMITS,
  EXAM_QUESTION_TYPE_LABELS,
  LEVELS,
  LEVEL_LABELS,
  examQuestionSchema,
  examTotalPoints,
  roundPoints,
  type ExamContent,
  type ExamQuestion,
  type ExamSection,
  type ResourceDetail,
} from "@/modules/resources/client";
import { ItemFeedback, RegenerateItem, type FeedbackActions } from "./item-tools";

// Editor del examen (SPEC-0011): secciones en su orden, preguntas con puntos, emparejamiento y
// preguntas abiertas con criterios. El servidor vuelve a validar todo al guardar.

const newId = () => `q-${Math.random().toString(36).slice(2, 10)}`;
const fmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const pts = (n: number) => `${fmt.format(n)} ${n === 1 ? "punto" : "puntos"}`;

type Topics = Map<string, string>;

export function ExamQuestionView({
  q,
  dba,
  topics,
}: {
  q: ExamQuestion;
  dba: Map<string, number>;
  topics: Topics;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm whitespace-pre-line">{q.stem}</p>
      {(q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") && (
        <ul className="flex flex-col gap-1 text-sm">
          {q.options.map((o) => (
            <li key={o} className="flex items-center gap-2">
              {o === q.answer ? (
                <HiCheckCircle className="text-primary" aria-label="Correcta" />
              ) : (
                <span className="inline-block size-4" aria-hidden />
              )}
              <span className={o === q.answer ? "font-medium" : undefined}>{o}</span>
            </li>
          ))}
        </ul>
      )}
      {(q.type === "SHORT_ANSWER" || q.type === "OPEN") && (
        <p className="text-sm">
          <span className="text-muted-foreground">Respuesta esperada:</span> {q.answer}
        </p>
      )}
      {q.type === "MATCHING" && (
        <div className="flex flex-col gap-1 text-sm">
          <ul aria-label="Parejas" className="flex flex-col gap-1">
            {q.pairs.map((p, i) => (
              <li key={i} className="flex flex-wrap gap-2">
                <span className="font-medium">
                  {i + 1}. {p.left}
                </span>
                <span className="text-muted-foreground">→</span>
                <span>{p.right}</span>
              </li>
            ))}
          </ul>
          {q.distractors.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Sobrantes en la columna B: {q.distractors.join(", ")}
            </p>
          )}
        </div>
      )}
      {q.type === "OPEN" && (
        <ul aria-label="Criterios de calificación" className="flex flex-col gap-1 text-sm">
          {q.criteria.map((c, i) => (
            <li key={i}>
              • {c.description} <span className="text-muted-foreground">({pts(c.points)})</span>
            </li>
          ))}
        </ul>
      )}
      {q.explanation && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Justificación:</span> {q.explanation}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        <Badge variant="brand">{pts(q.points)}</Badge>
        <Badge variant="outline">Tema: {topics.get(q.topicId) ?? "—"}</Badge>
        <Badge variant="outline">{LEVEL_LABELS[q.cognitiveLevel]}</Badge>
        {q.dbaCodes.map((c) => (
          <Badge key={c} variant="secondary">
            DBA {dba.get(c) ?? c}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ListEditor({
  label,
  values,
  onChange,
  max,
  min = 0,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  max: number;
  min?: number;
  placeholder?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            aria-label={`${label} ${i + 1}`}
            value={v}
            placeholder={placeholder}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Quitar ${label.toLowerCase()} ${i + 1}`}
            disabled={values.length <= min}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            <HiOutlineTrash aria-hidden />
          </Button>
        </div>
      ))}
      {values.length < max && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-fit"
          onClick={() => onChange([...values, ""])}
        >
          <HiOutlinePlus aria-hidden />
          Agregar
        </Button>
      )}
    </fieldset>
  );
}

function ExamQuestionForm({
  q,
  topics,
  onChange,
}: {
  q: ExamQuestion;
  topics: Topics;
  onChange: (q: ExamQuestion) => void;
}) {
  const criteriaSum = roundPoints(q.criteria.reduce((s, c) => s + (Number(c.points) || 0), 0));
  // CA-0011-05: el docente ve la diferencia antes de guardar.
  const issue = examQuestionSchema.safeParse(q).error?.issues[0]?.message;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor={`${q.id}-points`}>Puntos</FieldLabel>
          <Input
            id={`${q.id}-points`}
            type="number"
            min={0.1}
            step={0.5}
            value={Number.isFinite(q.points) ? q.points : ""}
            onChange={(e) => onChange({ ...q, points: Number(e.target.value) })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${q.id}-topic`}>Tema que evalúa</FieldLabel>
          <SelectField
            id={`${q.id}-topic`}
            value={q.topicId}
            onChange={(v) => onChange({ ...q, topicId: v })}
            options={[...topics].map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${q.id}-level`}>Nivel de pensamiento</FieldLabel>
          <SelectField
            id={`${q.id}-level`}
            value={q.cognitiveLevel}
            onChange={(v) =>
              onChange({ ...q, cognitiveLevel: v as ExamQuestion["cognitiveLevel"] })
            }
            options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`${q.id}-stem`}>
          {q.type === "MATCHING" ? "Instrucción" : "Enunciado"}
        </FieldLabel>
        <Textarea
          id={`${q.id}-stem`}
          rows={2}
          value={q.stem}
          onChange={(e) => onChange({ ...q, stem: e.target.value })}
        />
      </Field>

      {q.type === "MULTIPLE_CHOICE" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Opciones (marca la correcta)</legend>
          {q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${q.id}-answer`}
                aria-label={`Opción ${i + 1} es la correcta`}
                checked={o !== "" && o === q.answer}
                onChange={() => onChange({ ...q, answer: o })}
              />
              <Input
                aria-label={`Opción ${i + 1}`}
                value={o}
                onChange={(e) => {
                  const options = q.options.map((x, j) => (j === i ? e.target.value : x));
                  onChange({ ...q, options, answer: q.answer === o ? e.target.value : q.answer });
                }}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Quitar opción ${i + 1}`}
                disabled={q.options.length <= 2}
                onClick={() => onChange({ ...q, options: q.options.filter((_, j) => j !== i) })}
              >
                <HiOutlineTrash aria-hidden />
              </Button>
            </div>
          ))}
          {q.options.length < 6 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-fit"
              onClick={() => onChange({ ...q, options: [...q.options, ""] })}
            >
              <HiOutlinePlus aria-hidden />
              Agregar opción
            </Button>
          )}
        </fieldset>
      )}
      {q.type === "TRUE_FALSE" && (
        <Field>
          <FieldLabel htmlFor={`${q.id}-tf`}>Respuesta correcta</FieldLabel>
          <SelectField
            id={`${q.id}-tf`}
            value={q.answer}
            onChange={(v) => onChange({ ...q, answer: v })}
            options={[
              { value: "Verdadero", label: "Verdadero" },
              { value: "Falso", label: "Falso" },
            ]}
          />
        </Field>
      )}
      {(q.type === "SHORT_ANSWER" || q.type === "OPEN") && (
        <Field>
          <FieldLabel htmlFor={`${q.id}-answer`}>Respuesta esperada</FieldLabel>
          <Textarea
            id={`${q.id}-answer`}
            rows={q.type === "OPEN" ? 3 : 1}
            value={q.answer}
            onChange={(e) => onChange({ ...q, answer: e.target.value })}
          />
        </Field>
      )}
      {q.type === "MATCHING" && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              Parejas (entre {EXAM_LIMITS.pairs.min} y {EXAM_LIMITS.pairs.max})
            </legend>
            {q.pairs.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  aria-label={`Columna A, pareja ${i + 1}`}
                  value={p.left}
                  onChange={(e) =>
                    onChange({
                      ...q,
                      pairs: q.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)),
                    })
                  }
                />
                <Input
                  aria-label={`Columna B, pareja ${i + 1}`}
                  value={p.right}
                  onChange={(e) =>
                    onChange({
                      ...q,
                      pairs: q.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)),
                    })
                  }
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Quitar pareja ${i + 1}`}
                  onClick={() => onChange({ ...q, pairs: q.pairs.filter((_, j) => j !== i) })}
                >
                  <HiOutlineTrash aria-hidden />
                </Button>
              </div>
            ))}
            {q.pairs.length < EXAM_LIMITS.pairs.max && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-fit"
                onClick={() => onChange({ ...q, pairs: [...q.pairs, { left: "", right: "" }] })}
              >
                <HiOutlinePlus aria-hidden />
                Agregar pareja
              </Button>
            )}
          </fieldset>
          <ListEditor
            label="Sobrante de la columna B"
            values={q.distractors}
            max={EXAM_LIMITS.distractors}
            onChange={(distractors) => onChange({ ...q, distractors })}
          />
        </>
      )}
      {q.type === "OPEN" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Criterios de calificación</legend>
          {q.criteria.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
              <Input
                aria-label={`Criterio ${i + 1}`}
                value={c.description}
                onChange={(e) =>
                  onChange({
                    ...q,
                    criteria: q.criteria.map((x, j) =>
                      j === i ? { ...x, description: e.target.value } : x,
                    ),
                  })
                }
              />
              <Input
                aria-label={`Puntos del criterio ${i + 1}`}
                type="number"
                min={0.1}
                step={0.5}
                value={Number.isFinite(c.points) ? c.points : ""}
                onChange={(e) =>
                  onChange({
                    ...q,
                    criteria: q.criteria.map((x, j) =>
                      j === i ? { ...x, points: Number(e.target.value) } : x,
                    ),
                  })
                }
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Quitar criterio ${i + 1}`}
                disabled={q.criteria.length <= EXAM_LIMITS.criteria.min}
                onClick={() => onChange({ ...q, criteria: q.criteria.filter((_, j) => j !== i) })}
              >
                <HiOutlineTrash aria-hidden />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            {q.criteria.length < EXAM_LIMITS.criteria.max && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-fit"
                onClick={() =>
                  onChange({ ...q, criteria: [...q.criteria, { description: "", points: 1 }] })
                }
              >
                <HiOutlinePlus aria-hidden />
                Agregar criterio
              </Button>
            )}
            <span
              className={cn(
                "text-sm",
                Math.abs(criteriaSum - q.points) > 0.05
                  ? "font-semibold text-danger"
                  : "text-muted-foreground",
              )}
            >
              Suman {fmt.format(criteriaSum)} de {fmt.format(q.points || 0)}
            </span>
          </div>
        </fieldset>
      )}
      <Field>
        <FieldLabel htmlFor={`${q.id}-explanation`}>Justificación</FieldLabel>
        <Textarea
          id={`${q.id}-explanation`}
          rows={2}
          value={q.explanation}
          onChange={(e) => onChange({ ...q, explanation: e.target.value })}
        />
      </Field>
      {issue && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {issue}
        </p>
      )}
    </div>
  );
}

/** Pregunta nueva del tipo de la sección, con valores mínimos para que el docente la complete. */
function blankQuestion(section: ExamSection, topicId: string): ExamQuestion {
  const base = {
    id: newId(),
    type: section.questionType,
    stem: "",
    options: [] as string[],
    answer: "",
    explanation: "",
    pairs: [] as ExamQuestion["pairs"],
    distractors: [] as string[],
    criteria: [] as ExamQuestion["criteria"],
    points: section.questions[0]?.points ?? 1,
    topicId,
    cognitiveLevel: "UNDERSTAND" as const,
    dbaCodes: [] as string[],
  };
  if (section.questionType === "MULTIPLE_CHOICE") return { ...base, options: ["", "", "", ""] };
  if (section.questionType === "TRUE_FALSE") {
    return { ...base, options: ["Verdadero", "Falso"], answer: "Verdadero" };
  }
  if (section.questionType === "MATCHING") {
    return { ...base, pairs: Array.from({ length: 4 }, () => ({ left: "", right: "" })) };
  }
  if (section.questionType === "OPEN") {
    return { ...base, criteria: [{ description: "", points: base.points }] };
  }
  return base;
}

type Props = {
  resource: ResourceDetail;
  content: ExamContent;
  onChange: (content: ExamContent) => void;
  dirty: boolean;
  savedKeys: Set<string>;
  actions: FeedbackActions;
};

export function ExamEditor({ resource, content, onChange, dirty, savedKeys, actions }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const dba = new Map(resource.context.dba.map((d) => [d.code, d.number]));
  const topics: Topics = new Map(content.topics.map((t) => [t.id, t.title]));
  const total = examTotalPoints(content);
  const setSection = (id: string, next: Partial<ExamSection>) =>
    onChange({
      ...content,
      sections: content.sections.map((s) => (s.id === id ? { ...s, ...next } : s)),
    });
  let number = 0;

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="exam-title">Título</FieldLabel>
        <Input
          id="exam-title"
          value={content.title}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="exam-instructions">Instrucciones generales</FieldLabel>
        <Textarea
          id="exam-instructions"
          rows={2}
          value={content.instructions}
          onChange={(e) => onChange({ ...content, instructions: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="exam-duration">Duración (minutos)</FieldLabel>
          <Input
            id="exam-duration"
            type="number"
            min={1}
            max={EXAM_LIMITS.duration.max}
            value={content.durationMinutes}
            onChange={(e) => onChange({ ...content, durationMinutes: Number(e.target.value) })}
          />
        </Field>
        {/* §7: si los puntos no suman lo pedido se permite, con un aviso suave. */}
        <div className="flex flex-col justify-end gap-1 text-sm" role="status">
          <span className="font-semibold">Puntaje total: {pts(total)}</span>
          {Math.abs(total - content.targetPoints) > 0.05 && (
            <span className="text-warning">
              Suma {fmt.format(total)} de {fmt.format(content.targetPoints)}
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Temas: {content.topics.map((t) => t.title).join(", ")}
      </p>

      {content.sections.map((section, s) => {
        const sectionTotal = roundPoints(section.questions.reduce((a, q) => a + q.points, 0));
        const move = (i: number, delta: number) => {
          const next = [...section.questions];
          const [q] = next.splice(i, 1);
          next.splice(i + delta, 0, q!);
          setSection(section.id, { questions: next });
        };
        return (
          <section
            key={section.id}
            aria-label={`Sección ${s + 1}`}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-extrabold">
                Sección {s + 1}. {EXAM_QUESTION_TYPE_LABELS[section.questionType]}
              </h2>
              <Badge variant="brand">{pts(sectionTotal)}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${section.id}-title`}>Título de la sección</FieldLabel>
                <Input
                  id={`${section.id}-title`}
                  value={section.title}
                  onChange={(e) => setSection(section.id, { title: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${section.id}-instructions`}>Indicaciones</FieldLabel>
                <Input
                  id={`${section.id}-instructions`}
                  value={section.instructions}
                  onChange={(e) => setSection(section.id, { instructions: e.target.value })}
                />
              </Field>
            </div>
            <ol className="flex flex-col gap-3" aria-label={`Preguntas de la sección ${s + 1}`}>
              {section.questions.map((q, i) => {
                const label = `Pregunta ${++number}`;
                return (
                  <li key={q.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">{label}</h3>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Subir ${label}`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <HiOutlineArrowUp aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Bajar ${label}`}
                          disabled={i === section.questions.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <HiOutlineArrowDown aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Eliminar ${label}`}
                          disabled={section.questions.length <= 1}
                          onClick={() =>
                            setSection(section.id, {
                              questions: section.questions.filter((x) => x.id !== q.id),
                            })
                          }
                        >
                          <HiOutlineTrash aria-hidden />
                        </Button>
                      </div>
                    </div>
                    {editing === q.id ? (
                      <>
                        <ExamQuestionForm
                          q={q}
                          topics={topics}
                          onChange={(next) =>
                            setSection(section.id, {
                              questions: section.questions.map((x) => (x.id === q.id ? next : x)),
                            })
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-fit"
                          onClick={() => setEditing(null)}
                        >
                          Listo
                        </Button>
                      </>
                    ) : (
                      <ExamQuestionView q={q} dba={dba} topics={topics} />
                    )}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {editing !== q.id && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(q.id)}
                          >
                            <HiOutlinePencilSquare aria-hidden />
                            Editar
                          </Button>
                        )}
                        <RegenerateItem<ExamQuestion>
                          resourceId={resource.id}
                          itemKey={q.id}
                          label={label}
                          disabledReason={
                            dirty || !savedKeys.has(q.id)
                              ? "Guarda tus cambios antes de regenerar"
                              : null
                          }
                          renderProposal={(item) => (
                            <ExamQuestionView q={item} dba={dba} topics={topics} />
                          )}
                          actions={actions}
                        />
                      </div>
                      {savedKeys.has(q.id) && (
                        <ItemFeedback
                          resourceId={resource.id}
                          courseId={resource.courseId}
                          itemKey={q.id}
                          label={label}
                          initial={resource.itemFeedback[q.id]}
                          actions={actions}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {section.questions.length < EXAM_LIMITS.perSection[section.questionType] && (
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => {
                  const q = blankQuestion(section, content.topics[0]!.id);
                  setSection(section.id, { questions: [...section.questions, q] });
                  setEditing(q.id);
                }}
              >
                <HiOutlinePlus aria-hidden />
                Agregar pregunta a {section.title}
              </Button>
            )}
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Las preguntas se numeran de corrido en todo el examen; en las versiones B a D cambian de
        orden dentro de su sección.
      </p>
    </div>
  );
}
