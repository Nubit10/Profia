import "server-only";
import type { z } from "zod";
import { db, type DbClient } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { recordAudit } from "@/modules/audit";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { ownedCourse } from "./access";
import { DEFAULT_PERIODS, type coursePeriodsSchema } from "./schemas";

const toDate = (value: string | null | undefined) =>
  value ? new Date(`${value}T00:00:00Z`) : null;

/** RN-01: un curso sin periodos recibe los 4 por defecto. Idempotente. */
export async function ensureDefaultPeriods(
  client: DbClient,
  institutionId: string,
  courseId: string,
) {
  const existing = await client.coursePeriod.count({ where: { courseId, institutionId } });
  if (existing > 0) return;
  await client.coursePeriod.createMany({
    data: Array.from({ length: DEFAULT_PERIODS }, (_, i) => ({
      institutionId,
      courseId,
      number: i + 1,
      name: `Periodo ${i + 1}`,
    })),
    skipDuplicates: true,
  });
}

export async function listCoursePeriods(client: DbClient, institutionId: string, courseId: string) {
  return client.coursePeriod.findMany({
    where: { courseId, institutionId },
    orderBy: { number: "asc" },
    select: { number: true, name: true, startDate: true, endDate: true },
  });
}

/** Reemplaza los periodos del curso (CA-0006-02). Quitar periodos con unidades se rechaza (RN-03). */
export async function setCoursePeriods(
  ctx: TenantContext,
  input: z.output<typeof coursePeriodsSchema>,
) {
  requireRole(ctx, "TEACHER");
  await db.$transaction(async (tx) => {
    const course = await ownedCourse(tx, ctx, input.courseId);
    const keep = input.periods.length;
    const orphaned = await tx.unit.findFirst({
      where: { courseId: course.id, institutionId: ctx.institutionId, periodNumber: { gt: keep } },
      select: { periodNumber: true },
      orderBy: { periodNumber: "asc" },
    });
    if (orphaned) {
      throw conflict(`El periodo ${orphaned.periodNumber} tiene unidades; muévelas antes`);
    }

    await tx.coursePeriod.deleteMany({
      where: { courseId: course.id, institutionId: ctx.institutionId, number: { gt: keep } },
    });
    for (const period of input.periods) {
      const data = {
        name: period.name,
        startDate: toDate(period.startDate),
        endDate: toDate(period.endDate),
      };
      await tx.coursePeriod.upsert({
        where: { courseId_number: { courseId: course.id, number: period.number } },
        update: data,
        create: {
          institutionId: ctx.institutionId,
          courseId: course.id,
          number: period.number,
          ...data,
        },
      });
    }
    await recordAudit(tx, {
      action: "course_periods.updated",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "course",
      entityId: course.id,
      metadata: { periods: keep },
    });
  });
}
