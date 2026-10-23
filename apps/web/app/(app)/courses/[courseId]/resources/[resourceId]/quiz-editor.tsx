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
import {
  LEVELS,
  LEVEL_LABELS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type QuestionType,
  type QuizContent,
  type QuizQuestion,
  type ResourceDetail,
} from "@/modules/resources/client";
import { ItemFeedback, RegenerateItem, type FeedbackActions } from "./item-tools";

const newId = () => `q-${Math.random().toString(36).slice(2, 10)}`;

export function QuestionView({ q, dba }: { q: QuizQuestion; dba: Map<string, number> }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm whitespace-pre-line">{q.stem}</p>
      {q.type !== "SHORT_ANSWER" ? (
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
      ) : (
        <p className="text-sm">
          <span className="text-muted-foreground">Respuesta esperada:</span> {q.answer}
        </p>
      )}
      {q.explanation && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Justificación:</span> {q.explanation}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline">{QUESTION_TYPE_LABELS[q.type]}</Badge>
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

function QuestionForm({ q, onChange }: { q: QuizQuestion; onChange: (q: QuizQuestion) => void }) {
  const setType = (type: QuestionType) =>
    onChange({
      ...q,
      type,
      options:
        type === "TRUE_FALSE"
          ? ["Verdadero", "Falso"]
          : type === "MULTIPLE_CHOICE"
            ? q.type === "MULTIPLE_CHOICE"
              ? q.options
              : ["", "", "", ""]
            : [],
      answer: type === "TRUE_FALSE" ? "Verdadero" : type === "MULTIPLE_CHOICE" ? "" : q.answer,
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${q.id}-type`}>Tipo</FieldLabel>
          <SelectField
            id={`${q.id}-type`}
            value={q.type}
            onChange={(v) => setType(v as QuestionType)}
            options={QUESTION_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${q.id}-level`}>Nivel de pensamiento</FieldLabel>
          <SelectField
            id={`${q.id}-level`}
            value={q.cognitiveLevel}
            onChange={(v) =>
              onChange({ ...q, cognitiveLevel: v as QuizQuestion["cognitiveLevel"] })
            }
            options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`${q.id}-stem`}>Enunciado</FieldLabel>
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
      {q.type === "SHORT_ANSWER" && (
        <Field>
          <FieldLabel htmlFor={`${q.id}-answer`}>Respuesta esperada</FieldLabel>
          <Input
            id={`${q.id}-answer`}
            value={q.answer}
            onChange={(e) => onChange({ ...q, answer: e.target.value })}
          />
        </Field>
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
    </div>
  );
}

type Props = {
  resource: ResourceDetail;
  content: QuizContent;
  onChange: (content: QuizContent) => void;
  dirty: boolean;
  /** Ítems ya guardados: solo esos se pueden regenerar o calificar. */
  savedKeys: Set<string>;
  actions: FeedbackActions;
};

export function QuizEditor({ resource, content, onChange, dirty, savedKeys, actions }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const dba = new Map(resource.context.dba.map((d) => [d.code, d.number]));
  const questions = content.questions;
  const setQuestions = (next: QuizQuestion[]) => onChange({ ...content, questions: next });
  const move = (i: number, delta: number) => {
    const next = [...questions];
    const [q] = next.splice(i, 1);
    next.splice(i + delta, 0, q!);
    setQuestions(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="quiz-title">Título</FieldLabel>
        <Input
          id="quiz-title"
          value={content.title}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="quiz-instructions">Instrucciones para el estudiante</FieldLabel>
        <Textarea
          id="quiz-instructions"
          rows={2}
          value={content.instructions}
          onChange={(e) => onChange({ ...content, instructions: e.target.value })}
        />
      </Field>

      <ol className="flex flex-col gap-3" aria-label="Preguntas">
        {questions.map((q, i) => {
          const label = `Pregunta ${i + 1}`;
          return (
            <li key={q.id} className="flex flex-col gap-3 rounded-lg border p-4">
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
                    disabled={i === questions.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <HiOutlineArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Eliminar ${label}`}
                    disabled={questions.length <= 1}
                    onClick={() => setQuestions(questions.filter((x) => x.id !== q.id))}
                  >
                    <HiOutlineTrash aria-hidden />
                  </Button>
                </div>
              </div>
              {editing === q.id ? (
                <>
                  <QuestionForm
                    q={q}
                    onChange={(next) =>
                      setQuestions(questions.map((x) => (x.id === q.id ? next : x)))
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
                <QuestionView q={q} dba={dba} />
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
                  <RegenerateItem<QuizQuestion>
                    resourceId={resource.id}
                    itemKey={q.id}
                    label={label}
                    disabledReason={
                      dirty || !savedKeys.has(q.id) ? "Guarda tus cambios antes de regenerar" : null
                    }
                    renderProposal={(item) => <QuestionView q={item} dba={dba} />}
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
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => {
          const id = newId();
          setQuestions([
            ...questions,
            {
              id,
              type: "MULTIPLE_CHOICE",
              stem: "",
              options: ["", "", "", ""],
              answer: "",
              explanation: "",
              cognitiveLevel: "UNDERSTAND",
              dbaCodes: [],
            },
          ]);
          setEditing(id);
        }}
      >
        <HiOutlinePlus aria-hidden />
        Agregar pregunta
      </Button>
    </div>
  );
}
