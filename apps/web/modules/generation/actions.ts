"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { requireTenant } from "@/modules/tenancy";
import { proposeObjectivesSchema, proposePlanningSchema } from "@/modules/planning/client";
import { proposeObjectivesBatch } from "./objectives-batch";
import { proposePlanning } from "./planning";
import { acceptSuggestion, discardSuggestion, rateSuggestion, suggestObjectives } from "./service";
import type {
  ObjectiveSuggestionsResult,
  ObjectivesBatchProposal,
  PlanningProposal,
} from "./types";

const id = z.string().min(1);

export async function suggestObjectivesAction(
  input: unknown,
): Promise<ActionResult<ObjectiveSuggestionsResult>> {
  return runAction(
    "suggest_objectives",
    z.object({ topicId: id, count: z.number().int().min(1).max(5).default(3) }),
    input,
    async ({ topicId, count }) => suggestObjectives(await requireTenant(), topicId, count),
  );
}

export async function acceptSuggestionAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "accept_suggestion",
    z.object({
      suggestionId: id,
      statement: z.string().trim().min(5, "Mínimo 5 caracteres").max(500).optional(),
    }),
    input,
    async ({ suggestionId, statement }) => {
      await acceptSuggestion(await requireTenant(), suggestionId, statement);
    },
  );
}

export async function discardSuggestionAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "discard_suggestion",
    z.object({ suggestionId: id }),
    input,
    async ({ suggestionId }) => discardSuggestion(await requireTenant(), suggestionId),
  );
}

export async function rateSuggestionAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "rate_suggestion",
    z.object({
      suggestionId: id,
      rating: z.enum(["UP", "DOWN"]),
      comment: z.string().trim().max(500).nullable().optional(),
    }),
    input,
    async ({ suggestionId, rating, comment }) =>
      rateSuggestion(await requireTenant(), suggestionId, rating, comment),
  );
}

/** SPEC-0014: propuesta de unidades y temas con IA. No guarda nada en la planeación (RN-02). */
export async function proposePlanningAction(
  input: unknown,
): Promise<ActionResult<PlanningProposal>> {
  return runAction("propose_planning", proposePlanningSchema, input, async (data) =>
    proposePlanning(await requireTenant(), data),
  );
}

/** SPEC-0014 CA-0014-08: objetivos para todos los temas de una unidad o un periodo. */
export async function proposeObjectivesBatchAction(
  input: unknown,
): Promise<ActionResult<ObjectivesBatchProposal>> {
  return runAction("propose_objectives_batch", proposeObjectivesSchema, input, async (data) =>
    proposeObjectivesBatch(await requireTenant(), data),
  );
}
