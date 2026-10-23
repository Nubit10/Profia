"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { requireTenant } from "@/modules/tenancy";
import { saveFormatSchema } from "./schemas";
import { deleteFormat, deleteLogo, saveFormat, setDefaultFormat } from "./service";

const id = z.string().min(1);

export async function saveFormatAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("save_format", saveFormatSchema, input, async (data) =>
    saveFormat(await requireTenant(), data),
  );
}

export async function setDefaultFormatAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "set_default_format",
    z.object({ formatId: id, isDefault: z.boolean() }),
    input,
    async ({ formatId, isDefault }) => setDefaultFormat(await requireTenant(), formatId, isDefault),
  );
}

export async function deleteFormatAction(input: unknown): Promise<ActionResult> {
  return runAction("delete_format", z.object({ formatId: id }), input, async ({ formatId }) =>
    deleteFormat(await requireTenant(), formatId),
  );
}

export async function deleteLogoAction(input: unknown): Promise<ActionResult> {
  return runAction("delete_logo", z.object({}), input, async () =>
    deleteLogo(await requireTenant()),
  );
}
