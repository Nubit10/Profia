import "server-only";
import { db } from "@/lib/db";
import { listMyCourses } from "@/modules/courses";
import { courseTitle } from "@/modules/courses/client";
import { listTopicOutline } from "@/modules/planning";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import type { ResourceType } from "./schemas";
import { DAILY_LIMIT, quotaFor, recoverStale, summary } from "./service";
import type { NextStep, QuotaStatus, ResourceListItem, TeacherHome } from "./types";

// Vistas de lectura para el Inicio, el menú y "Mis recursos" (SPEC-0012 RN-02, RN-12, RN-13).
// Todo filtra por el espacio activo y por el docente; nada se calcula en el cliente.

/** RN-12: el mismo conteo que aplica el límite. Las generaciones fallidas no cuentan. */
export async function getQuotaStatus(ctx: TenantContext): Promise<QuotaStatus> {
  requireRole(ctx, "TEACHER");
  await recoverStale(ctx);
  const quota = await quotaFor(db, ctx);
  return {
    used: Math.min(quota.used, DAILY_LIMIT),
    limit: DAILY_LIMIT,
    freesAt: quota.used >= DAILY_LIMIT ? quota.freesAt : null,
  };
}

const listSelect = {
  id: true,
  type: true,
  status: true,
  title: true,
  context: true,
  createdAt: true,
  updatedAt: true,
  courseId: true,
} as const;

async function withCourses(
  ctx: TenantContext,
  rows: (Parameters<typeof summary>[0] & { courseId: string })[],
): Promise<ResourceListItem[]> {
  const courses = new Map(
    (await listMyCourses(ctx, { includeArchived: true })).map((c) => [c.id, c]),
  );
  return rows.map((row) => {
    const course = courses.get(row.courseId);
    return {
      ...summary(row),
      courseId: row.courseId,
      courseTitle: course ? courseTitle(course) : "",
      subjectId: course?.subjectId ?? "",
    };
  });
}

/** "Mis recursos": todos los recursos del docente en el espacio activo, con filtros (CA-0012-27). */
export async function listMyResources(
  ctx: TenantContext,
  filters: { courseId?: string; type?: ResourceType } = {},
): Promise<ResourceListItem[]> {
  requireRole(ctx, "TEACHER");
  await recoverStale(ctx);
  const rows = await db.resource.findMany({
    where: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      status: { not: "ARCHIVED" },
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: listSelect,
  });
  return withCourses(ctx, rows);
}

/**
 * Inicio del docente (RN-02). El siguiente paso se evalúa en este orden:
 * sin cursos → crear curso; sin temas → planear; sin recursos → primer taller; si no, el último.
 */
export async function getTeacherHome(ctx: TenantContext): Promise<TeacherHome> {
  requireRole(ctx, "TEACHER");
  await recoverStale(ctx);
  const [courses, outline, recentRows] = await Promise.all([
    listMyCourses(ctx),
    listTopicOutline(ctx),
    db.resource.findMany({
      where: {
        institutionId: ctx.institutionId,
        membershipId: ctx.membershipId,
        status: { not: "ARCHIVED" },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: listSelect,
    }),
  ]);
  const recent = await withCourses(ctx, recentRows);
  const active = new Set(courses.map((c) => c.id));

  const topicCount = new Map<string, number>();
  let firstTopic: { courseId: string; topicId: string; topicTitle: string } | null = null;
  // El orden de los cursos es el de "Mis cursos": el primer tema del primer curso con temas.
  for (const course of courses) {
    const units = outline.find((o) => o.courseId === course.id)?.units ?? [];
    const topics = units.flatMap((u) => u.topics);
    topicCount.set(course.id, topics.length);
    if (!firstTopic && topics[0]) {
      firstTopic = { courseId: course.id, topicId: topics[0].id, topicTitle: topics[0].title };
    }
  }

  let nextStep: NextStep;
  if (courses.length === 0) {
    nextStep = { kind: "CREATE_COURSE" };
  } else if (!firstTopic) {
    const course = courses[0]!;
    nextStep = { kind: "PLAN", courseId: course.id, courseTitle: courseTitle(course) };
  } else if (recent.length === 0) {
    const course = courses.find((c) => c.id === firstTopic.courseId)!;
    nextStep = {
      kind: "FIRST_WORKSHOP",
      courseId: firstTopic.courseId,
      courseTitle: courseTitle(course),
      topicId: firstTopic.topicId,
      topicTitle: firstTopic.topicTitle,
    };
  } else {
    nextStep = { kind: "OPEN_LAST", resource: recent[0]! };
  }

  return {
    nextStep,
    courses: courses
      .filter((c) => active.has(c.id))
      .map((c) => ({
        id: c.id,
        title: courseTitle(c),
        subjectId: c.subjectId,
        subjectName: c.subjectName,
        academicYear: c.academicYear,
        topicCount: topicCount.get(c.id) ?? 0,
      })),
    recent,
  };
}
