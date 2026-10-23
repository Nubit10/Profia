"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { notFound } from "@/lib/errors";
import { requireTenant } from "./context";
import { setActiveSpaceCookie } from "./cookie";

/** Cambia el espacio activo. Solo se acepta un espacio donde el usuario tiene membresía activa. */
export async function switchSpaceAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "switch_space",
    z.object({ institutionId: z.string().min(1) }),
    input,
    async (data) => {
      const ctx = await requireTenant();
      if (!ctx.spaces.some((s) => s.institutionId === data.institutionId)) throw notFound();
      await setActiveSpaceCookie(data.institutionId);
    },
  );
}
