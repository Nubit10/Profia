"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  HiOutlineCheck,
  HiOutlineHandThumbDown,
  HiOutlineHandThumbUp,
  HiOutlinePencilSquare,
  HiOutlineSparkles,
  HiOutlineXMark,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import type { ObjectiveSuggestionsResult, SuggestedObjective } from "@/modules/generation/client";

export type SuggestActions = {
  suggest: (input: {
    topicId: string;
    count: number;
  }) => Promise<ActionResult<ObjectiveSuggestionsResult>>;
  accept: (input: { suggestionId: string; statement?: string }) => Promise<ActionResult>;
  discard: (input: { suggestionId: string }) => Promise<ActionResult>;
  rate: (input: {
    suggestionId: string;
    rating: "UP" | "DOWN";
    comment?: string | null;
  }) => Promise<ActionResult>;
};

type Decision = "accepted" | "discarded" | null;

function SuggestionCard({
  suggestion,
  actions,
}: {
  suggestion: SuggestedObjective;
  actions: SuggestActions;
}) {
  const router = useRouter();
  const [text, setText] = useState(suggestion.statement);
  const [editing, setEditing] = useState(false);
  const [decision, setDecision] = useState<Decision>(null);
  const [rating, setRating] = useState<"UP" | "DOWN" | null>(null);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>, onOk: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        sileo.error({ title: "No pudimos guardar", description: result.error });
        return;
      }
      onOk();
    });

  const rate = (value: "UP" | "DOWN", note?: string) =>
    run(
      () => actions.rate({ suggestionId: suggestion.id, rating: value, comment: note ?? null }),
      () => setRating(value),
    );

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      {editing && decision === null ? (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          aria-label="Editar objetivo sugerido"
          autoFocus
        />
      ) : (
        <p
          className={
            decision === "discarded" ? "text-sm text-muted-foreground line-through" : "text-sm"
          }
        >
          {text}
        </p>
      )}
      {suggestion.dba.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestion.dba.map((d) => (
            <Badge key={d.code} variant="secondary" title={d.statement}>
              DBA {d.number}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {decision === null ? (
          <>
            <Button
              size="sm"
              disabled={isPending || text.trim().length < 5}
              onClick={() =>
                run(
                  () =>
                    actions.accept({
                      suggestionId: suggestion.id,
                      statement: text.trim() === suggestion.statement ? undefined : text.trim(),
                    }),
                  () => {
                    setDecision("accepted");
                    sileo.success({ title: "Objetivo agregado al tema" });
                    router.refresh();
                  },
                )
              }
            >
              <HiOutlineCheck aria-hidden />
              {editing ? "Guardar y aceptar" : "Aceptar"}
            </Button>
            {!editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <HiOutlinePencilSquare aria-hidden />
                Editar
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                run(
                  () => actions.discard({ suggestionId: suggestion.id }),
                  () => setDecision("discarded"),
                )
              }
            >
              <HiOutlineXMark aria-hidden />
              Descartar
            </Button>
          </>
        ) : (
          <Badge variant={decision === "accepted" ? "default" : "outline"}>
            {decision === "accepted" ? "Aceptada" : "Descartada"}
          </Badge>
        )}

        <span className="ml-auto flex items-center gap-1" aria-label="Calificar sugerencia">
          <Button
            size="icon-sm"
            variant={rating === "UP" ? "secondary" : "ghost"}
            aria-label="Buena sugerencia"
            aria-pressed={rating === "UP"}
            disabled={isPending}
            onClick={() => rate("UP")}
          >
            <HiOutlineHandThumbUp aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant={rating === "DOWN" ? "secondary" : "ghost"}
            aria-label="Sugerencia por mejorar"
            aria-pressed={rating === "DOWN"}
            disabled={isPending}
            onClick={() => rate("DOWN")}
          >
            <HiOutlineHandThumbDown aria-hidden />
          </Button>
        </span>
      </div>

      {rating === "DOWN" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={1}
            maxLength={500}
            placeholder="¿Qué se debe mejorar? (opcional)"
            aria-label="Qué se debe mejorar"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || !comment.trim()}
            onClick={() => rate("DOWN", comment)}
          >
            Enviar comentario
          </Button>
        </div>
      )}
    </li>
  );
}

type PanelState =
  | { kind: "loading" }
  | { kind: "ok"; suggestions: SuggestedObjective[]; model: string }
  | { kind: "error"; message: string };

function toState(result: ActionResult<ObjectiveSuggestionsResult>): PanelState {
  if (!result.ok) return { kind: "error", message: result.error };
  const data = result.data!;
  if (data.status === "unavailable") {
    return {
      kind: "error",
      message: "La sugerencia con IA no está disponible en este momento. Intenta más tarde.",
    };
  }
  if (data.status === "invalid") {
    return { kind: "error", message: "No pudimos generar sugerencias válidas. Intenta de nuevo." };
  }
  return { kind: "ok", suggestions: data.suggestions, model: data.model };
}

/** Pide sugerencias al abrirse y deja que el docente decida cada una (SPEC-0007 RN-01). */
export function SuggestPanel({ topicId, actions }: { topicId: string; actions: SuggestActions }) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Las acciones cambian de identidad en cada refresco de la página (p. ej. al aceptar una
  // sugerencia). Si fueran dependencia del efecto, se pedirían sugerencias nuevas y se perdería la
  // lista que el docente está revisando (y se gastaría cupo del proveedor).
  const suggestRef = useRef(actions.suggest);
  useEffect(() => {
    suggestRef.current = actions.suggest;
  }, [actions.suggest]);

  useEffect(() => {
    let cancelled = false;
    suggestRef.current({ topicId, count: 3 }).then((result) => {
      if (!cancelled) setState(toState(result));
    });
    return () => {
      cancelled = true;
    };
  }, [topicId, attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  if (state.kind === "loading") {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
        <HiOutlineSparkles className="animate-pulse" aria-hidden />
        Generando sugerencias a partir de los DBA del curso… puede tardar hasta un minuto.
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="flex flex-col gap-3 py-2" role="alert">
        <p className="text-sm">{state.message}</p>
        <Button variant="outline" className="w-fit" onClick={retry}>
          Reintentar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2" aria-label="Sugerencias de objetivos">
        {state.suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} actions={actions} />
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        Sugerencias generadas con IA. Revísalas antes de aceptarlas; tu calificación ayuda a
        mejorarlas.
      </p>
      <Button variant="ghost" size="sm" className="w-fit" onClick={retry}>
        <HiOutlineSparkles aria-hidden />
        Pedir otras sugerencias
      </Button>
    </div>
  );
}
