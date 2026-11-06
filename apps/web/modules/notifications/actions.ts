"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/modules/auth";
import { installationIdSchema, pushDeviceSchema } from "./schemas";
import { hasPushDevice, registerPushDevice, removePushDevice } from "./service";

const byInstallation = z.object({ installationId: installationIdSchema });

export async function registerPushDeviceAction(input: unknown): Promise<ActionResult> {
  return runAction("register_push_device", pushDeviceSchema, input, async (data) =>
    registerPushDevice((await requireUser()).id, data),
  );
}

export async function removePushDeviceAction(input: unknown): Promise<ActionResult> {
  return runAction("remove_push_device", byInstallation, input, async ({ installationId }) =>
    removePushDevice((await requireUser()).id, installationId),
  );
}

export async function pushDeviceStatusAction(
  input: unknown,
): Promise<ActionResult<{ active: boolean }>> {
  return runAction("push_device_status", byInstallation, input, async ({ installationId }) => ({
    active: await hasPushDevice((await requireUser()).id, installationId),
  }));
}
