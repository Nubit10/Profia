import "server-only";
import type { z } from "zod";
import { db, isUniqueViolation, type DbClient } from "@/lib/db";
import { conflict, invalid, notFound } from "@/lib/errors";
import { CURRICULUM_AREA_IDS, type CurriculumAreaId } from "@/lib/curriculum-areas";
import { cleanText, normalizeName } from "@/lib/text";
import { recordAudit } from "@/modules/audit";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import type { courseSchema } from "./schemas";

type CourseData = Omit<z.output<typeof courseSchema>, "campusId"> & { campusId?: string };

// ---------- Asignaturas ----------

// Orden alfabético en español ("Ética" junto a la E), independiente de la intercalación de la base.
const spanishOrder = new Intl.Collator("es", { sensitivity: "base" });

export async function listSubjects(ctx: TenantContext, opts: { includeArchived?: boolean } = {}) {
  const subjects = await db.subject.findMany({
    where: {
      institutionId: ctx.institutionId,
      ...(opts.includeArchived ? {} : { archivedAt: null }),
    },
    select: { id: true, name: true, isPreloaded: true, archivedAt: true, curriculumAreaId: true },
  });
  return subjects.sort((a, b) => spanishOrder.compare(a.name, b.name));
}

/** Cualquier docente o administrador puede agregar asignaturas al espacio (SPEC-0003 §3). */
export async function createSubject(ctx: TenantContext, name: string) {
  if (!ctx.roles.includes("TEACHER")) requireRole(ctx, "ADMIN");
  try {
    return await db.$transaction(async (tx) => {
      const subject = await tx.subject.create({
        data: {
          institutionId: ctx.institutionId,
          name: cleanText(name),
          normalizedName: normalizeName(name),
        },
        select: { id: true, name: true },
      });
      await recordAudit(tx, {
        action: "subject.created",
        institutionId: ctx.institutionId,
        actorUserId: ctx.userId,
        entityType: "subject",
        entityId: subject.id,
      });
      return subject;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("Esa asignatura ya existe", "name");
    throw error;
  }
}

export async function setSubjectArchived(ctx: TenantContext, subjectId: string, archived: boolean) {
  requireRole(ctx, "ADMIN");
  await db.$transaction(async (tx) => {
    const { count } = await tx.subject.updateMany({
      where: { id: subjectId, institutionId: ctx.institutionId },
      data: { archivedAt: archived ? new Date() : null },
    });
    if (count === 0) throw notFound();
    await recordAudit(tx, {
      action: archived ? "subject.archived" : "subject.unarchived",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "subject",
      entityId: subjectId,
    });
  });
}

/**
 * Vincula una asignatura del espacio a un área curricular oficial, o la desvincula con null
 * (SPEC-0004, CA-0004-06). Lo puede hacer un docente o un administrador del espacio.
 */
export async function linkSubjectToArea(
  ctx: TenantContext,
  subjectId: string,
  areaId: CurriculumAreaId | null,
) {
  if (!ctx.roles.includes("TEACHER")) requireRole(ctx, "ADMIN");
  if (areaId !== null && !CURRICULUM_AREA_IDS.includes(areaId))
    throw invalid("Área no válida", "areaId");
  await db.$transaction(async (tx) => {
    const { count } = await tx.subject.updateMany({
      where: { id: subjectId, institutionId: ctx.institutionId },
      data: { curriculumAreaId: areaId },
    });
    if (count === 0) throw notFound();
    await recordAudit(tx, {
      action: "subject.area_linked",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "subject",
      entityId: subjectId,
      metadata: { areaId },
    });
  });
}

// ---------- Cursos ----------

/** Solo los cursos del propio docente en el espacio activo (CA-0003-04). */
function ownCourse(ctx: TenantContext, courseId: string) {
  return { id: courseId, institutionId: ctx.institutionId, membershipId: ctx.membershipId };
}

/** Un curso del propio docente, o NOT_FOUND si es de otro docente o de otro espacio. */
export async function getMyCourse(ctx: TenantContext, courseId: string) {
  requireRole(ctx, "TEACHER");
  const course = await db.course.findFirst({
    where: ownCourse(ctx, courseId),
    select: {
      id: true,
      grade: true,
      groupName: true,
      academicYear: true,
      archivedAt: true,
      subject: { select: { id: true, name: true, curriculumAreaId: true } },
      campus: { select: { name: true } },
    },
  });
  if (!course) throw notFound();
  return {
    id: course.id,
    grade: course.grade,
    groupName: course.groupName,
    academicYear: course.academicYear,
    archived: !!course.archivedAt,
    subjectId: course.subject.id,
    subjectName: course.subject.name,
    curriculumAreaId: course.subject.curriculumAreaId,
    campusName: course.campus.name,
  };
}

export async function listMyCourses(ctx: TenantContext, opts: { includeArchived?: boolean } = {}) {
  requireRole(ctx, "TEACHER");
  const courses = await db.course.findMany({
    where: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      ...(opts.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ academicYear: "desc" }, { grade: "asc" }, { groupName: "asc" }],
    select: {
      id: true,
      grade: true,
      groupName: true,
      academicYear: true,
      archivedAt: true,
      subject: { select: { id: true, name: true } },
      campus: { select: { id: true, name: true } },
    },
  });
  return courses.map(({ subject, campus, ...course }) => ({
    ...course,
    subjectId: subject.id,
    subjectName: subject.name,
    campusId: campus.id,
    campusName: campus.name,
  }));
}

/**
 * Valida que la asignatura y la sede sean activas y del mismo espacio. En espacios
 * independientes la sede es la interna y no se elige (RN-06).
 */
async function resolveCourseRefs(
  client: DbClient,
  ctx: TenantContext,
  data: CourseData,
  current?: { subjectId: string; campusId: string },
) {
  const subject = await client.subject.findFirst({
    where: { id: data.subjectId, institutionId: ctx.institutionId },
    select: { id: true, archivedAt: true },
  });
  if (!subject) throw notFound("Asignatura no encontrada");
  if (subject.archivedAt && subject.id !== current?.subjectId) {
    throw invalid("Esa asignatura está archivada", "subjectId");
  }

  const wantedCampus = ctx.institutionType === "SCHOOL" ? data.campusId : undefined;
  if (wantedCampus) {
    const campus = await client.campus.findFirst({
      where: { id: wantedCampus, institutionId: ctx.institutionId },
      select: { id: true, archivedAt: true },
    });
    if (!campus) throw notFound("Sede no encontrada");
    if (campus.archivedAt && campus.id !== current?.campusId) {
      throw invalid("Esa sede está archivada", "campusId");
    }
    return { subjectId: subject.id, campusId: campus.id };
  }
  if (current && ctx.institutionType === "INDEPENDENT")
    return { subjectId: subject.id, campusId: current.campusId };

  const defaultCampus = await client.campus.findFirst({
    where: { institutionId: ctx.institutionId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!defaultCampus) throw invalid("El espacio no tiene sedes activas");
  return { subjectId: subject.id, campusId: defaultCampus.id };
}

const DUPLICATE_COURSE = "Ya tienes este curso";

export async function createCourse(ctx: TenantContext, data: CourseData) {
  requireRole(ctx, "TEACHER");
  try {
    return await db.$transaction(async (tx) => {
      const refs = await resolveCourseRefs(tx, ctx, data);
      const course = await tx.course.create({
        data: {
          institutionId: ctx.institutionId,
          membershipId: ctx.membershipId,
          ...refs,
          grade: data.grade,
          groupName: cleanText(data.groupName).toUpperCase(),
          academicYear: data.academicYear,
        },
        select: { id: true },
      });
      await recordAudit(tx, {
        action: "course.created",
        institutionId: ctx.institutionId,
        actorUserId: ctx.userId,
        entityType: "course",
        entityId: course.id,
      });
      return course;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(DUPLICATE_COURSE);
    throw error;
  }
}

export async function updateCourse(ctx: TenantContext, courseId: string, data: CourseData) {
  requireRole(ctx, "TEACHER");
  try {
    await db.$transaction(async (tx) => {
      const current = await tx.course.findFirst({
        where: ownCourse(ctx, courseId),
        select: { subjectId: true, campusId: true },
      });
      if (!current) throw notFound();
      const refs = await resolveCourseRefs(tx, ctx, data, current);
      await tx.course.update({
        where: { id: courseId },
        data: {
          ...refs,
          grade: data.grade,
          groupName: cleanText(data.groupName).toUpperCase(),
          academicYear: data.academicYear,
        },
      });
      await recordAudit(tx, {
        action: "course.updated",
        institutionId: ctx.institutionId,
        actorUserId: ctx.userId,
        entityType: "course",
        entityId: courseId,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(DUPLICATE_COURSE);
    throw error;
  }
}

export async function setCourseArchived(ctx: TenantContext, courseId: string, archived: boolean) {
  requireRole(ctx, "TEACHER");
  await db.$transaction(async (tx) => {
    const { count } = await tx.course.updateMany({
      where: ownCourse(ctx, courseId),
      data: { archivedAt: archived ? new Date() : null },
    });
    if (count === 0) throw notFound();
    await recordAudit(tx, {
      action: archived ? "course.archived" : "course.unarchived",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "course",
      entityId: courseId,
    });
  });
}
