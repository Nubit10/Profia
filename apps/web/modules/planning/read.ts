import "server-only";
import { db } from "@/lib/db";
import { invalid, notFound } from "@/lib/errors";
import { GRADE_LABELS } from "@/modules/courses/client";
import { getCourseReferences } from "@/modules/curriculum";
import type { TenantContext } from "@/modules/tenancy";
import { ownedTopic } from "./access";
import { ensureDefaultPeriods, listCoursePeriods } from "./periods";
import type { CoursePlanning } from "./types";

/**
 * Planeación completa de un curso del docente (periodos → unidades → temas → objetivos), con
 * los DBA vinculados y la cobertura del grado (CA-0006-05). Crea los periodos por defecto si
 * el curso aún no tiene (CA-0006-01).
 */
export async function getCoursePlanning(
  ctx: TenantContext,
  courseId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<CoursePlanning> {
  // getCourseReferences valida que el curso sea del docente (NOT_FOUND si no).
  const refs = await getCourseReferences(ctx, courseId);
  await ensureDefaultPeriods(db, ctx.institutionId, courseId);
  const visible = opts.includeArchived ? {} : { archivedAt: null };

  const [periods, units] = await Promise.all([
    listCoursePeriods(db, ctx.institutionId, courseId),
    db.unit.findMany({
      where: { courseId, institutionId: ctx.institutionId, ...visible },
      orderBy: { position: "asc" },
      select: {
        id: true,
        periodNumber: true,
        title: true,
        description: true,
        archivedAt: true,
        topics: {
          where: visible,
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            plannedSessions: true,
            archivedAt: true,
            objectives: {
              where: visible,
              orderBy: { position: "asc" },
              select: {
                id: true,
                statement: true,
                archivedAt: true,
                links: {
                  select: {
                    evidenceIndexes: true,
                    curriculumItem: {
                      select: {
                        code: true,
                        number: true,
                        statement: true,
                        evidences: true,
                        page: true,
                        source: {
                          select: {
                            title: true,
                            version: true,
                            year: true,
                            url: true,
                            status: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const linked = new Set<string>();
  const shaped = units.map((unit) => ({
    id: unit.id,
    periodNumber: unit.periodNumber,
    title: unit.title,
    description: unit.description,
    archived: !!unit.archivedAt,
    topics: unit.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      plannedSessions: topic.plannedSessions,
      archived: !!topic.archivedAt,
      objectives: topic.objectives.map((objective) => ({
        id: objective.id,
        statement: objective.statement,
        archived: !!objective.archivedAt,
        links: objective.links.map(({ evidenceIndexes, curriculumItem: item }) => {
          if (!unit.archivedAt && !topic.archivedAt && !objective.archivedAt) linked.add(item.code);
          return {
            code: item.code,
            number: item.number,
            statement: item.statement,
            evidenceIndexes,
            evidences: evidenceIndexes.map((i) => item.evidences[i]).filter(Boolean) as string[],
            // RN-06: el vínculo se conserva aunque el MEN publique una versión nueva.
            superseded: item.source.status === "SUPERSEDED",
            citation: {
              title: item.source.title,
              version: item.source.version,
              year: item.source.year,
              page: item.page,
              url: item.source.url,
            },
          };
        }),
      })),
    })),
  }));

  const dbaRefs = refs.references.filter((r) => r.type === "DBA");
  return {
    course: refs.course,
    areaName: refs.areaName,
    hasArea: refs.emptyReason !== "NO_AREA",
    areaHasItems: refs.references.length > 0,
    periods: periods.map((p) => ({
      number: p.number,
      name: p.name,
      startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
    })),
    units: shaped,
    references: refs.references,
    coverage: {
      total: dbaRefs.length,
      covered: dbaRefs.filter((r) => linked.has(r.code)).map((r) => r.code),
      pending: dbaRefs
        .filter((r) => !linked.has(r.code))
        .map((r) => ({ code: r.code, number: r.number, statement: r.statement })),
    },
  };
}

/** Cursos propios a los que se puede copiar la planeación: misma asignatura y grado (RN-08). */
export async function listCopyTargets(ctx: TenantContext, courseId: string) {
  const { course } = await getCourseReferences(ctx, courseId);
  const targets = await db.course.findMany({
    where: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      subjectId: course.subjectId,
      grade: course.grade,
      archivedAt: null,
      id: { not: course.id },
    },
    orderBy: [{ academicYear: "desc" }, { groupName: "asc" }],
    select: { id: true, groupName: true, academicYear: true },
  });
  return targets;
}

/**
 * Contexto pedagógico de un tema para la IA (SPEC-0007 RN-02): asignatura, grado, tema,
 * objetivos existentes y DBA del curso. Sin ningún dato personal.
 */
export async function getTopicGenerationContext(ctx: TenantContext, topicId: string) {
  const topic = await db.$transaction((tx) => ownedTopic(tx, ctx, topicId));
  const [details, refs] = await Promise.all([
    db.topic.findUniqueOrThrow({
      where: { id: topic.id },
      select: {
        title: true,
        description: true,
        objectives: {
          where: { archivedAt: null },
          orderBy: { position: "asc" },
          select: {
            id: true,
            statement: true,
            links: { select: { curriculumItem: { select: { code: true } } } },
          },
        },
      },
    }),
    getCourseReferences(ctx, topic.unit.courseId),
  ]);
  return {
    courseId: topic.unit.courseId,
    topicId: topic.id,
    subject: refs.course.subjectName,
    grade: GRADE_LABELS[refs.course.grade],
    topic: { title: details.title, description: details.description },
    gradeCode: refs.course.grade,
    existingObjectives: details.objectives.map((o) => o.statement),
    objectives: details.objectives.map((o) => ({
      id: o.id,
      statement: o.statement,
      dbaCodes: o.links.map((l) => l.curriculumItem.code),
    })),
    dba: refs.references
      .filter((r) => r.type === "DBA")
      .map((r) => ({
        code: r.code,
        number: r.number,
        statement: r.statement,
        evidences: r.evidences,
      })),
  };
}

/**
 * Contexto de varios temas del mismo curso para un examen (SPEC-0011 RN-02): todos del docente,
 * activos (ni el tema ni su unidad archivados) y del mismo curso. Un tema ajeno responde
 * NOT_FOUND; uno archivado o de otro curso, INVALID. Conserva el orden pedido.
 */
export async function getTopicsGenerationContext(ctx: TenantContext, topicIds: string[]) {
  const rows = await db.topic.findMany({
    where: {
      id: { in: topicIds },
      institutionId: ctx.institutionId,
      unit: { course: { institutionId: ctx.institutionId, membershipId: ctx.membershipId } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      archivedAt: true,
      unit: {
        select: { id: true, title: true, courseId: true, periodNumber: true, archivedAt: true },
      },
      objectives: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true,
          statement: true,
          links: { select: { curriculumItem: { select: { code: true } } } },
        },
      },
    },
  });
  if (rows.length !== new Set(topicIds).size) throw notFound();
  const courseIds = new Set(rows.map((r) => r.unit.courseId));
  if (courseIds.size !== 1) throw invalid("Todos los temas del examen deben ser del mismo curso");
  if (rows.some((r) => r.archivedAt || r.unit.archivedAt)) {
    throw invalid("Uno de los temas está archivado: quítalo del examen");
  }
  const courseId = rows[0]!.unit.courseId;
  const [refs, periods] = await Promise.all([
    getCourseReferences(ctx, courseId),
    db.coursePeriod.findMany({
      where: { institutionId: ctx.institutionId, courseId },
      select: { number: true, name: true },
    }),
  ]);
  const periodName = (n: number | null) =>
    n ? (periods.find((p) => p.number === n)?.name ?? `Periodo ${n}`) : null;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    courseId,
    subject: refs.course.subjectName,
    grade: GRADE_LABELS[refs.course.grade],
    gradeCode: refs.course.grade,
    topics: topicIds.map((id) => {
      const t = byId.get(id)!;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        unit: { id: t.unit.id, title: t.unit.title },
        periodNumber: t.unit.periodNumber,
        periodName: periodName(t.unit.periodNumber),
        objectives: t.objectives.map((o) => ({
          id: o.id,
          statement: o.statement,
          dbaCodes: o.links.map((l) => l.curriculumItem.code),
        })),
      };
    }),
    dba: refs.references
      .filter((r) => r.type === "DBA")
      .map((r) => ({
        code: r.code,
        number: r.number,
        statement: r.statement,
        evidences: r.evidences,
      })),
  };
}
export type TopicsGenerationContext = Awaited<ReturnType<typeof getTopicsGenerationContext>>;

/** Nombre del periodo al que pertenece un tema propio, para encabezados (SPEC-0009). */
export async function getTopicPeriodName(
  ctx: TenantContext,
  topicId: string,
): Promise<string | null> {
  const topic = await db.topic.findFirst({
    where: {
      id: topicId,
      institutionId: ctx.institutionId,
      unit: { course: { institutionId: ctx.institutionId, membershipId: ctx.membershipId } },
    },
    select: { unit: { select: { courseId: true, periodNumber: true } } },
  });
  if (!topic?.unit.periodNumber) return null;
  const period = await db.coursePeriod.findFirst({
    where: {
      institutionId: ctx.institutionId,
      courseId: topic.unit.courseId,
      number: topic.unit.periodNumber,
    },
    select: { name: true },
  });
  return period?.name ?? `Periodo ${topic.unit.periodNumber}`;
}
