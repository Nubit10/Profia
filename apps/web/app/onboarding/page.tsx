import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfeLogo } from "@/components/brand/profe-logo";
import { requireUser } from "@/modules/auth";
import { createIndependentSpaceAction, registerSchoolAction } from "@/modules/institutions";
import { getTenantContext } from "@/modules/tenancy";
import { OnboardingView } from "./onboarding-view";

export const metadata: Metadata = { title: "Empecemos" };

// CA-0002-01: quien no tiene espacio llega aquí; quien ya tiene uno pasa al inicio.
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  if (await getTenantContext()) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center gap-8 bg-hero px-4 py-12">
      <Link href="/" aria-label="Profe, inicio">
        <ProfeLogo />
      </Link>
      <OnboardingView
        userName={user.name}
        createIndependentSpace={createIndependentSpaceAction}
        registerSchool={registerSchoolAction}
      />
    </main>
  );
}
