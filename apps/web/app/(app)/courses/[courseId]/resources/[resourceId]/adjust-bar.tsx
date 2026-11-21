"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import {
  HiOutlineArrowUturnLeft,
  HiOutlineCheck,
  HiOutlineExclamationTriangle,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { AiAvatar } from "@/components/brand/ai-avatar";
import { DocPreview } from "@/components/documents/doc-preview";
import { ScrollableRow } from "@/components/scrollable-row";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import type { DocModel } from "@/modules/documents/client";
import {
  adjustmentLabel,
  availableAdjustments,
  EXAM_QUOTA_COST,
  type ResourceAdjustment,
  type ResourceDetail,
} from "@/modules/resources/client";

export type AdjustActions = {
  requestAdjustment: (input: {
    resourceId: string;
    adjustment: ResourceAdjustment;
  }) => Promise<ActionResult<{ id: string }>>;
  decideAdjustment: (input: {
    adjustmentId: string;
    accept: boolean;
  }) => Promise<ActionResult<{ version: number }>>;
  adjustmentStatus: (input: { adjustmentId: string }) => Promise<ActionResult<{ status: string }>>;
};

const FAILURES = {
  unavailable: "La IA no está disponible en este momento.",
  invalid: "La IA no logró una versión que cumpla con todo lo del recurso.",
  interrupted: "El ajuste se interrumpió antes de terminar.",
} as const;

/** ADR-0008 §3: mientras se ajusta, la página consulta el estado cada pocos segundos. */
function usePolling(adjustmentId: string | null, check: AdjustActions["adjustmentStatus"]) {
  const router = useRouter();
  useEffect(() => {
    if (!adjustmentId) return;
    const timer = setInterval(async () => {
      const result = await check({ adjustmentId });
      if (result.ok && result.data!.status !== "GENERATING") router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [adjustmentId, check, router]);
}

/**
 * SPEC-0027: ajustes rápidos con botones. Profe rehace el recurso entero con una indicación fija y
 * el docente se queda con la versión nueva o vuelve a la anterior con un toque.
 */
export function AdjustBar({
  resource,
  preview,
  actions,
}: {
  resource: ResourceDetail;
  /** La propuesta dibujada como el documento que se imprime (solo con una propuesta). */
  preview: DocModel | null;
  actions: AdjustActions;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const adjustment = resource.adjustment;
  const generating = adjustment?.status === "GENERATING";
  usePolling(generating ? adjustment.id : null, actions.adjustmentStatus);
  if (!resource.data) return null;

  const cost = resource.type === "EXAM" ? EXAM_QUOTA_COST : 1;
  const codes = availableAdjustments(resource.data);
  const label = (code: ResourceAdjustment) => adjustmentLabel(code, resource.type);

  const ask = (code: ResourceAdjustment) =>
    startTransition(async () => {
      const result = await actions.requestAdjustment({
        resourceId: resource.id,
        adjustment: code,
      });
      if (!result.ok) {
        sileo.error({ title: "No pudimos ajustarlo", description: result.error });
        return;
      }
      router.refresh();
    });

  const decide = (accept: boolean) =>
    startTransition(async () => {
      const result = await actions.decideAdjustment({ adjustmentId: adjustment!.id, accept });
      if (!result.ok) {
        sileo.error({ title: "No pudimos guardar", description: result.error });
        return;
      }
      if (adjustment!.status === "PROPOSED") {
        sileo.success({
          title: accept ? "Listo, quedó la versión nueva" : "Volviste a la versión anterior",
          description: accept ? `Versión ${result.data!.version}` : undefined,
        });
      }
      router.refresh();
    });

  if (adjustment?.status === "PROPOSED") {
    return (
      <section
        aria-labelledby="adjust-proposal"
        className="flex flex-col gap-4 rounded-3xl border border-brand-border bg-brand-soft/40 p-4 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <AiAvatar size={36} />
          <div className="flex flex-col gap-1">
            <h2 id="adjust-proposal" className="text-lg font-extrabold">
              Así quedó «{label(adjustment.code)}»
            </h2>
            <p className="text-sm text-muted-foreground">
              Revísalo. Si te gusta, quédate con esta versión; si no, vuelve a la anterior. Tu
              versión guardada no cambia hasta que decidas.
            </p>
            {/* RN-05: el docente editó mientras se ajustaba. */}
            {adjustment.fromVersion !== resource.version && (
              <p className="text-sm font-medium text-warning" role="note">
                Se hizo sobre la versión {adjustment.fromVersion}; después editaste. Si te quedas
                con esta, esos cambios quedan en el historial de versiones.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="lg" disabled={isPending} onClick={() => decide(true)}>
            <HiOutlineCheck aria-hidden />
            Quedarme con esta
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={isPending}
            onClick={() => decide(false)}
          >
            <HiOutlineArrowUturnLeft aria-hidden />
            Volver a la anterior
          </Button>
        </div>
        {preview && <DocPreview model={preview} />}
      </section>
    );
  }

  return (
    <section aria-labelledby="adjust-title" className="flex flex-col gap-2">
      {adjustment?.status === "FAILED" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-3"
        >
          <HiOutlineExclamationTriangle className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="min-w-0 grow basis-64 text-sm">
            No pudimos hacerlo «{label(adjustment.code)}».{" "}
            {FAILURES[adjustment.failureReason ?? "unavailable"]} Tu recurso quedó igual y no se
            descontó de tu cupo.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => decide(false)}
          >
            Entendido
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="adjust-title" className="flex items-center gap-1.5 font-bold">
          <HiOutlineSparkles className="text-brand" aria-hidden />
          Ajustar con IA
        </h2>
        <p className="text-xs text-muted-foreground">
          {generating
            ? `Ajustando «${label(adjustment.code)}»… Puedes seguir leyendo o descargar.`
            : `Profe rehace todo el recurso. Cada ajuste usa ${cost} de tus recursos con IA.`}
        </p>
      </div>
      <ScrollableRow label="Ajustes rápidos" role="group" rowClassName="gap-2 pb-1">
        {codes.map((code) => (
          <Button
            key={code}
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 rounded-full"
            disabled={isPending || generating}
            aria-busy={generating && adjustment.code === code ? true : undefined}
            onClick={() => ask(code)}
          >
            {generating && adjustment.code === code ? "Ajustando…" : label(code)}
          </Button>
        ))}
      </ScrollableRow>
    </section>
  );
}
