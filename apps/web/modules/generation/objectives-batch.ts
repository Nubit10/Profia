import "server-only";
import { db } from "@/lib/db";
import { invalid } from "@/lib/errors";
import { redactContactData } from "@/lib/text";
import { recordAudit } from "@/modules/audit";
import { GRADE_LABELS } from "@/modules/courses/client";
import { getCoursePlanning, getUnitCourseId } from "@/modules/planning";
import { MAX_OBJECTIVES_PER_TOPIC } from "@/modules/planning/client";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { requestObjectiveSuggestions } from "./engine";
import { consumeProposalLimits } from "./planning";
import type { ObjectivesBatchProposal, ObjectivesBatchTopic } from "./types";

const TASK = "objectives_batch";
/** Un tema con este número de objetivos o más ya está completo: no se le proponen más. */
const TARGET_PER_TOPIC = 3;
/** Temas por propuesta: una llamada por tema (contrato objective-suggestions.v1). */
export const MAX_BATCH_TOPICS = 12;
/** Llamadas a la vez: el plan gratuito de Groq tiene cupo por minuto. */
const CONCURRENCY = 3;

export type ProposeObjectivesRequest =
  { scope: "UNIT"; unitId: string } | { scope: "PERIOD"; courseId: string; periodNumber: number };

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]!);
      }
    }),
  );
  return results;
}

/**
 * Propone 1 a 3 objetivos para cada tema de una unidad o un periodo, ligados a los DBA del tema
 * (SPEC-0014 F-02, RN-06). Reutiliza el contrato de SPEC-0007, una llamada por tema. Nada se
 * guarda: la revisión los muestra y el docente decide (RN-02).
 */
export async function proposeObjectivesBatch(
  ctx: TenantContext,
  input: ProposeObjectivesRequest,
  fetcher: typeof fetch = fetch,
): Promise<ObjectivesBatchProposal> {
  requireRole(ctx, "TEACHER");
  const courseId =
    input.scope === "UNIT" ? await getUnitCourseId(ctx, input.unitId) : input.courseId;
  const planning = await getCoursePlanning(ctx, courseId); // NOT_FOUND si es ajeno
  const dba = planning.references.filter((r) => r.type === "DBA");
  if (dba.length === 0) {
    throw invalid("Esta asignatura no tiene DBA en el catálogo; redacta los objetivos a mano.");
  }
  const units = planning.units.filter(
    (u) =>
      !u.archived &&
      (input.scope === "UNIT" ? u.id === input.unitId : u.periodNumber === input.periodNumber),
  );
  const all = units.flatMap((u) =>
    u.topics
      .filter((t) => !t.archived)
      .map((t) => ({ ...t, unitTitle: u.title, active: t.objectives.filter((o) => !o.archived) })),
  );
  if (all.length === 0) throw invalid("Agrega temas antes de proponer objetivos.");
  const pending = all.filter((t) => t.active.length < TARGET_PER_TOPIC);
  if (pending.length === 0) {
    throw invalid(`Todos los temas ya tienen ${TARGET_PER_TOPIC} objetivos o más.`);
  }
  if (pending.length > MAX_BATCH_TOPICS) {
    throw invalid(
      `Son ${pending.length} temas sin objetivos suficientes; propón por unidad (hasta ${MAX_BATCH_TOPICS} temas).`,
    );
  }

  await consumeProposalLimits(ctx);

  const byCode = new Map(dba.map((d) => [d.code, d]));
  const results = await mapLimited(pending, CONCURRENCY, async (topic) => {
    // RN-06: los DBA que el tema ya tiene (de la propuesta o de sus objetivos); si no tiene
    // ninguno, los del curso.
    const own = new Set([
      ...topic.dbaCodes,
      ...topic.active.flatMap((o) => o.links.map((l) => l.code)),
    ]);
    const refs = own.size ? dba.filter((d) => own.has(d.code)) : dba;
    const count = Math.min(
      TARGET_PER_TOPIC - topic.active.length,
      MAX_OBJECTIVES_PER_TOPIC - topic.active.length,
    );
    const result = await requestObjectiveSuggestions(
      {
        subject: planning.course.subjectName,
        grade: GRADE_LABELS[planning.course.grade],
        topic: {
          title: redactContactData(topic.title),
          description: topic.description ? redactContactData(topic.description) : null,
        },
        existingObjectives: topic.active.map((o) => redactContactData(o.statement)),
        dba: refs.map(({ code, statement, evidences }) => ({ code, statement, evidences })),
        count,
      },
      fetcher,
    );
    return { topic, allowed: new Set(refs.map((r) => r.code)), result };
  });

  const base = {
    institutionId: ctx.institutionId,
    membershipId: ctx.membershipId,
    task: TASK,
    entityType: input.scope === "UNIT" ? "unit" : "course",
    entityId: input.scope === "UNIT" ? input.unitId : courseId,
  };
  const ok = results.filter((r) => r.result.status === "ok");
  if (ok.length === 0) {
    const status = results.some((r) => r.result.status === "invalid") ? "invalid" : "unavailable";
    await db.generationLog.create({
      data: { ...base, status: status === "invalid" ? "INVALID" : "UNAVAILABLE" },
    });
    return { status };
  }

  let discarded = 0;
  const topics: ObjectivesBatchTopic[] = ok.map(({ topic, allowed, result }) => {
    const data = (result as Extract<typeof result, { status: "ok" }>).data;
    return {
      topicId: topic.id,
      title: topic.title,
      unitTitle: topic.unitTitle,
      existing: topic.active.length,
      suggestions: data.suggestions.map((s, i) => {
        // Defensa en profundidad (RN-01): solo DBA del tema; el texto sale de la base.
        const valid = [...new Set(s.dbaCodes)].filter((c) => allowed.has(c));
        discarded += s.dbaCodes.length - valid.length;
        return {
          key: `${topic.id}-${i}`,
          statement: s.statement,
          dba: valid.map((code) => {
            const ref = byCode.get(code)!;
            return { code, number: ref.number, statement: ref.statement };
          }),
        };
      }),
    };
  });
  const metas = ok.map((r) => (r.result as Extract<typeof r.result, { status: "ok" }>).data.meta);

  const log = await db.$transaction(async (tx) => {
    const created = await tx.generationLog.create({
      data: {
        ...base,
        status: "OK",
        provider: metas[0]!.provider,
        model: metas[0]!.model,
        promptVersion: metas[0]!.promptVersion,
        attempts: metas.reduce((n, m) => n + m.attempts, 0),
        latencyMs: metas.reduce((n, m) => n + m.latencyMs, 0),
        discardedCodes: discarded,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: "ai.objectives_batch_proposed",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: base.entityType,
      entityId: base.entityId,
      metadata: {
        generationId: created.id,
        topics: topics.length,
        failed: results.length - ok.length,
        model: metas[0]!.model,
        promptVersion: metas[0]!.promptVersion,
      },
    });
    return created;
  });

  return {
    status: "ok",
    generationId: log.id,
    courseId,
    topics,
    failed: results.length - ok.length,
    skipped: all.length - pending.length,
  };
}
