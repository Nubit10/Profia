"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HiOutlineArrowDownTray, HiOutlineCheck, HiOutlineTrash } from "react-icons/hi2";
import { sileo } from "sileo";
import { AiAvatar } from "@/components/brand/ai-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { SelectableOption } from "@/components/forms/selectable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { navigatingFromLayer } from "@/lib/use-back-to-close";
import { cn } from "@/lib/utils";
import type { PiarAdjustments, PiarProposal } from "@/modules/generation/client";
import {
  MIN_BARRIERS_FOR_AI,
  piarContentSchema,
  type PiarContent,
  type PiarDetail,
  type PiarPeriod,
} from "@/modules/piar/client";

type Actions = {
  save: (input: unknown) => Promise<ActionResult<{ ok: true }>>;
  remove: (input: unknown) => Promise<ActionResult<{ ok: true }>>;
  propose: (input: unknown) => Promise<ActionResult<PiarProposal>>;
};

const card = "flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6";

/** Agrega las líneas propuestas al texto que el docente ya tenía, sin repetirlas. */
const merge = (current: string, lines: string[]) => {
  const have = new Set(current.split("\n").map((l) => l.trim()));
  const added = lines.filter((l) => !have.has(`- ${l}`) && !have.has(l)).map((l) => `- ${l}`);
  return [current.trim(), ...added].filter(Boolean).join("\n");
};

/** Quita la propuesta de un periodo. */
const without = (all: Record<number, PiarAdjustments>, number: number) =>
  Object.fromEntries(Object.entries(all).filter(([k]) => Number(k) !== number));

function Area({
  id,
  label,
  value,
  onChange,
  hint,
  rows = 3,
  max = 1500,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  rows?: number;
  max?: number;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        rows={rows}
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

/** SPEC-0017: editor del PIAR. Nada se guarda hasta "Guardar"; todo viaja cifrado al servidor. */
export function PiarEditor({ piar, actions }: { piar: PiarDetail; actions: Actions }) {
  const router = useRouter();
  const [content, setContent] = useState<PiarContent>(piar.content);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [proposals, setProposals] = useState<Record<number, PiarAdjustments>>({});
  const [proposing, setProposing] = useState<number | null>(null);

  const update = (patch: Partial<PiarContent>) => {
    setContent((c) => ({ ...c, ...patch }));
    setDirty(true);
  };
  const setStudent = (patch: Partial<PiarContent["student"]>) =>
    update({ student: { ...content.student, ...patch } });
  const setPeriod = (number: number, patch: Partial<PiarPeriod>) =>
    update({
      periods: content.periods.map((p) => (p.number === number ? { ...p, ...patch } : p)),
    });

  const save = () => {
    const parsed = piarContentSchema.safeParse(content);
    if (!parsed.success) {
      sileo.error({ title: "Revisa el PIAR", description: parsed.error.issues[0]?.message });
      return;
    }
    startSave(async () => {
      const result = await actions.save({ piarId: piar.id, content: parsed.data });
      if (!result.ok) {
        sileo.error({ title: "No pudimos guardar", description: result.error });
        return;
      }
      setDirty(false);
      sileo.success({ title: "PIAR guardado" });
      router.refresh();
    });
  };

  const propose = async (number: number) => {
    if (dirty) {
      // La propuesta usa las barreras guardadas: se guarda antes para no usar unas viejas.
      const parsed = piarContentSchema.safeParse(content);
      if (!parsed.success) return;
      const saved = await actions.save({ piarId: piar.id, content: parsed.data });
      if (!saved.ok) {
        sileo.error({ title: "No pudimos guardar", description: saved.error });
        return;
      }
      setDirty(false);
    }
    setProposing(number);
    const result = await actions.propose({ piarId: piar.id, periodNumber: number });
    setProposing(null);
    if (!result.ok) {
      sileo.error({ title: "No pudimos proponer ajustes", description: result.error });
      return;
    }
    if (result.data!.status !== "ok") {
      sileo.error({
        title: "No pudimos proponer ajustes",
        description: "La IA no está disponible en este momento. Puedes escribirlos tú.",
      });
      return;
    }
    setProposals((p) => ({
      ...p,
      [number]: (result.data as { adjustments: PiarAdjustments }).adjustments,
    }));
  };

  const accept = (period: PiarPeriod) => {
    const a = proposals[period.number];
    if (!a) return;
    setPeriod(period.number, {
      curricular: merge(period.curricular, a.curricular),
      didactic: merge(period.didactic, a.didactic),
      evaluative: merge(period.evaluative, a.evaluative),
      followUp: period.followUp.trim() ? period.followUp : a.followUp,
    });
    setProposals((all) => without(all, period.number));
  };

  const canPropose = content.barriers.trim().length >= MIN_BARRIERS_FOR_AI;
  const subject = piar.course.subjectName;

  return (
    <div className="flex flex-col gap-6 pb-28 md:pb-0">
      <section aria-labelledby="piar-student" className={card}>
        <h2 id="piar-student" className="text-lg font-bold">
          1. Estudiante
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
          <Field>
            <FieldLabel htmlFor="piar-name">Nombre</FieldLabel>
            <Input
              id="piar-name"
              value={content.student.name}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => setStudent({ name: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="piar-age">Edad (opcional)</FieldLabel>
            <Input
              id="piar-age"
              type="number"
              min={3}
              max={25}
              inputMode="numeric"
              value={content.student.age ?? ""}
              onChange={(e) =>
                setStudent({ age: e.target.value ? Number(e.target.value) || null : null })
              }
            />
          </Field>
        </div>
        <SelectableOption
          id="piar-support"
          checked={content.student.externalSupport}
          onCheckedChange={(c) => setStudent({ externalSupport: c })}
        >
          Tiene una valoración o un soporte externo
        </SelectableOption>
        {content.student.externalSupport && (
          <Field>
            <FieldLabel htmlFor="piar-issuer">¿Quién lo emitió?</FieldLabel>
            <Input
              id="piar-issuer"
              value={content.student.supportIssuer}
              maxLength={120}
              placeholder="Ej.: EPS, psicología del colegio"
              onChange={(e) => setStudent({ supportIssuer: e.target.value })}
            />
            <FieldDescription>
              Profe no guarda diagnósticos: solo quién emitió el soporte.
            </FieldDescription>
          </Field>
        )}
      </section>

      <section aria-labelledby="piar-learning" className={card}>
        <h2 id="piar-learning" className="text-lg font-bold">
          2. Cómo aprende
        </h2>
        <Area
          id="piar-strengths"
          label="Fortalezas e intereses"
          value={content.learning.strengths}
          onChange={(v) => update({ learning: { ...content.learning, strengths: v } })}
        />
        <Area
          id="piar-how"
          label="Cómo aprende mejor"
          value={content.learning.howLearnsBest}
          onChange={(v) => update({ learning: { ...content.learning, howLearnsBest: v } })}
        />
      </section>

      <section aria-labelledby="piar-barriers-title" className={card}>
        <h2 id="piar-barriers-title" className="text-lg font-bold">
          3. Barreras para aprender en {subject}
        </h2>
        <Area
          id="piar-barriers"
          label="Barreras"
          rows={4}
          value={content.barriers}
          onChange={(v) => update({ barriers: v })}
          hint="Qué le dificulta aprender en el aula (por ejemplo: leer textos largos, el ruido, seguir varias instrucciones). Sin diagnósticos. Para proponer ajustes con IA se envían las barreras sin el nombre ni datos de contacto."
        />
      </section>

      <section aria-labelledby="piar-periods" className={card}>
        <h2 id="piar-periods" className="text-lg font-bold">
          4. Ajustes razonables por periodo
        </h2>
        {content.periods.map((period, index) => {
          const topics = piar.topicsByPeriod[period.number] ?? [];
          const proposal = proposals[period.number];
          const base = `piar-p${period.number}`;
          return (
            <details
              key={period.number}
              open={index === 0}
              className="group/period rounded-2xl border border-border p-4"
            >
              <summary className="cursor-pointer font-semibold max-sm:min-h-11">
                {period.name}
              </summary>
              <div className="mt-4 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  {topics.length
                    ? `Temas del periodo: ${topics.join(", ")}.`
                    : "Este periodo todavía no tiene temas en la planeación."}
                </p>
                <Area
                  id={`${base}-purpose`}
                  label="Propósito"
                  max={800}
                  value={period.purpose}
                  onChange={(v) => setPeriod(period.number, { purpose: v })}
                />
                <div className="flex flex-col gap-2 rounded-2xl border border-brand-border bg-brand-softer p-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit border-brand-border text-brand-strong hover:bg-brand-soft max-sm:w-full"
                    disabled={!canPropose || proposing !== null}
                    aria-busy={proposing === period.number}
                    onClick={() => propose(period.number)}
                  >
                    <AiAvatar size={18} />
                    {proposing === period.number ? "Proponiendo…" : "Proponer ajustes con IA"}
                    <span className="sr-only"> para {period.name}</span>
                  </Button>
                  {!canPropose && (
                    <p className="text-xs text-muted-foreground">
                      Primero describe las barreras (sección 3).
                    </p>
                  )}
                  {proposal && (
                    <div
                      className="flex flex-col gap-2 text-sm"
                      role="region"
                      aria-label={`Ajustes propuestos para ${period.name}`}
                    >
                      {(
                        [
                          ["Curriculares", proposal.curricular],
                          ["Didácticos", proposal.didactic],
                          ["De evaluación", proposal.evaluative],
                        ] as const
                      ).map(([title, items]) => (
                        <div key={title}>
                          <p className="font-medium">{title}</p>
                          <ul className="ml-4 list-disc">
                            {items.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <p>
                        <span className="font-medium">Seguimiento:</span> {proposal.followUp}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => accept(period)}>
                          <HiOutlineCheck aria-hidden />
                          Agregar al periodo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setProposals((all) => without(all, period.number))}
                        >
                          Descartar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <Area
                  id={`${base}-curricular`}
                  label="Ajustes curriculares"
                  value={period.curricular}
                  onChange={(v) => setPeriod(period.number, { curricular: v })}
                />
                <Area
                  id={`${base}-didactic`}
                  label="Ajustes didácticos"
                  value={period.didactic}
                  onChange={(v) => setPeriod(period.number, { didactic: v })}
                />
                <Area
                  id={`${base}-evaluative`}
                  label="Ajustes de evaluación"
                  value={period.evaluative}
                  onChange={(v) => setPeriod(period.number, { evaluative: v })}
                />
                <Area
                  id={`${base}-followup`}
                  label="Seguimiento"
                  max={800}
                  rows={2}
                  value={period.followUp}
                  onChange={(v) => setPeriod(period.number, { followUp: v })}
                />
              </div>
            </details>
          );
        })}
      </section>

      <section aria-labelledby="piar-family-title" className={card}>
        <h2 id="piar-family-title" className="text-lg font-bold">
          5. Recomendaciones para la familia
        </h2>
        <Area
          id="piar-family"
          label="Recomendaciones"
          value={content.family}
          onChange={(v) => update({ family: v })}
        />
      </section>

      {/* En el celular las acciones van en una barra fija abajo (patrón del recurso). */}
      <div
        data-floating="bottom-bar"
        className="flex flex-wrap items-center gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex-nowrap max-md:border-t max-md:border-border max-md:bg-card/95 max-md:px-3 max-md:pt-2 max-md:pb-[calc(0.5rem+env(safe-area-inset-bottom))] max-md:shadow-lift max-md:backdrop-blur"
      >
        <Button
          variant="brand"
          size="lg"
          className="max-md:min-w-0 max-md:flex-1"
          disabled={saving || !dirty}
          onClick={save}
        >
          <HiOutlineCheck aria-hidden />
          {saving ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
        </Button>
        <a
          href={`/piar/${piar.id}/export?format=pdf`}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "shrink-0 max-md:px-3")}
          aria-disabled={dirty}
          onClick={(e) => {
            if (dirty) {
              e.preventDefault();
              sileo.info({ title: "Guarda antes de descargar" });
            }
          }}
        >
          <HiOutlineArrowDownTray aria-hidden />
          PDF
        </a>
        <a
          href={`/piar/${piar.id}/export?format=docx`}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "shrink-0 max-md:px-3")}
          aria-disabled={dirty}
          onClick={(e) => {
            if (dirty) {
              e.preventDefault();
              sileo.info({ title: "Guarda antes de descargar" });
            }
          }}
        >
          <HiOutlineArrowDownTray aria-hidden />
          Word
        </a>
        <Button
          variant="ghost"
          size="icon-lg"
          className="shrink-0 text-danger"
          aria-label="Borrar este PIAR"
          onClick={() => setConfirmDelete(true)}
        >
          <HiOutlineTrash className="size-5" aria-hidden />
        </Button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Borrar este PIAR?</DialogTitle>
            <DialogDescription>
              Se borra de Profe para siempre. Si lo necesitas, descárgalo antes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-danger text-white hover:bg-danger/90"
              disabled={deleting}
              onClick={() =>
                startDelete(async () => {
                  const result = await actions.remove({ piarId: piar.id });
                  if (!result.ok) {
                    sileo.error({ title: "No pudimos borrar", description: result.error });
                    return;
                  }
                  navigatingFromLayer();
                  setConfirmDelete(false);
                  sileo.success({ title: "PIAR borrado" });
                  router.push("/piar");
                  router.refresh();
                })
              }
            >
              Borrar PIAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
