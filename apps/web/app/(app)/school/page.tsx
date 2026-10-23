import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  createCampusAction,
  getSchool,
  listCampuses,
  renameCampusAction,
  setCampusArchivedAction,
  updateSchoolAction,
} from "@/modules/institutions";
import { isSchoolAdmin, requireTenant } from "@/modules/tenancy";
import { CampusesSection } from "./campuses-section";
import { SchoolDetails } from "./school-details";

export const metadata: Metadata = { title: "Colegio" };

export default async function SchoolPage() {
  const ctx = await requireTenant();
  if (!isSchoolAdmin(ctx)) notFound();

  const [school, campuses] = await Promise.all([
    getSchool(ctx),
    listCampuses(ctx, { includeArchived: true }),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Datos y sedes</h1>
        <p className="text-muted-foreground">Los datos de tu colegio y sus sedes.</p>
      </div>
      <SchoolDetails
        defaultValues={{
          name: school.name,
          sector: school.sector ?? undefined,
          daneCode: school.daneCode ?? "",
          department: school.department ?? "",
          municipality: school.municipality ?? "",
          calendar: school.calendar ?? "A",
          nit: school.nit ?? "",
        }}
        action={updateSchoolAction}
      />
      <CampusesSection
        campuses={campuses.map((c) => ({ id: c.id, name: c.name, archived: !!c.archivedAt }))}
        createCampus={createCampusAction}
        renameCampus={renameCampusAction}
        setCampusArchived={setCampusArchivedAction}
      />
    </div>
  );
}
