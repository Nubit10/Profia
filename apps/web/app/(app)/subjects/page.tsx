import type { Metadata } from "next";
import { createSubjectAction, listSubjects, setSubjectArchivedAction } from "@/modules/courses";
import { requireTenant } from "@/modules/tenancy";
import { SubjectsView } from "./subjects-view";

export const metadata: Metadata = { title: "Asignaturas" };

export default async function SubjectsPage() {
  const ctx = await requireTenant();
  const subjects = await listSubjects(ctx, { includeArchived: true });

  return (
    <SubjectsView
      subjects={subjects.map((s) => ({
        id: s.id,
        name: s.name,
        isPreloaded: s.isPreloaded,
        archived: !!s.archivedAt,
      }))}
      canArchive={ctx.roles.includes("ADMIN")}
      createSubject={createSubjectAction}
      setSubjectArchived={setSubjectArchivedAction}
    />
  );
}
