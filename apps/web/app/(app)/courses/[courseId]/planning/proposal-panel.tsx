"use client";

import { DbaChip } from "@/components/curriculum/dba-chip";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { HiOutlineArrowPath, HiOutlineExclamationTriangle, HiOutlinePlus } from "react-icons/hi2";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import type { PlanningProposal, ProposedUnit } from "@/modules/generation/client";
import {
  PROPOSAL_TITLE_MAX,
  type AcceptProposalInput,
  type ProposalSize,
  type ProposePlanningInput,
} from "@/modules/planning/client";

// SPEC-0014 F-01: la IA propone unidades y temas a partir de los DBA; el docente revisa, edita y
// agrega. Nada se guarda hasta "Agregar a la planeación" (RN-02).

export type ProposalActions = {
  propose: (input: ProposePlanningInput) => Promise<ActionResult<PlanningProposal>>;
  accept: (
    input: AcceptProposalInput,
  ) => Promise<ActionResult<{ units: number; topics: number; skipped: number }>>;
};

/** Qué se pide: un periodo, el año o los temas de una unidad. */
export type ProposalScope =
  | { scope: "PERIOD"; courseId: string; periodNumber: number }
  | { scope: "YEAR"; courseId: string }
  | { scope: "UNIT"; unitId: string };

const SIZES: { value: ProposalSize; label: string }[] = [
  { value: "LESS", label: "Menos temas" },
  { value: "DEFAULT", label: "Normal" },
  { value: "MORE", label: "Más temas" },
];

export const PROPOSAL_UNAVAILABLE = "No pudimos proponer temas ahora. Puedes agregarlos a mano.";

type ReviewTopic = ProposedUnit["topics"][number] & { on: boolean };
type ReviewUnit = Omit<ProposedUnit, "topics"> & {
  on: boolean;
  periodNumber: number;
  topics: ReviewTopic[];
};
type Review = {
  courseId: string;
  periods: { number: number; name: string }[];
  units: ReviewUnit[];
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; review: Review };

const validTitle = (title: string) => title.trim().length >= 3;

function toReview(proposal: Extract<PlanningProposal, { status: "ok" }>): Review {
  return {
    courseId: proposal.courseId,
    periods: proposal.periods.map(({ number, name }) => ({ number, name })),
    units: proposal.periods.flatMap((p) =>
      p.units.map((u) => ({
        ...u,
        on: true,
        periodNumber: p.number,
        topics: u.topics.map((t) => ({ ...t, on: true })),
      })),
    ),
  };
}

/** Lo que quedó marcado y con título: exactamente lo que se guardará (CA-0014-03). */
export function selectedUnits(review: Review): AcceptProposalInput["units"] {
  return review.units
    .filter((u) => u.on && (u.unitId || validTitle(u.title)))
    .map((u) => {
      const topics = u.topics
        .filter((t) => t.on && validTitle(t.title))
        .map((t) => ({
          title: t.title.trim(),
          description: t.description.trim() || null,
          dbaCodes: t.dba.map((d) => d.code),
        }));
      return u.unitId
        ? { kind: "EXISTING" as const, unitId: u.unitId, topics }
        : { kind: "NEW" as const, periodNumber: u.periodNumber, title: u.title.trim(), topics };
    })
    .filter((u) => u.topics.length > 0);
}

function TopicRow({
  topic,
  disabled,
  onChange,
}: {
  topic: ReviewTopic;
  disabled: boolean;
  onChange: (patch: Partial<ReviewTopic>) => void;
}) {
  const id = `prop-topic-${topic.key}`;
  return (
    <li className="flex items-start gap-2 py-2">
      <Checkbox
        id={id}
        aria-label={`Incluir el tema «${topic.title}»`}
        checked={topic.on}
        disabled={disabled}
        onCheckedChange={(on) => onChange({ on })}
        className="mt-3"
      />
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", !topic.on && "opacity-60")}>
        <Input
          value={topic.title}
          maxLength={PROPOSAL_TITLE_MAX}
          aria-label="Título del tema"
          aria-invalid={topic.on && !validTitle(topic.title)}
          disabled={disabled || !topic.on}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        {topic.description && <p className="text-xs text-muted-foreground">{topic.description}</p>}
        {topic.dba.length === 0 ? (
          <p className="flex items-center gap-1 text-xs text-warning">
            <HiOutlineExclamationTriangle aria-hidden />
            Sin DBA
          </p>
        ) : (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={`DBA de ${topic.title || "este tema"}`}
          >
            {topic.dba.map((d) => (
              <li key={d.code}>
                <DbaChip code={d.code} number={d.number} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * Pide la propuesta al abrir y muestra la revisión. `onDone` cierra el diálogo después de agregar.
 */
export function ProposalPanel({
  target,
  actions,
  onDone,
}: {
  target: ProposalScope;
  actions: ProposalActions;
  onDone: () => void;
}) {
  const router = useRouter();
  const [size, setSize] = useState<ProposalSize>("DEFAULT");
  const [state, setState] = useState<State>({ status: "loading" });
  const [replacing, setReplacing] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const started = useRef(false);

  const request = async (wanted: ProposalSize) => {
    const result = await actions.propose({ ...target, size: wanted });
    if (!result.ok) return { error: result.error };
    if (!result.data || result.data.status !== "ok") return { error: PROPOSAL_UNAVAILABLE };
    return { proposal: result.data };
  };

  const load = async (wanted: ProposalSize) => {
    setState({ status: "loading" });
    const { proposal, error } = await request(wanted);
    setState(
      proposal
        ? { status: "ready", review: toReview(proposal) }
        : { status: "error", message: error! },
    );
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load("DEFAULT");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se pide una sola vez al abrir.
  }, []);

  const update = (fn: (review: Review) => Review) =>
    setState((s) => (s.status === "ready" ? { ...s, review: fn(s.review) } : s));
  const patchUnit = (key: string, patch: Partial<ReviewUnit>) =>
    update((r) => ({ ...r, units: r.units.map((u) => (u.key === key ? { ...u, ...patch } : u)) }));
  const patchTopic = (unitKey: string, topicKey: string, patch: Partial<ReviewTopic>) =>
    update((r) => ({
      ...r,
      units: r.units.map((u) =>
        u.key === unitKey
          ? { ...u, topics: u.topics.map((t) => (t.key === topicKey ? { ...t, ...patch } : t)) }
          : u,
      ),
    }));

  /** "Otra propuesta" para una unidad: pide de nuevo su periodo y toma una unidad distinta. */
  const replaceUnit = async (unit: ReviewUnit, courseId: string) => {
    setReplacing(unit.key);
    const again: ProposalScope =
      target.scope === "UNIT"
        ? target
        : { scope: "PERIOD", courseId, periodNumber: unit.periodNumber };
    const current = state.status === "ready" ? state.review.units : [];
    const avoid = current.flatMap((u) => [u.title, ...u.topics.map((t) => t.title)]);
    const result = await actions.propose({ ...again, size, avoid });
    setReplacing(null);
    if (!result.ok || result.data?.status !== "ok") {
      sileo.error({
        title: "No pudimos traer otra propuesta",
        description: result.ok ? PROPOSAL_UNAVAILABLE : result.error,
      });
      return;
    }
    update((r) => {
      const others = new Set(
        r.units.filter((u) => u.key !== unit.key).map((u) => u.title.trim().toLowerCase()),
      );
      const fresh = result.data!.status === "ok" ? toReview(result.data!).units : [];
      const pick =
        fresh.find((u) => u.unitId || !others.has(u.title.trim().toLowerCase())) ?? fresh[0];
      if (!pick) return r;
      const stamp = `${unit.key}-${Date.now()}`;
      const replacement: ReviewUnit = {
        ...pick,
        key: stamp,
        periodNumber: unit.periodNumber,
        topics: pick.topics.map((t, i) => ({ ...t, key: `${stamp}-${i}` })),
      };
      return { ...r, units: r.units.map((u) => (u.key === unit.key ? replacement : u)) };
    });
  };

  if (state.status === "loading") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          className="size-8 animate-spin rounded-full border-4 border-brand-soft border-t-brand"
          aria-hidden
        />
        <p className="font-medium">Profe está proponiendo temas a partir de los DBA…</p>
        <p className="text-sm text-muted-foreground">
          {target.scope === "YEAR"
            ? "Para el año completo arma un periodo a la vez; puede tardar unos segundos."
            : "Tarda unos segundos."}
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
          <Button variant="outline" onClick={() => void load(size)}>
            <HiOutlineArrowPath aria-hidden />
            Intentar de nuevo
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Agregar a mano
          </Button>
        </div>
      </div>
    );
  }

  const { review } = state;
  const chosen = selectedUnits(review);
  const count = chosen.reduce((n, u) => n + u.topics.length, 0);
  const busy = isSaving || replacing !== null;
  const multiplePeriods = review.periods.length > 1;

  const save = () =>
    startSaving(async () => {
      const result = await actions.accept({ courseId: review.courseId, units: chosen });
      if (!result.ok) {
        sileo.error({ title: "No pudimos agregar los temas", description: result.error });
        return;
      }
      const added = result.data?.topics ?? count;
      sileo.success({
        title: added === 1 ? "Se agregó 1 tema" : `Se agregaron ${added} temas`,
        description: "Ya están en tu planeación.",
      });
      onDone();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Cantidad de temas" className="flex flex-wrap gap-2">
        {SIZES.map((s) => (
          <Button
            key={s.value}
            size="sm"
            variant={size === s.value ? "secondary" : "ghost"}
            aria-pressed={size === s.value}
            disabled={busy}
            onClick={() => {
              if (s.value === size) return;
              setSize(s.value);
              void load(s.value);
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {review.periods.map((period) => {
        const units = review.units.filter((u) => u.periodNumber === period.number);
        return (
          <section key={period.number} aria-label={period.name} className="flex flex-col gap-3">
            {multiplePeriods && <h3 className="text-base font-semibold">{period.name}</h3>}
            <ul className="flex flex-col gap-3">
              {units.map((unit) => (
                <li
                  key={unit.key}
                  className={cn("rounded-xl border p-3", !unit.on && "bg-muted/40")}
                  aria-busy={replacing === unit.key}
                >
                  <div className="flex items-start gap-2">
                    {!unit.unitId && (
                      <Checkbox
                        aria-label={`Incluir la unidad «${unit.title}»`}
                        checked={unit.on}
                        disabled={busy}
                        onCheckedChange={(on) => patchUnit(unit.key, { on })}
                        className="mt-3"
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {unit.unitId ? (
                        <p className="py-2 font-semibold">{unit.title}</p>
                      ) : (
                        <Input
                          value={unit.title}
                          maxLength={PROPOSAL_TITLE_MAX}
                          aria-label="Título de la unidad"
                          aria-invalid={unit.on && !validTitle(unit.title)}
                          disabled={busy || !unit.on}
                          className="font-semibold"
                          onChange={(e) => patchUnit(unit.key, { title: e.target.value })}
                        />
                      )}
                    </div>
                  </div>
                  {unit.on && (
                    <ul className="ml-6 divide-y" aria-label={`Temas propuestos de ${unit.title}`}>
                      {unit.topics.map((topic) => (
                        <TopicRow
                          key={topic.key}
                          topic={topic}
                          disabled={busy}
                          onChange={(patch) => patchTopic(unit.key, topic.key, patch)}
                        />
                      ))}
                    </ul>
                  )}
                  {unit.on && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 ml-6"
                      disabled={busy}
                      onClick={() => void replaceUnit(unit, review.courseId)}
                    >
                      <HiOutlineArrowPath
                        className={replacing === unit.key ? "animate-spin" : undefined}
                        aria-hidden
                      />
                      Otra propuesta
                      <span className="sr-only"> para «{unit.title}»</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-1 flex flex-col gap-2 border-t bg-background px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Se agrega al final de tu planeación; lo que ya tienes no cambia.
        </p>
        <Button disabled={busy || count === 0} onClick={save}>
          <HiOutlinePlus aria-hidden />
          Agregar a la planeación ({count})
        </Button>
      </div>
    </div>
  );
}
