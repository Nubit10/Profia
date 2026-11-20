"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { IconType } from "react-icons";
import {
  HiOutlineBookOpen,
  HiOutlineClipboardDocumentCheck,
  HiOutlinePencilSquare,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { AiAvatar } from "@/components/brand/ai-avatar";
import type { ActionResult } from "@/lib/action-result";
import type { QuickResourceRequest, ResourceType } from "@/modules/resources/client";

type QuickType = "WORKSHOP" | "QUIZ" | "LESSON_PLAN";

const OPTIONS: { type: QuickType; label: string; noun: string; icon: IconType }[] = [
  { type: "QUIZ", label: "Quiz", noun: "quiz", icon: HiOutlineClipboardDocumentCheck },
  { type: "WORKSHOP", label: "Taller", noun: "taller", icon: HiOutlinePencilSquare },
  { type: "LESSON_PLAN", label: "Plan de aula", noun: "plan de aula", icon: HiOutlineBookOpen },
];

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
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<QuickType | null>(null);
  const options = OPTIONS.filter((o) => o.type !== current);

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
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map(({ type, label, noun, icon: Icon }) => (
          <li
            key={type}
            className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2"
          >
            <button
              type="button"
              disabled={pending}
              aria-busy={busy === type}
              onClick={() => {
                setBusy(type);
                start(async () => {
                  const result = await quickCreate({ type, topicId: topic.id });
                  if (!result.ok) {
                    setBusy(null);
                    sileo.error({
                      title: `No pudimos crear el ${noun}`,
                      description: result.error,
                    });
                    return;
                  }
                  sileo.success({
                    title: `${label} en preparación`,
                    description: "Puedes salir de esta página: lo encontrarás en Mis recursos.",
                  });
                  router.push(`/courses/${courseId}/resources/${result.data!.id}`);
                });
              }}
              className="flex min-h-11 flex-1 items-center gap-3 rounded-xl px-2 text-left font-semibold transition hover:bg-brand-softer disabled:opacity-60"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                <Icon className="size-5" aria-hidden />
              </span>
              {busy === type ? "Creando…" : `Crear ${noun}`}
            </button>
            <Link
              href={`/create?type=${type}&courseId=${courseId}&topicId=${topic.id}`}
              className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Ajustar el ${noun} antes de crearlo`}
            >
              Ajustar
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
