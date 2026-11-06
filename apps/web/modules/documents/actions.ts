"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { requireTenant } from "@/modules/tenancy";
import { listOfflineLibrary, recordOfflineSync, type OfflineEntry } from "./offline";

/** SPEC-0013 RN-14: lista para sincronizar del espacio activo. */
export async function offlineLibraryAction(): Promise<
  ActionResult<{ institutionId: string; entries: OfflineEntry[] }>
> {
  return runAction("offline_library", z.undefined(), undefined, async () => {
    const ctx = await requireTenant();
    return { institutionId: ctx.institutionId, entries: await listOfflineLibrary(ctx) };
  });
}

export async function recordOfflineSyncAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "offline_sync",
    z.object({ files: z.number().int().min(1).max(10_000) }),
    input,
    async ({ files }) => recordOfflineSync(await requireTenant(), files),
  );
}
