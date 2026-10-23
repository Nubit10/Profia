import "server-only";
import { db } from "@/lib/db";
import { invalid, notFound, rateLimited } from "@/lib/errors";
import { getLimiter } from "@/lib/rate-limit";
import { recordAudit } from "@/modules/audit";
import { createObjective, getTopicGenerationContext } from "@/modules/planning";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { requestObjectiveSuggestions } from "./engine";
import type { ObjectiveSuggestionsResult } from "./types";

const TASK = "objective_suggestions";
const HOUR = 60 * 60 * 1000;
const PER_TEACHER_PER_HOUR = 20;

/**
 * Pide sugerencias de objetivos para un tema propio (SPEC-0007). Nada se guarda como objetivo:
 * las sugerencias quedan pendientes hasta que el docente decida (RN-01).
 */
export async function suggestObjectives(
  ctx: TenantContext,
  topicId: string,
  count = 3,
  fetcher: typeof fetch = fetch,
): Promise<ObjectiveSuggestionsResult> {
  requireRole(ctx, "TEACHER");
  const context = await getTopicGenerationContext(ctx, topicId); // NOT_FOUND si el tema es ajeno
  const limit = await getLimiter("ai-objectives", PER_TEACHER_PER_HOUR, HOUR).consume(
    ctx.membershipId,
  );
  if (!limit.allowed) throw rateLimited();

  // RN-02: solo contexto pedagógico; ni nombres, ni correos, ni institución.
  const result = await requestObjectiveSuggestions(
    {
      subject: context.subject,
      grade: context.grade,
      topic: context.topic,
      existingObjectives: context.existingObjectives,
      dba: context.dba.map(({ code, statement, evidences }) => ({ code, statement, evidences })),
      count,
    },
    fetcher,
  );

  const base = {
    institutionId: ctx.institutionId,
    membershipId: ctx.membershipId,
    task: TASK,
    entityType: "topic",
    entityId: context.topicId,
  };
  if (result.status !== "ok") {
    await db.generationLog.create({
      data: { ...base, status: result.status === "invalid" ? "INVALID" : "UNAVAILABLE" },
    });
    return { status: result.status };
  }

  const { suggestions, meta } = result.data;
  const dbaByCode = new Map(context.dba.map((d) => [d.code, d]));
  const log = await db.$transaction(async (tx) => {
    const created = await tx.generationLog.create({
      data: {
        ...base,
        status: "OK",
        provider: meta.provider,
        model: meta.model,
        promptVersion: meta.promptVersion,
        attempts: meta.attempts,
        latencyMs: meta.latencyMs,
        suggestions: {
          // institutionId llega por la FK compuesta con la generación.
          create: suggestions.map((s, position) => ({
            position,
            statement: s.statement,
            // Defensa en profundidad (RN-04): solo códigos que estaban en el contexto.
            dbaCodes: s.dbaCodes.filter((c) => dbaByCode.has(c)),
          })),
        },
      },
      select: {
        id: true,
        suggestions: {
          orderBy: { position: "asc" },
          select: { id: true, statement: true, dbaCodes: true },
        },
      },
    });
    await recordAudit(tx, {
      action: "ai.objectives_suggested",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "topic",
      entityId: context.topicId,
      metadata: { generationId: created.id, model: meta.model, promptVersion: meta.promptVersion },
    });
    return created;
  });

  return {
    status: "ok",
    generationId: log.id,
    model: meta.model,
    suggestions: log.suggestions.map((s) => ({
      id: s.id,
      statement: s.statement,
      dba: s.dbaCodes.map((code) => {
        const ref = dbaByCode.get(code)!;
        return { code, number: ref.number, statement: ref.statement };
      }),
    })),
  };
}

/** Sugerencia propia y pendiente (o NOT_FOUND). */
async function ownSuggestion(ctx: TenantContext, suggestionId: string) {
  const suggestion = await db.generationSuggestion.findFirst({
    where: {
      id: suggestionId,
      institutionId: ctx.institutionId,
      generation: { membershipId: ctx.membershipId },
    },
    select: {
      id: true,
      statement: true,
      dbaCodes: true,
      decision: true,
      generation: { select: { entityId: true } },
    },
  });
  if (!suggestion) throw notFound();
  return suggestion;
}

/**
 * CA-0007-06: aceptar crea el objetivo vinculado a sus DBA (con el texto editado, si lo hay).
 * El "claim" de la sugerencia evita crear dos objetivos con dos clics.
 */
export async function acceptSuggestion(
  ctx: TenantContext,
  suggestionId: string,
  editedStatement?: string,
) {
  requireRole(ctx, "TEACHER");
  const suggestion = await ownSuggestion(ctx, suggestionId);
  const statement = (editedStatement ?? suggestion.statement).trim();
  const edited = statement !== suggestion.statement;

  const claimed = await db.generationSuggestion.updateMany({
    where: { id: suggestion.id, decision: "PENDING" },
    data: {
      decision: edited ? "EDITED" : "ACCEPTED",
      finalStatement: edited ? statement : null,
      decidedAt: new Date(),
    },
  });
  if (claimed.count === 0) throw invalid("Esta sugerencia ya fue decidida");

  try {
    const objective = await createObjective(ctx, {
      topicId: suggestion.generation.entityId,
      statement,
      links: suggestion.dbaCodes.map((code) => ({ code, evidenceIndexes: [] })),
    });
    await db.$transaction(async (tx) => {
      await tx.generationSuggestion.update({
        where: { id: suggestion.id },
        data: { objectiveId: objective.id },
      });
      await recordAudit(tx, {
        action: "ai.suggestion_accepted",
        institutionId: ctx.institutionId,
        actorUserId: ctx.userId,
        entityType: "objective",
        entityId: objective.id,
        metadata: { suggestionId: suggestion.id, edited },
      });
    });
    return objective;
  } catch (error) {
    // Si el objetivo no se pudo crear (p. ej. texto inválido), la sugerencia vuelve a quedar pendiente.
    await db.generationSuggestion.update({
      where: { id: suggestion.id },
      data: { decision: "PENDING", finalStatement: null, decidedAt: null },
    });
    throw error;
  }
}

export async function discardSuggestion(ctx: TenantContext, suggestionId: string) {
  requireRole(ctx, "TEACHER");
  const suggestion = await ownSuggestion(ctx, suggestionId);
  await db.$transaction(async (tx) => {
    const { count } = await tx.generationSuggestion.updateMany({
      where: { id: suggestion.id, decision: "PENDING" },
      data: { decision: "DISCARDED", decidedAt: new Date() },
    });
    if (count === 0) throw invalid("Esta sugerencia ya fue decidida");
    await recordAudit(tx, {
      action: "ai.suggestion_discarded",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "generation_suggestion",
      entityId: suggestion.id,
    });
  });
}

/** CA-0007-07: la calificación queda ligada a la generación (modelo y versión de prompt). */
export async function rateSuggestion(
  ctx: TenantContext,
  suggestionId: string,
  rating: "UP" | "DOWN",
  comment?: string | null,
) {
  requireRole(ctx, "TEACHER");
  const suggestion = await ownSuggestion(ctx, suggestionId);
  await db.generationSuggestion.update({
    where: { id: suggestion.id },
    data: { rating, comment: comment?.trim() || null },
  });
}
