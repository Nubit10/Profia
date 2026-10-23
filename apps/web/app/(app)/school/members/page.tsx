import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  INVITATION_TTL_DAYS,
  createInvitationAction,
  listMembers,
  listPendingInvitations,
  revokeInvitationAction,
  setMemberActiveAction,
  updateMemberRolesAction,
} from "@/modules/institutions";
import { isSchoolAdmin, requireTenant } from "@/modules/tenancy";
import { InvitationsSection } from "./invitations-section";
import { MembersSection } from "./members-section";

export const metadata: Metadata = { title: "Profesores" };

export default async function MembersPage() {
  const ctx = await requireTenant();
  if (!isSchoolAdmin(ctx)) notFound();

  const [members, invitations] = await Promise.all([listMembers(ctx), listPendingInvitations(ctx)]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Profesores</h1>
        <p className="text-muted-foreground">
          Invita a los profesores de {ctx.institutionName} y administra sus roles.
        </p>
      </div>
      <InvitationsSection
        ttlDays={INVITATION_TTL_DAYS}
        invitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          roles: i.roles,
          expiresAt: i.expiresAt.toISOString(),
        }))}
        createInvitation={createInvitationAction}
        revokeInvitation={revokeInvitationAction}
      />
      <MembersSection
        members={members.map((m) => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          roles: m.roles,
          active: m.status === "ACTIVE",
          isSelf: m.isSelf,
        }))}
        updateRoles={updateMemberRolesAction}
        setActive={setMemberActiveAction}
      />
    </div>
  );
}
