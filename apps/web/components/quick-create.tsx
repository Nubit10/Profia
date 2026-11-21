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
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import type { QuickResourceRequest } from "@/modules/resources/client";

export type QuickType = "WORKSHOP" | "QUIZ" | "LESSON_PLAN";

export const QUICK_OPTIONS: { type: QuickType; label: string; noun: string; icon: IconType }[] = [
  { type: "QUIZ", label: "Quiz", noun: "quiz", icon: HiOutlineClipboardDocumentCheck },
  { type: "WORKSHOP", label: "Taller", noun: "taller", icon: HiOutlinePencilSquare },
  { type: "LESSON_PLAN", label: "Plan de aula", noun: "plan de aula", icon: HiOutlineBookOpen },
];

/**
 * Crear con un toque un recurso de un tema (SPEC-0014 RN-07): valores recomendados del grado, mismo
 * cupo y avisos. "Ajustar" abre el asistente con el curso y el tema ya elegidos.
 */
export function QuickCreateList({
  courseId,
  topic,
  types,
  quickCreate,
  className,
}: {
  courseId: string;
  topic: { id: string; title: string };
  types: QuickType[];
  quickCreate: (input: QuickResourceRequest) => Promise<ActionResult<{ id: string }>>;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<QuickType | null>(null);
  const options = QUICK_OPTIONS.filter((o) => types.includes(o.type));

  return (
    <ul className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", className)}>
      {options.map(({ type, label, noun, icon: Icon }) => (
        <li
          key={type}
          className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2"
        >
          <button
            type="button"
            disabled={pending}
            aria-busy={busy === type}
            aria-label={`Crear ${noun} de «${topic.title}»`}
            onClick={() => {
              setBusy(type);
              start(async () => {
                const result = await quickCreate({ type, topicId: topic.id });
                if (!result.ok) {
                  setBusy(null);
                  sileo.error({ title: `No pudimos crear el ${noun}`, description: result.error });
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
  );
}
