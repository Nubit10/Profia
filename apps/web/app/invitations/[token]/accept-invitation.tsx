"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

type Props = {
  token: string;
  action: (input: { token: string }) => Promise<ActionResult>;
};

export function AcceptInvitation({ token, action }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const accept = () =>
    startTransition(async () => {
      const result = await action({ token });
      if (!result.ok) {
        sileo.error({ title: "No pudimos aceptar la invitación", description: result.error });
        router.refresh();
        return;
      }
      sileo.success({ title: "¡Bienvenido al colegio!" });
      router.replace("/dashboard");
      router.refresh();
    });

  return (
    <Button size="lg" onClick={accept} disabled={isPending}>
      {isPending ? "Aceptando…" : "Aceptar invitación"}
    </Button>
  );
}
