"use server";

import { runAction, type ActionResult } from "@/lib/actions";
import { requireTenant } from "@/modules/tenancy";
import { copyPlanning } from "./copy";
import { createQuickTopic } from "./outline";
import { setCoursePeriods } from "./periods";
import {
  acceptObjectivesBatch,
  acceptPlanningProposal,
  type AcceptProposalResult,
} from "./proposal";
import {
  acceptObjectivesSchema,
  acceptProposalSchema,
  archiveSchema,
  copySchema,
  coursePeriodsSchema,
  moveSchema,
  objectiveSchema,
  quickTopicSchema,
  topicSchema,
  unitSchema,
  updateObjectiveSchema,
  updateTopicSchema,
  updateUnitSchema,
} from "./schemas";
import {
  createObjective,
  createTopic,
  createUnit,
  moveItem,
  setItemArchived,
  updateObjective,
  updateTopic,
  updateUnit,
} from "./structure";

export async function setCoursePeriodsAction(input: unknown): Promise<ActionResult> {
  return runAction("set_course_periods", coursePeriodsSchema, input, async (data) =>
    setCoursePeriods(await requireTenant(), data),
  );
}

export async function createUnitAction(input: unknown): Promise<ActionResult> {
  return runAction("create_unit", unitSchema, input, async (data) => {
    await createUnit(await requireTenant(), data);
  });
}

export async function updateUnitAction(input: unknown): Promise<ActionResult> {
  return runAction("update_unit", updateUnitSchema, input, async (data) =>
    updateUnit(await requireTenant(), data),
  );
}

export async function createTopicAction(input: unknown): Promise<ActionResult> {
  return runAction("create_topic", topicSchema, input, async (data) => {
    await createTopic(await requireTenant(), data);
  });
}

/** SPEC-0012: tema rápido desde el asistente; devuelve el id para seguir con la creación. */
export async function createQuickTopicAction(
  input: unknown,
): Promise<ActionResult<{ topicId: string }>> {
  return runAction("create_quick_topic", quickTopicSchema, input, async (data) =>
    createQuickTopic(await requireTenant(), data),
  );
}

export async function updateTopicAction(input: unknown): Promise<ActionResult> {
  return runAction("update_topic", updateTopicSchema, input, async (data) =>
    updateTopic(await requireTenant(), data),
  );
}

export async function createObjectiveAction(input: unknown): Promise<ActionResult> {
  return runAction("create_objective", objectiveSchema, input, async (data) => {
    await createObjective(await requireTenant(), data);
  });
}

export async function updateObjectiveAction(input: unknown): Promise<ActionResult> {
  return runAction("update_objective", updateObjectiveSchema, input, async (data) =>
    updateObjective(await requireTenant(), data),
  );
}

export async function moveItemAction(input: unknown): Promise<ActionResult> {
  return runAction("move_planning_item", moveSchema, input, async ({ kind, id, direction }) =>
    moveItem(await requireTenant(), kind, id, direction),
  );
}

export async function setItemArchivedAction(input: unknown): Promise<ActionResult> {
  return runAction("archive_planning_item", archiveSchema, input, async ({ kind, id, archived }) =>
    setItemArchived(await requireTenant(), kind, id, archived),
  );
}

export async function copyPlanningAction(
  input: unknown,
): Promise<ActionResult<{ units: number; topics: number; objectives: number }>> {
  return runAction("copy_planning", copySchema, input, async ({ fromCourseId, toCourseId }) =>
    copyPlanning(await requireTenant(), fromCourseId, toCourseId),
  );
}

/** SPEC-0014: agrega lo que el docente dejó en la revisión de la propuesta con IA. */
export async function acceptPlanningProposalAction(
  input: unknown,
): Promise<ActionResult<AcceptProposalResult>> {
  return runAction("accept_planning_proposal", acceptProposalSchema, input, async (data) =>
    acceptPlanningProposal(await requireTenant(), data),
  );
}

/** SPEC-0014 CA-0014-08/09: agrega los objetivos marcados en la revisión en bloque. */
export async function acceptObjectivesBatchAction(
  input: unknown,
): Promise<ActionResult<{ objectives: number }>> {
  return runAction("accept_objectives_batch", acceptObjectivesSchema, input, async (data) =>
    acceptObjectivesBatch(await requireTenant(), data),
  );
}
