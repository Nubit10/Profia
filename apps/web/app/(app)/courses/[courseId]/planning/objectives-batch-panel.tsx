"use client";

import { DbaChip } from "@/components/curriculum/dba-chip";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { HiOutlineArrowPath, HiOutlineCheck } from "react-icons/hi2";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import type { ObjectivesBatchProposal, ObjectivesBatchTopic } from "@/modules/generation/client";
import {
  MAX_OBJECTIVES_PER_TOPIC,
  type AcceptObjectivesInput,
  type ProposeObjectivesInput,
} from "@/modules/planning/client";

// SPEC-0014 F-02: objetivos para todos los temas de una unidad o un periodo de una vez, con una
// sola revisión. Nada se guarda hasta "Aceptar" (RN-02).

export type ObjectivesBatchActions = {
  propose: (input: ProposeObjectivesInput) => Promise<ActionResult<ObjectivesBatchProposal>>;
  accept: (input: AcceptObjectivesInput) => Promise<ActionResult<{ objectives: number }>>;
};

const UNAVAILABLE = "No pudimos proponer objetivos ahora. Puedes redactarlos a mano.";

type Row = ObjectivesBatchTopic["suggestions"][number] & { on: boolean };
type Topic = Omit<ObjectivesBatchTopic, "suggestions"> & { rows: Row[] };
type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; courseId: string; topics: Topic[]; failed: number; skipped: number };

const validStatement = (s: string) => s.trim().length >= 5;

export function ObjectivesBatchPanel({
  target,
  actions,
  onDone,
}: {
  target: ProposeObjectivesInput;
  actions: ObjectivesBatchActions;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [isSaving, startSaving] = useTransition();
  const started = useRef(false);

  const load = async () => {
    setState({ status: "loading" });
    const result = await actions.propose(target);
    if (!result.ok) return setState({ status: "error", message: result.error });
    const data = result.data;
    if (!data || data.status !== "ok") return setState({ status: "error", message: UNAVAILABLE });
    setState({
      status: "ready",
      courseId: data.courseId,
      failed: data.failed,
      skipped: data.skipped,
      topics: data.topics.map(({ suggestions, ...t }) => ({
        ...t,
        rows: suggestions.map((s) => ({ ...s, on: true })),
      })),
    });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se pide una sola vez al abrir.
  }, []);

  if (state.status === "loading") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          className="size-8 animate-spin rounded-full border-4 border-brand-soft border-t-brand"
          aria-hidden
        />
        <p className="font-medium">Profe está redactando objetivos para cada tema…</p>
        <p className="text-sm text-muted-foreground">
          Usa los DBA de cada tema. Tarda unos segundos.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm">
          {state.message}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <HiOutlineArrowPath aria-hidden />
            Intentar de nuevo
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  const patch = (topicId: string, key: string, change: Partial<Row>) =>
    setState((s) =>
      s.status === "ready"
        ? {
            ...s,
            topics: s.topics.map((t) =>
              t.topicId === topicId
                ? { ...t, rows: t.rows.map((r) => (r.key === key ? { ...r, ...change } : r)) }
                : t,
            ),
          }
        : s,
    );

  const chosen = state.topics.flatMap((t) =>
    t.rows
      .filter((r) => r.on && validStatement(r.statement))
      .map((r) => ({
        topicId: t.topicId,
        statement: r.statement.trim(),
        dbaCodes: r.dba.map((d) => d.code),
      })),
  );
  const total = state.topics.reduce((n, t) => n + t.rows.length, 0);
  const over = state.topics.filter(
    (t) => t.existing + t.rows.filter((r) => r.on).length > MAX_OBJECTIVES_PER_TOPIC,
  );
  const allChosen = chosen.length === total;

  const save = () =>
    startSaving(async () => {
      const result = await actions.accept({ courseId: state.courseId, objectives: chosen });
      if (!result.ok) {
        sileo.error({ title: "No pudimos guardar los objetivos", description: result.error });
        return;
      }
      const n = result.data?.objectives ?? chosen.length;
      sileo.success({
        title: n === 1 ? "Se agregó 1 objetivo" : `Se agregaron ${n} objetivos`,
        description: "Ya están en sus temas, ligados a los DBA.",
      });
      onDone();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {(state.failed > 0 || state.skipped > 0) && (
        <p className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
          {state.skipped > 0 &&
            `${state.skipped === 1 ? "1 tema ya tenía" : `${state.skipped} temas ya tenían`} 3 objetivos o más y no se tocó. `}
          {state.failed > 0 &&
            `No pudimos proponer para ${state.failed === 1 ? "1 tema" : `${state.failed} temas`}; puedes usar "Sugerir objetivos con IA" en cada uno.`}
        </p>
      )}
      {state.topics.map((topic) => {
        const marked = topic.rows.filter((r) => r.on).length;
        const tooMany = topic.existing + marked > MAX_OBJECTIVES_PER_TOPIC;
        return (
          <section
            key={topic.topicId}
            aria-label={`Objetivos propuestos para ${topic.title}`}
            className="flex flex-col gap-2 rounded-xl border p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <h3 className="font-semibold">
                {topic.title}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {topic.unitTitle}
                </span>
              </h3>
              <span
                className={cn("text-xs", tooMany ? "text-destructive" : "text-muted-foreground")}
              >
                {topic.existing + marked} de {MAX_OBJECTIVES_PER_TOPIC} objetivos
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {topic.rows.map((row, index) => (
                <li key={row.key} className="flex items-start gap-2">
                  <Checkbox
                    aria-label={`Incluir el objetivo ${index + 1} de «${topic.title}»`}
                    checked={row.on}
                    disabled={isSaving}
                    onCheckedChange={(on) => patch(topic.topicId, row.key, { on })}
                    className="mt-3"
                  />
                  <div
                    className={cn("flex min-w-0 flex-1 flex-col gap-1", !row.on && "opacity-60")}
                  >
                    <Textarea
                      rows={2}
                      value={row.statement}
                      aria-label={`Objetivo ${index + 1} de «${topic.title}»`}
                      aria-invalid={row.on && !validStatement(row.statement)}
                      disabled={isSaving || !row.on}
                      onChange={(e) => patch(topic.topicId, row.key, { statement: e.target.value })}
                    />
                    {row.dba.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {row.dba.map((d) => (
                          <DbaChip key={d.code} code={d.code} number={d.number} />
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div className="sticky bottom-0 -mx-1 flex flex-col gap-2 border-t bg-background px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {over.length > 0
            ? `Desmarca alguno: cada tema tiene un máximo de ${MAX_OBJECTIVES_PER_TOPIC} objetivos.`
            : "Se agregan a cada tema; los objetivos que ya tienes no cambian."}
        </p>
        <Button disabled={isSaving || chosen.length === 0 || over.length > 0} onClick={save}>
          <HiOutlineCheck aria-hidden />
          {allChosen ? `Aceptar todos (${chosen.length})` : `Aceptar (${chosen.length})`}
        </Button>
      </div>
    </div>
  );
}
