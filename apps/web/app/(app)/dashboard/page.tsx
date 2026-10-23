import type { Metadata } from "next";
import { dismissTutorialAction, hasDismissedTutorial } from "@/modules/auth";
import { createCourseAction, listSubjects } from "@/modules/courses";
import { listCampuses } from "@/modules/institutions";
import { getTeacherHome } from "@/modules/resources";
import { isSchoolAdmin, requireTenant } from "@/modules/tenancy";
import { AdminHome } from "./admin-home";
import { TeacherHomeView } from "./teacher-home";

export const metadata: Metadata = { title: "Inicio" };

/** Inicio (SPEC-0012): saludo, siguiente paso calculado en el servidor (RN-02) y accesos rápidos. */
export default async function DashboardPage() {
  const ctx = await requireTenant();

  // CA-0003-07: un administrador que no da clases no tiene "Mis cursos".
  if (!ctx.roles.includes("TEACHER")) {
    return <AdminHome spaceName={ctx.institutionName} canManage={isSchoolAdmin(ctx)} />;
  }

  const [home, tutorialDismissed, subjects, campuses] = await Promise.all([
    getTeacherHome(ctx),
    hasDismissedTutorial(ctx.userId),
    listSubjects(ctx),
    ctx.institutionType === "SCHOOL" ? listCampuses(ctx) : Promise.resolve([]),
  ]);

  return (
    <TeacherHomeView
      userName={ctx.userName}
      spaceName={ctx.institutionName}
      home={home}
      showTutorial={!tutorialDismissed}
      subjects={subjects.map(({ id, name }) => ({ id, name }))}
      campuses={campuses.map(({ id, name }) => ({ id, name }))}
      createCourse={createCourseAction}
      dismissTutorial={dismissTutorialAction}
    />
  );
}
