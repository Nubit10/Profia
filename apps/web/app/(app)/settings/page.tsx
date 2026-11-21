import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getAccount } from "@/modules/auth";
import { requireTenant } from "@/modules/tenancy";
import { AccountCard, DisplaySettings, HelpCard, OfflineCard } from "./settings-panels";

export const metadata: Metadata = { title: "Ajustes" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

const ROLE_LABELS: Record<string, string> = { TEACHER: "Docente", ADMIN: "Administrador" };

/** Ajustes: mi cuenta (lo que escribió al registrarse), tamaño de la letra y modo de pantalla. */
export default async function SettingsPage() {
  const ctx = await requireTenant();
  const account = await getAccount(ctx.userId);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Ajustes"
        description="Tu cuenta y cómo se ve ProfIA en este dispositivo."
      />
      <AccountCard
        name={account?.name ?? ctx.userName}
        email={account?.email ?? ctx.userEmail}
        since={account ? dateFormat.format(account.createdAt) : null}
        spaces={ctx.spaces.map((s) => ({
          id: s.institutionId,
          name: s.name,
          kind: s.type === "INDEPENDENT" ? "Docente independiente" : "Colegio",
          roles: s.roles.map((r) => ROLE_LABELS[r] ?? r).join(" · "),
          active: s.institutionId === ctx.institutionId,
        }))}
      />
      <DisplaySettings />
      {ctx.roles.includes("TEACHER") && <OfflineCard />}
      <HelpCard />
    </div>
  );
}
