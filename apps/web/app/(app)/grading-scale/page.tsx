import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import {
  canEditGradingBands,
  getGradingBands,
  updateGradingBandsAction,
} from "@/modules/institutions";
import { requireTenant } from "@/modules/tenancy";
import { GradingBandsForm } from "./grading-bands-form";

export const metadata: Metadata = { title: "Escala de valoración" };

/** SPEC-0024 RN-04: escala del espacio (SIEE). La lee cualquier miembro; la cambia el administrador. */
export default async function GradingScalePage() {
  const ctx = await requireTenant();
  const bands = await getGradingBands(ctx);
  const school = ctx.institutionType === "SCHOOL";
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Escala de valoración"
        description={
          school
            ? "Los rangos de los desempeños del colegio (SIEE). Las rúbricas de los planes de aula los muestran."
            : "Los rangos de los desempeños con los que calificas. Las rúbricas de tus planes de aula los muestran."
        }
      />
      <GradingBandsForm
        initial={bands}
        canEdit={canEditGradingBands(ctx)}
        save={updateGradingBandsAction}
      />
    </div>
  );
}
