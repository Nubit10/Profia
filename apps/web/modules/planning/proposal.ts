import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { invalid } from "@/lib/errors";
import { cleanText, normalizeName } from "@/lib/text";
import { recordAudit } from "@/modules/audit";
import { getCourseReferences } from "@/modules/curriculum";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { ownedCourse } from "./access";
import type { acceptProposalSchema } from "./schemas";

type ProposalTopic = z.output<typeof acceptProposalSchema>["units"][number]["topics"][number];

export type AcceptProposalResult = { units: number; topics: number; skipped: number };

/**
 * Agrega a la planeación lo que el docente dejó en la revisión de la propuesta (SPEC-0014).
 *
 * - RN-01: los DBA se revalidan contra el curso; los ajenos se descartan.
 * - RN-03: solo agrega al final. No toca lo existente y omite los títulos que ya están (así dos
 *   pestañas que aceptan la misma propuesta no duplican nada).
 */
export async function acceptPlanningProposal(
  ctx: TenantContext,
  input: z.output<typeof acceptProposalSchema>,
): Promise<AcceptProposalResult> {
  requireRole(ctx, "TEACHER");
  // NOT_FOUND si el curso no es del docente en este espacio.
  const refs = await getCourseReferences(ctx, input.courseId);
  const allowed = new Set(refs.references.filter((r) => r.type === "DBA").map((r) => r.code));
  const cleanCodes = (codes: string[]) => [...new Set(codes.filter((c) => allowed.has(c)))];

  return db.$transaction(async (tx) => {
    const course = await ownedCourse(tx, ctx, input.courseId);
    const [periods, units] = await Promise.all([
      tx.coursePeriod.findMany({
        where: { courseId: course.id, institutionId: ctx.institutionId },
        select: { number: true },
      }),
      tx.unit.findMany({
        where: { courseId: course.id, institutionId: ctx.institutionId, archivedAt: null },
        select: {
          id: true,
          periodNumber: true,
          title: true,
          topics: { where: { archivedAt: null }, select: { title: true, position: true } },
        },
      }),
    ]);
    const periodNumbers = new Set(periods.map((p) => p.number));
    const lastUnit = await tx.unit.aggregate({
      where: { courseId: course.id },
      _max: { position: true },
    });
    let unitPosition = lastUnit._max.position ?? 0;
    let createdUnits = 0;
    let createdTopics = 0;
    let skipped = 0;

    // Por unidad: títulos de temas ya usados (normalizados) y última posición.
    const state = new Map(
      units.map((u) => [
        u.id,
        {
          taken: new Set(u.topics.map((t) => normalizeName(t.title))),
          position: Math.max(0, ...u.topics.map((t) => t.position)),
        },
      ]),
    );

    const addTopics = async (unitId: string, topics: ProposalTopic[]) => {
      const unitState = state.get(unitId)!;
      for (const topic of topics) {
        const title = cleanText(topic.title);
        const key = normalizeName(title);
        if (unitState.taken.has(key)) {
          skipped += 1;
          continue;
        }
        unitState.taken.add(key);
        unitState.position += 1;
        const created = await tx.topic.create({
          data: {
            institutionId: ctx.institutionId,
            unitId,
            title,
            description: topic.description ? cleanText(topic.description) : null,
            dbaCodes: cleanCodes(topic.dbaCodes),
            position: unitState.position,
          },
          select: { id: true },
        });
        await recordAudit(tx, {
          action: "topic.created",
          institutionId: ctx.institutionId,
          actorUserId: ctx.userId,
          entityType: "topic",
          entityId: created.id,
        });
        createdTopics += 1;
      }
    };

    for (const unit of input.units) {
      if (unit.kind === "EXISTING") {
        // Una unidad ajena o archivada no se puede completar.
        if (!state.has(unit.unitId)) {
          throw invalid("Esa unidad ya no está en la planeación", "units");
        }
        await addTopics(unit.unitId, unit.topics);
        continue;
      }
      if (!periodNumbers.has(unit.periodNumber)) {
        throw invalid("Ese periodo no existe en el curso", "units");
      }
      const title = cleanText(unit.title);
      const same = units.find(
        (u) =>
          u.periodNumber === unit.periodNumber && normalizeName(u.title) === normalizeName(title),
      );
      if (same) {
        // RN-03: la unidad ya existe en el periodo (otra pestaña la agregó): se completa.
        await addTopics(same.id, unit.topics);
        continue;
      }
      unitPosition += 1;
      const created = await tx.unit.create({
        data: {
          institutionId: ctx.institutionId,
          courseId: course.id,
          periodNumber: unit.periodNumber,
          title,
          position: unitPosition,
        },
        select: { id: true },
      });
      await recordAudit(tx, {
        action: "unit.created",
        institutionId: ctx.institutionId,
        actorUserId: ctx.userId,
        entityType: "unit",
        entityId: created.id,
      });
      createdUnits += 1;
      units.push({ id: created.id, periodNumber: unit.periodNumber, title, topics: [] });
      state.set(created.id, { taken: new Set(), position: 0 });
      await addTopics(created.id, unit.topics);
    }

    await recordAudit(tx, {
      action: "planning.ai_proposal_accepted",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "course",
      entityId: course.id,
      metadata: { units: createdUnits, topics: createdTopics, skipped },
    });
    return { units: createdUnits, topics: createdTopics, skipped };
  });
}
