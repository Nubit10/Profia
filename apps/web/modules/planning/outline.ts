import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { recordAudit } from "@/modules/audit";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { ownedCourse } from "./access";
import { ensureDefaultPeriods } from "./periods";
import type { quickTopicSchema } from "./schemas";
import type { TopicOutline } from "./types";

/**
 * Temas activos de los cursos activos del docente, agrupados por curso y unidad (SPEC-0012: paso
 * "Curso y tema" del asistente e Inicio). Solo lectura; filtra por espacio y docente.
 */
export async function listTopicOutline(ctx: TenantContext): Promise<TopicOutline[]> {
  requireRole(ctx, "TEACHER");
  const units = await db.unit.findMany({
    where: {
      institutionId: ctx.institutionId,
      archivedAt: null,
      course: {
        institutionId: ctx.institutionId,
        membershipId: ctx.membershipId,
        archivedAt: null,
      },
    },
    orderBy: [{ courseId: "asc" }, { position: "asc" }],
    select: {
      id: true,
      courseId: true,
      title: true,
      periodNumber: true,
      topics: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, title: true, _count: { select: { objectives: true } } },
      },
    },
  });
  const byCourse = new Map<string, TopicOutline>();
  for (const unit of units) {
    const course = byCourse.get(unit.courseId) ?? { courseId: unit.courseId, units: [] };
    course.units.push({
      id: unit.id,
      title: unit.title,
      periodNumber: unit.periodNumber,
      topics: unit.topics.map((t) => ({
        id: t.id,
        title: t.title,
        objectiveCount: t._count.objectives,
      })),
    });
    byCourse.set(unit.courseId, course);
  }
  return [...byCourse.values()];
}

const QUICK_UNIT_TITLE = "Unidad 1";

/**
 * Crea un tema sin pasar por la planeación (SPEC-0012 §7: el asistente no deja al docente en un
 * callejón). Va a la primera unidad activa del curso; si no hay, crea "Unidad 1" en el periodo 1.
 */
export async function createQuickTopic(
  ctx: TenantContext,
  input: z.output<typeof quickTopicSchema>,
): Promise<{ topicId: string }> {
  requireRole(ctx, "TEACHER");
  const course = await ownedCourse(db, ctx, input.courseId); // NOT_FOUND si es ajeno
  await ensureDefaultPeriods(db, ctx.institutionId, course.id);
  return db.$transaction(async (tx) => {
    let unit = await tx.unit.findFirst({
      where: { courseId: course.id, institutionId: ctx.institutionId, archivedAt: null },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (!unit) {
      unit = await tx.unit.create({
        data: {
          institutionId: ctx.institutionId,
          courseId: course.id,
          periodNumber: 1,
          title: QUICK_UNIT_TITLE,
          position: 1,
        },
        select: { id: true },
      });
      await recordAudit(tx, {
        action: "unit.created",
        institutionId: ctx.institutionId,
        actorUserId: ctx.userId,
        entityType: "unit",
        entityId: unit.id,
      });
    }
    const last = await tx.topic.aggregate({ where: { unitId: unit.id }, _max: { position: true } });
    const topic = await tx.topic.create({
      data: {
        institutionId: ctx.institutionId,
        unitId: unit.id,
        title: input.title,
        position: (last._max.position ?? 0) + 1,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: "topic.created",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "topic",
      entityId: topic.id,
    });
    return { topicId: topic.id };
  });
}
