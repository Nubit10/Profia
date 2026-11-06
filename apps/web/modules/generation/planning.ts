import "server-only";
import { db } from "@/lib/db";
import { invalid, rateLimited } from "@/lib/errors";
import { formatTime } from "@/lib/dates";
import { getLimiter } from "@/lib/rate-limit";
import { redactContactData } from "@/lib/text";
import { recordAudit } from "@/modules/audit";
import { GRADE_LABELS } from "@/modules/courses/client";
import {
  getCoursePlanning,
  getUnitCourseId,
  splitDbaByPeriod,
  type CoursePlanning,
} from "@/modules/planning";
import { PROPOSAL_RANGES, type ProposalSize } from "@/modules/planning/client";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { requestPlanning, type EnginePlanningRequest } from "./engine";
import type { PlanningProposal } from "./types";

const TASK = "planning";
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;
// RN-08: no descuentan el cupo de recursos; tienen su propio límite por docente.
export const PROPOSALS_PER_DAY = 20;
export const PROPOSALS_PER_MINUTE = 5;

export type ProposePlanningRequest =
  | {
      scope: "PERIOD";
      courseId: string;
      periodNumber: number;
      size: ProposalSize;
      avoid?: string[];
    }
  | { scope: "YEAR"; courseId: string; size: ProposalSize; avoid?: string[] }
  | { scope: "UNIT"; unitId: string; size: ProposalSize; avoid?: string[] };

async function consumeLimits(ctx: TenantContext) {
  // Primero el de un minuto: una ráfaga no debe gastar el cupo del día.
  const burst = await getLimiter("ai-planning-minute", PROPOSALS_PER_MINUTE, MINUTE).consume(
    ctx.membershipId,
  );
  const daily = burst.allowed
    ? await getLimiter("ai-planning-day", PROPOSALS_PER_DAY, DAY).consume(ctx.membershipId)
    : burst;
  if (!daily.allowed) {
    const at = formatTime(new Date(Date.now() + daily.retryAfterMs));
    throw rateLimited(`Ya pediste muchas propuestas. Puedes pedir otra desde las ${at}.`);
  }
}

/** Títulos que ya existen por periodo (RN-03): la IA completa, no reemplaza. */
function existingByPeriod(planning: CoursePlanning, periodNumber: number) {
  return planning.units
    .filter((u) => u.periodNumber === periodNumber)
    .map((u) => ({
      title: redactContactData(u.title),
      topics: u.topics.map((t) => redactContactData(t.title)),
    }));
}

/** Códigos ya cubiertos por un tema u objetivo del curso (RN-04). */
function coveredCodes(planning: CoursePlanning) {
  return new Set(planning.coverage.covered);
}

/**
 * Pide una propuesta de unidades y temas para un periodo, el año o una unidad (SPEC-0014 F-01).
 * Nada se guarda en la planeación: la propuesta va a la pantalla de revisión (RN-02).
 */
export async function proposePlanning(
  ctx: TenantContext,
  input: ProposePlanningRequest,
  fetcher: typeof fetch = fetch,
): Promise<PlanningProposal> {
  requireRole(ctx, "TEACHER");
  const courseId =
    input.scope === "UNIT" ? await getUnitCourseId(ctx, input.unitId) : input.courseId;
  // NOT_FOUND si el curso no es del docente en el espacio activo.
  const planning = await getCoursePlanning(ctx, courseId);
  const dba = planning.references
    .filter((r) => r.type === "DBA")
    .sort((a, b) => a.number - b.number);
  if (dba.length === 0) {
    throw invalid("Esta asignatura no tiene DBA en el catálogo; agrega los temas a mano.");
  }
  const unit =
    input.scope === "UNIT"
      ? planning.units.find((u) => u.id === input.unitId && !u.archived)
      : null;
  if (input.scope === "UNIT" && (!unit || unit.periodNumber === null)) {
    throw invalid("Asigna la unidad a un periodo antes de proponer temas.");
  }
  if (input.scope === "PERIOD" && !planning.periods.some((p) => p.number === input.periodNumber)) {
    throw invalid("Ese periodo no existe en el curso");
  }

  await consumeLimits(ctx);

  const codes = dba.map((d) => d.code);
  const covered = coveredCodes(planning);
  const split = splitDbaByPeriod(
    codes,
    planning.periods.map((p) => p.number),
  );
  const targets =
    input.scope === "YEAR"
      ? planning.periods
      : planning.periods.filter(
          (p) => p.number === (input.scope === "PERIOD" ? input.periodNumber : unit!.periodNumber),
        );
  const range = PROPOSAL_RANGES[input.size];

  const body: EnginePlanningRequest = {
    subject: planning.course.subjectName,
    grade: GRADE_LABELS[planning.course.grade],
    dba: dba.map(({ code, statement, evidences }) => ({ code, statement, evidences })),
    periods: targets.map((p) => {
      const share = input.scope === "UNIT" ? codes : (split.get(p.number) ?? []);
      return {
        number: p.number,
        name: p.name,
        dbaCodes: share,
        mustCover: input.scope === "UNIT" ? [] : share.filter((c) => !covered.has(c)),
        existing: existingByPeriod(planning, p.number),
      };
    }),
    unit: unit
      ? {
          title: redactContactData(unit.title),
          description: unit.description ? redactContactData(unit.description) : null,
          topics: unit.topics.filter((t) => !t.archived).map((t) => redactContactData(t.title)),
        }
      : null,
    avoid: (input.avoid ?? []).map(redactContactData),
    unitsMin: range.units[0],
    unitsMax: range.units[1],
    topicsMin: range.topics[0],
    topicsMax: range.topics[1],
  };

  const result = await requestPlanning(body, fetcher);
  const base = {
    institutionId: ctx.institutionId,
    membershipId: ctx.membershipId,
    task: TASK,
    entityType: input.scope === "UNIT" ? "unit" : "course",
    entityId: input.scope === "UNIT" ? input.unitId : courseId,
  };
  if (result.status !== "ok") {
    await db.generationLog.create({
      data: { ...base, status: result.status === "invalid" ? "INVALID" : "UNAVAILABLE" },
    });
    return { status: result.status };
  }

  const { periods, meta } = result.data;
  const byCode = new Map(dba.map((d) => [d.code, d]));
  const allowedByPeriod = new Map(body.periods.map((p) => [p.number, new Set(p.dbaCodes)]));
  // Defensa en profundidad (RN-01): solo DBA del periodo y del curso; el texto sale de la base.
  let dropped = meta.droppedCodes;
  const shaped = periods
    .filter((p) => allowedByPeriod.has(p.number))
    .map((p) => {
      const allowed = allowedByPeriod.get(p.number)!;
      return {
        number: p.number,
        name: planning.periods.find((x) => x.number === p.number)!.name,
        units: p.units.map((u, i) => ({
          key: `${p.number}-${i}`,
          unitId: unit?.id ?? null,
          title: unit?.title ?? u.title,
          topics: u.topics.map((t, j) => {
            const valid = [...new Set(t.dbaCodes)].filter((c) => allowed.has(c) && byCode.has(c));
            dropped += t.dbaCodes.length - valid.length;
            return {
              key: `${p.number}-${i}-${j}`,
              title: t.title,
              description: t.description,
              dba: valid.map((code) => {
                const ref = byCode.get(code)!;
                return { code, number: ref.number, statement: ref.statement };
              }),
            };
          }),
        })),
      };
    });

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
        tokens: meta.tokens,
        discardedCodes: dropped,
      },
      select: { id: true },
    });
    // CA-0014-19: queda el rastro de la propuesta (y de los DBA descartados), nunca el texto.
    await recordAudit(tx, {
      action: "ai.planning_proposed",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: base.entityType,
      entityId: base.entityId,
      metadata: {
        generationId: created.id,
        scope: input.scope,
        model: meta.model,
        promptVersion: meta.promptVersion,
        droppedCodes: dropped,
      },
    });
    return created;
  });

  return { status: "ok", generationId: log.id, courseId, periods: shaped };
}
