"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HiOutlineClipboardDocumentCheck, HiOutlineDocumentText } from "react-icons/hi2";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import type { QuickResourceRequest } from "@/modules/resources/client";

const OPTIONS = [
  { type: "WORKSHOP", noun: "taller", text: "Crear taller", Icon: HiOutlineDocumentText },
  { type: "QUIZ", noun: "quiz", text: "Crear quiz", Icon: HiOutlineClipboardDocumentCheck },
] as const;

/** SPEC-0014 CA-0014-15: un tema sin recursos ofrece crearlos con un toque (RN-07). */
export function TopicQuickCreate({
  courseId,
  topic,
  action,
}: {
  courseId: string;
  topic: { id: string; title: string };
  action: (input: QuickResourceRequest) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    // Una línea simple dentro del periodo: sin caja propia (nunca tarjeta dentro de tarjeta).
    // Texto arriba y los dos botones juntos debajo en el celular; en una línea en escritorio.
    <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-1">
      <p className="pt-1 text-sm text-muted-foreground sm:mr-auto sm:py-2">Sin recursos todavía.</p>
      <div className="-ml-3 flex gap-1 sm:ml-0">
        {OPTIONS.map(({ type, noun, text, Icon }) => (
          <Button
            key={type}
            variant="ghost"
            size="sm"
            className="text-brand-strong hover:bg-brand-softer max-sm:min-h-11"
            disabled={pending}
            aria-busy={pending && busy === type}
            onClick={() => {
              setBusy(type);
              start(async () => {
                const result = await action({ type, topicId: topic.id });
                if (!result.ok) {
                  setBusy(null);
                  sileo.error({ title: `No pudimos crear el ${noun}`, description: result.error });
                  return;
                }
                sileo.success({
                  title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} en preparación`,
                  description: "Puedes salir de esta página: lo encontrarás en Mis recursos.",
                });
                router.push(`/courses/${courseId}/resources/${result.data!.id}`);
              });
            }}
          >
            <Icon aria-hidden />
            {pending && busy === type ? "Creando…" : text}
            <span className="sr-only"> de «{topic.title}»</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
