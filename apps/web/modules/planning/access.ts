import "server-only";
import type { Prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { TenantContext } from "@/modules/tenancy";

// RN-04: un elemento de la planeación solo existe para el dueño del curso, en su espacio.
// Todo lo demás responde NOT_FOUND (ADR-0004).

type Tx = Prisma.TransactionClient;

const ownCourseWhere = (ctx: TenantContext) => ({
  institutionId: ctx.institutionId,
  membershipId: ctx.membershipId,
});

export async function ownedCourse(tx: Tx, ctx: TenantContext, courseId: string) {
  const course = await tx.course.findFirst({
    where: { id: courseId, ...ownCourseWhere(ctx) },
    select: { id: true, subjectId: true, grade: true },
  });
  if (!course) throw notFound();
  return course;
}

export async function ownedUnit(tx: Tx, ctx: TenantContext, unitId: string) {
  const unit = await tx.unit.findFirst({
    where: { id: unitId, institutionId: ctx.institutionId, course: ownCourseWhere(ctx) },
    select: { id: true, courseId: true, position: true },
  });
  if (!unit) throw notFound();
  return unit;
}

export async function ownedTopic(tx: Tx, ctx: TenantContext, topicId: string) {
  const topic = await tx.topic.findFirst({
    where: {
      id: topicId,
      institutionId: ctx.institutionId,
      unit: { course: ownCourseWhere(ctx) },
    },
    select: { id: true, unitId: true, position: true, unit: { select: { courseId: true } } },
  });
  if (!topic) throw notFound();
  return topic;
}

export async function ownedObjective(tx: Tx, ctx: TenantContext, objectiveId: string) {
  const objective = await tx.objective.findFirst({
    where: {
      id: objectiveId,
      institutionId: ctx.institutionId,
      topic: { unit: { course: ownCourseWhere(ctx) } },
    },
    select: {
      id: true,
      topicId: true,
      position: true,
      topic: { select: { unit: { select: { courseId: true } } } },
      links: { select: { curriculumItem: { select: { code: true } } } },
    },
  });
  if (!objective) throw notFound();
  return objective;
}
