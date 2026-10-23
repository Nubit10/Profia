"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  HiOutlineArrowPath,
  HiOutlineHandThumbDown,
  HiOutlineHandThumbUp,
  HiOutlineStar,
  HiStar,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import {
  PREFERENCE_SCOPES,
  PREFERENCE_SCOPE_LABELS,
  type PreferenceScope,
  type RegenerateResult,
} from "@/modules/resources/client";

export type FeedbackActions = {
  rateItem: (input: {
    resourceId: string;
    itemKey: string;
    rating: "UP" | "DOWN";
    comment: string | null;
  }) => Promise<ActionResult>;
  rateResource: (input: {
    resourceId: string;
    rating: number;
    comment: string | null;
  }) => Promise<ActionResult>;
  addPreference: (input: {
    courseId: string;
    text: string;
    scope: PreferenceScope;
  }) => Promise<ActionResult<{ id: string }>>;
  regenerate: (input: {
    resourceId: string;
    itemKey: string;
    instruction: string;
  }) => Promise<ActionResult<RegenerateResult>>;
  decide: (input: {
    regenerationId: string;
    accept: boolean;
  }) => Promise<ActionResult<{ version: number }>>;
};

const SCOPE_OPTIONS = PREFERENCE_SCOPES.map((s) => ({
  value: s,
  label: PREFERENCE_SCOPE_LABELS[s],
}));

function useAction() {
  const [isPending, startTransition] = useTransition();
  const run = <T,>(action: () => Promise<ActionResult<T>>, onOk: (data: T) => void) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        sileo.error({ title: "No pudimos guardar", description: result.error });
        return;
      }
      onOk(result.data as T);
    });
  return { run, isPending };
}

/** Comentario con la opción de guardarlo como preferencia para próximas generaciones (RN-07). */
function CommentBox({
  label,
  placeholder,
  initial,
  pending,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  initial: string;
  pending: boolean;
  onSubmit: (comment: string, preference: PreferenceScope | null) => void;
}) {
  const [comment, setComment] = useState(initial);
  const [save, setSave] = useState(false);
  const [scope, setScope] = useState<PreferenceScope>("COURSE");
  const id = `pref-${label.replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={label}
        rows={2}
        maxLength={500}
        placeholder={placeholder}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            aria-labelledby={`${id}-label`}
            checked={save}
            onCheckedChange={(c) => setSave(!!c)}
          />
          <label id={`${id}-label`} htmlFor={id} className="text-sm">
            Tenerlo en cuenta en mis próximas generaciones
          </label>
        </div>
        {save && (
          <div className="w-44">
            <SelectField
              id={`${id}-scope`}
              value={scope}
              onChange={(v) => setScope(v as PreferenceScope)}
              options={SCOPE_OPTIONS}
            />
          </div>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !comment.trim()}
          onClick={() => onSubmit(comment.trim(), save ? scope : null)}
        >
          Enviar comentario
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">No escribas nombres de estudiantes.</p>
    </div>
  );
}

/** 👍/👎 por pregunta o actividad con "qué está bien / qué mejorar" (CA-0008-08). */
export function ItemFeedback({
  resourceId,
  courseId,
  itemKey,
  label,
  initial,
  actions,
}: {
  resourceId: string;
  courseId: string;
  itemKey: string;
  label: string;
  initial?: { rating: "UP" | "DOWN"; comment: string | null };
  actions: FeedbackActions;
}) {
  const { run, isPending } = useAction();
  const [rating, setRating] = useState(initial?.rating ?? null);
  const [open, setOpen] = useState(false);

  const rate = (value: "UP" | "DOWN", comment: string | null, scope: PreferenceScope | null) =>
    run(
      () => actions.rateItem({ resourceId, itemKey, rating: value, comment }),
      async () => {
        setRating(value);
        if (comment) {
          setOpen(false);
          sileo.success({ title: "Gracias, tu comentario ayuda a mejorar" });
        }
        if (comment && scope) {
          const saved = await actions.addPreference({
            courseId,
            text: comment.slice(0, 300),
            scope,
          });
          if (saved.ok) sileo.success({ title: "Guardado como preferencia" });
        }
      },
    );

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1" aria-label={`Calificar ${label}`}>
        <Button
          type="button"
          size="icon-sm"
          variant={rating === "UP" ? "secondary" : "ghost"}
          aria-label={`${label}: está bien`}
          aria-pressed={rating === "UP"}
          disabled={isPending}
          onClick={() => {
            rate("UP", initial?.comment ?? null, null);
            setOpen(true);
          }}
        >
          <HiOutlineHandThumbUp aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={rating === "DOWN" ? "secondary" : "ghost"}
          aria-label={`${label}: por mejorar`}
          aria-pressed={rating === "DOWN"}
          disabled={isPending}
          onClick={() => {
            rate("DOWN", initial?.comment ?? null, null);
            setOpen(true);
          }}
        >
          <HiOutlineHandThumbDown aria-hidden />
        </Button>
      </span>
      {open && rating && (
        <CommentBox
          label={rating === "UP" ? `Qué está bien en ${label}` : `Qué se debe mejorar en ${label}`}
          placeholder={rating === "UP" ? "¿Qué está bien? (opcional)" : "¿Qué se debe mejorar?"}
          initial={initial?.comment ?? ""}
          pending={isPending}
          onSubmit={(comment, scope) => rate(rating, comment, scope)}
        />
      )}
    </div>
  );
}

/** Regenerar con una indicación: llega como propuesta y el docente decide (CA-0008-07). */
export function RegenerateItem<T>({
  resourceId,
  itemKey,
  label,
  disabledReason,
  renderProposal,
  actions,
}: {
  resourceId: string;
  itemKey: string;
  label: string;
  disabledReason: string | null;
  renderProposal: (item: T) => React.ReactNode;
  actions: FeedbackActions;
}) {
  const router = useRouter();
  const { run, isPending } = useAction();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<{ id: string; item: T } | null>(null);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!!disabledReason}
        title={disabledReason ?? undefined}
        onClick={() => setOpen(true)}
      >
        <HiOutlineArrowPath aria-hidden />
        Regenerar
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-dashed p-3">
      {proposal ? (
        <>
          <p className="text-sm font-medium">Propuesta de la IA</p>
          {renderProposal(proposal.item)}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(
                  () => actions.decide({ regenerationId: proposal.id, accept: true }),
                  () => {
                    sileo.success({ title: `${label} reemplazada` });
                    setOpen(false);
                    setProposal(null);
                    router.refresh();
                  },
                )
              }
            >
              Usar esta versión
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                run(
                  () => actions.decide({ regenerationId: proposal.id, accept: false }),
                  () => setProposal(null),
                )
              }
            >
              Descartar
            </Button>
          </div>
        </>
      ) : (
        <>
          <Textarea
            aria-label={`Qué cambiar en ${label}`}
            rows={2}
            maxLength={300}
            placeholder="Ej.: hazla más difícil; usa un ejemplo de la vida diaria."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || instruction.trim().length < 3}
              onClick={() =>
                run(
                  () => actions.regenerate({ resourceId, itemKey, instruction }),
                  (result: RegenerateResult) => {
                    if (result.status === "ok") {
                      setProposal({
                        id: result.proposal.regenerationId,
                        item: result.proposal.item as T,
                      });
                    } else {
                      sileo.error({
                        title:
                          result.status === "invalid"
                            ? "No pudimos generar una propuesta válida"
                            : "La IA no está disponible en este momento",
                        description: "Intenta de nuevo en un momento.",
                      });
                    }
                  },
                )
              }
            >
              <HiOutlineArrowPath aria-hidden />
              {isPending ? "Generando…" : "Proponer"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Calificación general 1–5 (CA-0008-08). */
export function ResourceRating({
  resourceId,
  courseId,
  initial,
  initialComment,
  actions,
}: {
  resourceId: string;
  courseId: string;
  initial: number | null;
  initialComment: string | null;
  actions: FeedbackActions;
}) {
  const { run, isPending } = useAction();
  const [rating, setRating] = useState(initial);

  const save = (value: number, comment: string | null, scope: PreferenceScope | null) =>
    run(
      () => actions.rateResource({ resourceId, rating: value, comment }),
      async () => {
        setRating(value);
        if (comment) sileo.success({ title: "Gracias por tu evaluación" });
        if (comment && scope) {
          const saved = await actions.addPreference({
            courseId,
            text: comment.slice(0, 300),
            scope,
          });
          if (saved.ok) sileo.success({ title: "Guardado como preferencia" });
        }
      },
    );

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="rating-title">
      <h2 id="rating-title" className="font-medium">
        ¿Qué tan útil es este recurso?
      </h2>
      <div className="flex gap-1" role="radiogroup" aria-label="Calificación general">
        {[1, 2, 3, 4, 5].map((n) => (
          <Button
            key={n}
            type="button"
            size="icon-sm"
            variant="ghost"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} de 5`}
            disabled={isPending}
            onClick={() => save(n, initialComment, null)}
          >
            {rating !== null && n <= rating ? (
              <HiStar aria-hidden />
            ) : (
              <HiOutlineStar aria-hidden />
            )}
          </Button>
        ))}
      </div>
      {rating !== null && (
        <CommentBox
          label="Comentario general"
          placeholder="¿Qué está bien y qué se debe mejorar?"
          initial={initialComment ?? ""}
          pending={isPending}
          onSubmit={(comment, scope) => save(rating, comment, scope)}
        />
      )}
    </section>
  );
}
