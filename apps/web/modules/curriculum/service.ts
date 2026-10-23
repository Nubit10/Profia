import "server-only";
import { db } from "@/lib/db";
import { areaName } from "@/lib/curriculum-areas";
import { getMyCourse } from "@/modules/courses";
import type { TenantContext } from "@/modules/tenancy";
import type { CurriculumReference } from "./types";

export type { CurriculumReference } from "./types";

const GRADE_ORDER = [
  "JARDIN",
  "TRANSICION",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "G10",
  "G11",
] as const;
type Grade = (typeof GRADE_ORDER)[number];

export type CourseReferences = {
  course: Awaited<ReturnType<typeof getMyCourse>>;
  areaId: string | null;
  areaName: string | null;
  /** Por qué no hay referentes, si es el caso (RN-07). */
  emptyReason: "NO_AREA" | "NO_ITEMS_FOR_GRADE" | null;
  references: CurriculumReference[];
};

/** Un estándar aplica si el grado del curso cae en su rango (RN-06). */
function gradesCovering(grade: Grade): Grade[] {
  const index = GRADE_ORDER.indexOf(grade);
  return GRADE_ORDER.filter((_, i) => i <= index);
}

/**
 * Referentes oficiales publicados para un curso del docente (CA-0004-04). En Transición se
 * muestran los DBA de Transición, que no se dividen por áreas.
 */
export async function getCourseReferences(
  ctx: TenantContext,
  courseId: string,
): Promise<CourseReferences> {
  const course = await getMyCourse(ctx, courseId);
  const grade = course.grade as Grade;
  const isTransition = grade === "TRANSICION";
  const areaId = isTransition ? "TRANSICION" : course.curriculumAreaId;

  if (!areaId) {
    return { course, areaId: null, areaName: null, emptyReason: "NO_AREA", references: [] };
  }

  const items = await db.curriculumItem.findMany({
    where: {
      areaId,
      source: { status: "PUBLISHED" },
      OR: [
        { type: "DBA", grade },
        {
          type: "STANDARD",
          gradeFrom: { in: gradesCovering(grade) },
          gradeTo: { notIn: gradesCovering(grade).filter((g) => g !== grade) },
        },
      ],
    },
    orderBy: [{ type: "asc" }, { number: "asc" }],
    select: {
      code: true,
      type: true,
      number: true,
      component: true,
      statement: true,
      evidences: true,
      page: true,
      source: {
        select: {
          issuer: true,
          title: true,
          version: true,
          year: true,
          url: true,
          reviewStatus: true,
        },
      },
    },
  });

  return {
    course,
    areaId,
    areaName: areaName(areaId),
    emptyReason: items.length === 0 ? "NO_ITEMS_FOR_GRADE" : null,
    references: items.map(({ source, page, ...item }) => ({
      ...item,
      citation: {
        issuer: source.issuer,
        title: source.title,
        version: source.version,
        year: source.year,
        page,
        url: source.url,
        reviewed: source.reviewStatus === "APPROVED",
      },
    })),
  };
}

/** Fuentes del catálogo, para mostrar el estado de revisión. */
export async function listCurriculumSources() {
  return db.curriculumSource.findMany({
    orderBy: [{ areaId: "asc" }, { key: "asc" }],
    select: {
      key: true,
      title: true,
      version: true,
      year: true,
      status: true,
      reviewStatus: true,
      _count: { select: { items: true } },
    },
  });
}
