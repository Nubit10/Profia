import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  createCourseAction,
  listMyCourses,
  listSubjects,
  setCourseArchivedAction,
  updateCourseAction,
} from "@/modules/courses";
import { listCampuses } from "@/modules/institutions";
import { requireTenant } from "@/modules/tenancy";
import { CoursesView } from "./courses-view";

export const metadata: Metadata = { title: "Mis cursos" };

/** "Mis cursos" (SPEC-0012 RN-13): la lista de cursos, aparte del Inicio. */
export default async function CoursesPage() {
  const ctx = await requireTenant();
  // CA-0003-07: un administrador que no da clases no tiene cursos.
  if (!ctx.roles.includes("TEACHER")) redirect("/dashboard");

  const [courses, subjects, campuses] = await Promise.all([
    listMyCourses(ctx, { includeArchived: true }),
    listSubjects(ctx),
    ctx.institutionType === "SCHOOL" ? listCampuses(ctx) : Promise.resolve([]),
  ]);

  return (
    <CoursesView
      spaceName={ctx.institutionName}
      courses={courses.map((c) => ({ ...c, archived: !!c.archivedAt, archivedAt: undefined }))}
      subjects={subjects.map(({ id, name }) => ({ id, name }))}
      campuses={campuses.map(({ id, name }) => ({ id, name }))}
      createCourse={createCourseAction}
      updateCourse={updateCourseAction}
      setCourseArchived={setCourseArchivedAction}
    />
  );
}
