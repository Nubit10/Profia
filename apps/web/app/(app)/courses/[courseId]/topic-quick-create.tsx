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
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3">
      <p className="basis-full text-sm text-muted-foreground sm:flex-1 sm:basis-auto">
        Este tema aún no tiene recursos.
      </p>
      {OPTIONS.map(({ type, noun, text, Icon }) => (
        <Button
          key={type}
          variant="outline"
          size="sm"
          className="border-brand-border text-brand-strong hover:bg-brand-soft max-sm:min-h-11"
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
  );
}
