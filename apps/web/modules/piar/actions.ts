"use server";

import { runAction, type ActionResult } from "@/lib/actions";
import type { PiarProposal } from "@/modules/generation";
import { requireTenant } from "@/modules/tenancy";
import { createPiarSchema, piarIdSchema, proposePiarSchema, savePiarSchema } from "./schemas";
import { createPiar, deletePiar, proposeAdjustments, savePiar } from "./service";

// SPEC-0017: acciones del PIAR. Cada una vuelve a comprobar el espacio y el dueño en el servidor.

export async function createPiarAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("create_piar", createPiarSchema, input, async (data) =>
    createPiar(await requireTenant(), data),
  );
}

export async function savePiarAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction("save_piar", savePiarSchema, input, async ({ piarId, content }) =>
    savePiar(await requireTenant(), piarId, content),
  );
}

export async function deletePiarAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction("delete_piar", piarIdSchema, input, async ({ piarId }) =>
    deletePiar(await requireTenant(), piarId),
  );
}

export async function proposePiarAdjustmentsAction(
  input: unknown,
): Promise<ActionResult<PiarProposal>> {
  return runAction("propose_piar", proposePiarSchema, input, async ({ piarId, periodNumber }) =>
    proposeAdjustments(await requireTenant(), piarId, periodNumber),
  );
}
