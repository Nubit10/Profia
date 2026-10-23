"use server";

import { runAction, type ActionResult } from "@/lib/actions";
import { requireTenant } from "@/modules/tenancy";
import {
  courseArchiveSchema,
  courseSchema,
  subjectArchiveSchema,
  subjectAreaSchema,
  subjectSchema,
  updateCourseSchema,
} from "./schemas";
import {
  createCourse,
  createSubject,
  linkSubjectToArea,
  setCourseArchived,
  setSubjectArchived,
  updateCourse,
} from "./service";

/** Devuelve el id para que el asistente de creación siga con el curso nuevo (SPEC-0012). */
export async function createCourseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("create_course", courseSchema, input, async (data) =>
    createCourse(await requireTenant(), data),
  );
}

export async function updateCourseAction(input: unknown): Promise<ActionResult> {
  return runAction("update_course", updateCourseSchema, input, async ({ courseId, ...data }) =>
    updateCourse(await requireTenant(), courseId, data),
  );
}

export async function setCourseArchivedAction(input: unknown): Promise<ActionResult> {
  return runAction("archive_course", courseArchiveSchema, input, async ({ courseId, archived }) =>
    setCourseArchived(await requireTenant(), courseId, archived),
  );
}

export async function createSubjectAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction("create_subject", subjectSchema, input, async ({ name }) =>
    createSubject(await requireTenant(), name),
  );
}

export async function setSubjectArchivedAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "archive_subject",
    subjectArchiveSchema,
    input,
    async ({ subjectId, archived }) =>
      setSubjectArchived(await requireTenant(), subjectId, archived),
  );
}

export async function linkSubjectToAreaAction(input: unknown): Promise<ActionResult> {
  return runAction("link_subject_area", subjectAreaSchema, input, async ({ subjectId, areaId }) =>
    linkSubjectToArea(await requireTenant(), subjectId, areaId),
  );
}
