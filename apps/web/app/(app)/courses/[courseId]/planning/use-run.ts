"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { sileo } from "sileo";
import type { ActionResult } from "@/lib/action-result";

/** Ejecuta una server action, avisa con Sileo y refresca los datos del servidor. */
export function useRun() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = <T>(action: () => Promise<ActionResult<T>>, success?: string, onDone?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        sileo.error({ title: "No pudimos guardar", description: result.error });
        return;
      }
      if (success) sileo.success({ title: success });
      onDone?.();
      router.refresh();
    });

  return { run, isPending };
}
