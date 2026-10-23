"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { requireTenant } from "@/modules/tenancy";
import {
  blueprintSchema,
  gradingScaleSchema,
  itemFeedbackSchema,
  preferenceSchema,
  regenerateSchema,
  resourceRatingSchema,
} from "./schemas";
import {
  addPreference,
  createResource,
  decideRegeneration,
  deletePreference,
  duplicateResource,
  getResourceStatus,
  rateItem,
  rateResource,
  regenerateItem,
  retryResource,
  saveResourceContent,
  setGradingScale,
  setResourceStatus,
  updatePreference,
} from "./service";
import type { RegenerateResult, ResourceStatus } from "./types";

const id = z.string().min(1);

export async function createResourceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("create_resource", blueprintSchema, input, async (blueprint) =>
    createResource(await requireTenant(), blueprint),
  );
}

export async function retryResourceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("retry_resource", z.object({ resourceId: id }), input, async ({ resourceId }) =>
    retryResource(await requireTenant(), resourceId),
  );
}

export async function resourceStatusAction(
  input: unknown,
): Promise<ActionResult<{ status: ResourceStatus }>> {
  return runAction("resource_status", z.object({ resourceId: id }), input, async ({ resourceId }) =>
    getResourceStatus(await requireTenant(), resourceId),
  );
}

export async function saveResourceContentAction(
  input: unknown,
): Promise<ActionResult<{ version: number }>> {
  return runAction(
    "save_resource_content",
    z.object({ resourceId: id, version: z.number().int().min(0), content: z.unknown() }),
    input,
    async ({ resourceId, version, content }) =>
      saveResourceContent(await requireTenant(), resourceId, version, content),
  );
}

export async function setResourceStatusAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "set_resource_status",
    z.object({ resourceId: id, status: z.enum(["READY", "DRAFT", "ARCHIVED", "RESTORE"]) }),
    input,
    async ({ resourceId, status }) => setResourceStatus(await requireTenant(), resourceId, status),
  );
}

export async function duplicateResourceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(
    "duplicate_resource",
    z.object({ resourceId: id }),
    input,
    async ({ resourceId }) => duplicateResource(await requireTenant(), resourceId),
  );
}

export async function regenerateItemAction(
  input: unknown,
): Promise<ActionResult<RegenerateResult>> {
  return runAction(
    "regenerate_item",
    regenerateSchema.extend({ resourceId: id }),
    input,
    async ({ resourceId, itemKey, instruction }) =>
      regenerateItem(await requireTenant(), resourceId, itemKey, instruction),
  );
}

export async function decideRegenerationAction(
  input: unknown,
): Promise<ActionResult<{ version: number }>> {
  return runAction(
    "decide_regeneration",
    z.object({ regenerationId: id, accept: z.boolean() }),
    input,
    async ({ regenerationId, accept }) =>
      decideRegeneration(await requireTenant(), regenerationId, accept),
  );
}

export async function rateResourceAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "rate_resource",
    resourceRatingSchema.extend({ resourceId: id }),
    input,
    async ({ resourceId, rating, comment }) =>
      rateResource(await requireTenant(), resourceId, rating, comment),
  );
}

export async function rateItemAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "rate_item",
    itemFeedbackSchema.extend({ resourceId: id }),
    input,
    async ({ resourceId, itemKey, rating, comment }) =>
      rateItem(await requireTenant(), resourceId, itemKey, rating, comment),
  );
}

/** SPEC-0011 RN-14: nota mínima y puntaje de aprobación de la clave del examen. */
export async function setGradingScaleAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "set_grading_scale",
    // La escala completa (con sus reglas cruzadas) la valida gradingScaleSchema en el servicio.
    z.object({
      resourceId: id,
      passingGrade: gradingScaleSchema.shape.passingGrade,
      passingPoints: gradingScaleSchema.shape.passingPoints,
    }),
    input,
    async ({ resourceId, ...scale }) => setGradingScale(await requireTenant(), resourceId, scale),
  );
}

export async function addPreferenceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(
    "add_preference",
    preferenceSchema.extend({ courseId: id }),
    input,
    async ({ courseId, ...data }) => addPreference(await requireTenant(), courseId, data),
  );
}

export async function updatePreferenceAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "update_preference",
    z.object({
      preferenceId: id,
      active: z.boolean().optional(),
      scope: z.enum(["COURSE", "ALL"]).optional(),
      courseId: id.optional(),
    }),
    input,
    async ({ preferenceId, ...change }) =>
      updatePreference(await requireTenant(), preferenceId, change),
  );
}

export async function deletePreferenceAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "delete_preference",
    z.object({ preferenceId: id }),
    input,
    async ({ preferenceId }) => deletePreference(await requireTenant(), preferenceId),
  );
}
