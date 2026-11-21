import "server-only";
import type { Prisma } from "@/lib/db";
import { invalid } from "@/lib/errors";
import { normalizeName } from "@/lib/text";
import { recordAudit } from "@/modules/audit";
import type { TenantContext } from "@/modules/tenancy";
import { ownedCourse, ownedTopic } from "./access";
import { ensureDefaultPeriods } from "./periods";

export type TopicMatch = { topicId: string; created: boolean };

/**
 * SPEC-0028 RN-03: el tema equivalente de otro curso propio de la misma asignatura y grado, por
 * título normalizado. Si no existe, se crea en la unidad del mismo título (o se crea esa unidad en
 * el mismo periodo). Va dentro de la transacción de quien copia.
 */
export async function matchTopicsInCourse(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
  sourceTopicIds: string[],
  toCourseId: string,
): Promise<Map<string, TopicMatch>> {
  const to = await ownedCourse(tx, ctx, toCourseId);
  const sources = await Promise.all(sourceTopicIds.map((id) => ownedTopic(tx, ctx, id)));
  const fromCourseId = sources[0]?.unit.courseId;
  if (!fromCourseId) return new Map();
  const from = await ownedCourse(tx, ctx, fromCourseId);
  if (from.id === to.id) throw invalid("Elige otro curso");
  if (from.subjectId !== to.subjectId || from.grade !== to.grade) {
    throw invalid("Solo se puede usar en cursos de la misma asignatura y grado");
  }
  await ensureDefaultPeriods(tx, ctx.institutionId, to.id);

  const base = { institutionId: ctx.institutionId };
  const details = await tx.topic.findMany({
    where: { id: { in: sourceTopicIds }, ...base },
    select: {
      id: true,
      title: true,
      description: true,
      plannedSessions: true,
      dbaCodes: true,
      unit: { select: { title: true, periodNumber: true } },
    },
  });
  const units = await tx.unit.findMany({
    where: { courseId: to.id, ...base, archivedAt: null },
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      topics: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, title: true, position: true },
      },
    },
  });

  const result = new Map<string, TopicMatch>();
  for (const id of sourceTopicIds) {
    const source = details.find((d) => d.id === id)!;
    const key = normalizeName(source.title);
    const existing = units.flatMap((u) => u.topics).find((t) => normalizeName(t.title) === key);
    if (existing) {
      result.set(id, { topicId: existing.id, created: false });
      continue;
    }
    let unit = units.find((u) => normalizeName(u.title) === normalizeName(source.unit.title));
    if (!unit) {
      const last = await tx.unit.aggregate({
        where: { courseId: to.id },
        _max: { position: true },
      });
      const created = await tx.unit.create({
        data: {
          ...base,
          courseId: to.id,
          periodNumber: source.unit.periodNumber,
          title: source.unit.title,
          position: (last._max.position ?? 0) + 1,
        },
        select: { id: true, title: true },
      });
      unit = { ...created, topics: [] };
      units.push(unit);
      await recordAudit(tx, {
        action: "unit.created",
        institutionId: ctx.institutionId,
        actorUserId: ctx.userId,
        entityType: "unit",
        entityId: created.id,
      });
    }
    const position = Math.max(0, ...unit.topics.map((t) => t.position)) + 1;
    const topic = await tx.topic.create({
      data: {
        ...base,
        unitId: unit.id,
        title: source.title,
        description: source.description,
        plannedSessions: source.plannedSessions,
        dbaCodes: source.dbaCodes,
        position,
      },
      select: { id: true, title: true, position: true },
    });
    unit.topics.push(topic);
    await recordAudit(tx, {
      action: "topic.created",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "topic",
      entityId: topic.id,
    });
    result.set(id, { topicId: topic.id, created: true });
  }
  return result;
}
