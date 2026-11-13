import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DomainError } from "@/lib/errors";
import {
  deletePiarAction,
  getPiar,
  proposePiarAdjustmentsAction,
  savePiarAction,
} from "@/modules/piar";
import { requireTenant } from "@/modules/tenancy";
import { PrivacyNotice } from "../privacy-notice";
import { PiarEditor } from "./piar-editor";

// SPEC-0017: el título de la pestaña no lleva el nombre del estudiante (queda en el historial).
export const metadata: Metadata = { title: "PIAR", robots: { index: false, follow: false } };

export default async function PiarPage({ params }: PageProps<"/piar/[piarId]">) {
  const { piarId } = await params;
  const ctx = await requireTenant();
  if (!ctx.roles.includes("TEACHER")) redirect("/dashboard");
  const piar = await getPiar(ctx, piarId).catch((error) => {
    // RN-01: un PIAR ajeno o vencido responde igual que uno inexistente.
    if (error instanceof DomainError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code)) notFound();
    throw error;
  });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        back={{ href: "/piar", label: "Tus PIAR" }}
        eyebrow="PIAR · Plan Individual de Ajustes Razonables"
        title={piar.content.student.name}
        description={`${piar.course.title} · Año ${piar.academicYear}`}
      />
      <PrivacyNotice expiresAt={piar.expiresAt} />
      <PiarEditor
        piar={piar}
        actions={{
          save: savePiarAction,
          remove: deletePiarAction,
          propose: proposePiarAdjustmentsAction,
        }}
      />
    </div>
  );
}
