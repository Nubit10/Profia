import "server-only";
import { db } from "@/lib/db";
import { invalid } from "@/lib/errors";
import { recordAudit } from "@/modules/audit";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { ownedCourse } from "./access";

/**
 * CA-0006-07 / RN-08: copia independiente de la planeación (lo no archivado) a otro curso propio
 * de la misma asignatura y grado. Se agrega al final de lo que ya tenga el destino.
 */
export async function copyPlanning(ctx: TenantContext, fromCourseId: string, toCourseId: string) {
  requireRole(ctx, "TEACHER");
  if (fromCourseId === toCourseId) throw invalid("Elige otro curso como destino");

  return db.$transaction(async (tx) => {
    const from = await ownedCourse(tx, ctx, fromCourseId);
    const to = await ownedCourse(tx, ctx, toCourseId);
    if (from.subjectId !== to.subjectId || from.grade !== to.grade) {
      throw invalid("Solo se copia a cursos de la misma asignatura y grado");
    }
    const base = { institutionId: ctx.institutionId };

    const sourcePeriods = await tx.coursePeriod.findMany({
      where: { courseId: from.id, ...base },
      orderBy: { number: "asc" },
    });
    let targetNumbers = new Set(
      (
        await tx.coursePeriod.findMany({
          where: { courseId: to.id, ...base },
          select: { number: true },
        })
      ).map((p) => p.number),
    );
    if (targetNumbers.size === 0) {
      await tx.coursePeriod.createMany({
        data: sourcePeriods.map((p) => ({
          ...base,
          courseId: to.id,
          number: p.number,
          name: p.name,
          startDate: p.startDate,
          endDate: p.endDate,
        })),
      });
      targetNumbers = new Set(sourcePeriods.map((p) => p.number));
    }

    const units = await tx.unit.findMany({
      where: { courseId: from.id, ...base, archivedAt: null },
      orderBy: { position: "asc" },
      include: {
        topics: {
          where: { archivedAt: null },
          orderBy: { position: "asc" },
          include: {
            objectives: {
              where: { archivedAt: null },
              orderBy: { position: "asc" },
              include: { links: true },
            },
          },
        },
      },
    });
    const last = await tx.unit.aggregate({ where: { courseId: to.id }, _max: { position: true } });
    let position = last._max.position ?? 0;
    let topics = 0;
    let objectives = 0;

    for (const unit of units) {
      position += 1;
      await tx.unit.create({
        data: {
          ...base,
          courseId: to.id,
          periodNumber:
            unit.periodNumber !== null && targetNumbers.has(unit.periodNumber)
              ? unit.periodNumber
              : null,
          title: unit.title,
          description: unit.description,
          position,
          topics: {
            create: unit.topics.map((topic) => {
              topics += 1;
              // institutionId de temas, objetivos y vínculos llega por las FK compuestas.
              return {
                title: topic.title,
                description: topic.description,
                plannedSessions: topic.plannedSessions,
                position: topic.position,
                objectives: {
                  create: topic.objectives.map((objective) => {
                    objectives += 1;
                    return {
                      statement: objective.statement,
                      position: objective.position,
                      links: {
                        create: objective.links.map((link) => ({
                          curriculumItemId: link.curriculumItemId,
                          evidenceIndexes: link.evidenceIndexes,
                        })),
                      },
                    };
                  }),
                },
              };
            }),
          },
        },
      });
    }

    const copied = { units: units.length, topics, objectives };
    await recordAudit(tx, {
      action: "planning.copied",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "course",
      entityId: to.id,
      metadata: { fromCourseId: from.id, ...copied },
    });
    return copied;
  });
}
