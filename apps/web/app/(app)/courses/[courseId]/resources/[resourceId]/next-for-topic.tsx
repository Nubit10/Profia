"use client";

import { AiAvatar } from "@/components/brand/ai-avatar";
import { QUICK_OPTIONS, QuickCreateList } from "@/components/quick-create";
import type { ActionResult } from "@/lib/action-result";
import type { QuickResourceRequest, ResourceType } from "@/modules/resources/client";

/**
 * Prueba de usabilidad (2026-11-20): después de un recurso, lo siguiente que pide el docente es "otro
 * del mismo tema" (como le diría a un chat: "ahora hazme un quiz de esto"). Un toque lo crea con los
 * valores recomendados del grado (SPEC-0014 RN-07, mismo cupo y avisos); "Ajustar antes" abre el
 * asistente con el curso y el tema ya elegidos.
 */
export function NextForTopic({
  courseId,
  topic,
  current,
  quickCreate,
}: {
  courseId: string;
  topic: { id: string; title: string };
  current: ResourceType;
  quickCreate: (input: QuickResourceRequest) => Promise<ActionResult<{ id: string }>>;
}) {
  return (
    <section
      aria-labelledby="next-for-topic"
      className="flex flex-col gap-3 rounded-3xl border border-brand-border bg-brand-softer p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <AiAvatar size={28} className="mt-0.5 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <h2 id="next-for-topic" className="font-bold">
            ¿Qué más necesitas para «{topic.title}»?
          </h2>
          <p className="text-sm text-muted-foreground">
            Un toque y la IA lo prepara con los valores recomendados para el grado.
          </p>
        </div>
      </div>
      <QuickCreateList
        courseId={courseId}
        topic={topic}
        types={QUICK_OPTIONS.map((o) => o.type).filter((t) => t !== current)}
        quickCreate={quickCreate}
      />
    </section>
  );
}
