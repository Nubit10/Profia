"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { forbidden } from "@/lib/errors";
import { getCurrentUser } from "@/modules/auth";
import { requireTenant, setActiveSpaceCookie } from "@/modules/tenancy";
import { createCampus, renameCampus, setCampusArchived } from "./campuses";
import { acceptInvitation, createInvitation, revokeInvitation } from "./invitations";
import { setMemberActive, updateMemberRoles } from "./members";
import {
  campusArchiveSchema,
  campusNameSchema,
  invitationIdSchema,
  invitationSchema,
  invitationTokenSchema,
  memberRolesSchema,
  memberStatusSchema,
  registerSchoolSchema,
  renameCampusSchema,
  updateSchoolSchema,
} from "./schemas";
import { createIndependentSpace, registerSchool, updateSchool } from "./spaces";

async function requireSessionUser() {
  const user = await getCurrentUser();
  if (!user) throw forbidden("Tu sesión terminó. Inicia sesión de nuevo.");
  return user;
}

// ---------- Onboarding ----------

export async function createIndependentSpaceAction(): Promise<ActionResult> {
  return runAction("create_independent_space", z.object({}), {}, async () => {
    const user = await requireSessionUser();
    const { institutionId } = await createIndependentSpace(user);
    await setActiveSpaceCookie(institutionId);
  });
}

export async function registerSchoolAction(input: unknown): Promise<ActionResult> {
  return runAction("register_school", registerSchoolSchema, input, async (data) => {
    const user = await requireSessionUser();
    const { institutionId } = await registerSchool(user, data);
    await setActiveSpaceCookie(institutionId);
  });
}

export async function acceptInvitationAction(input: unknown): Promise<ActionResult> {
  return runAction("accept_invitation", invitationTokenSchema, input, async ({ token }) => {
    const user = await requireSessionUser();
    const { institutionId } = await acceptInvitation(user, token);
    await setActiveSpaceCookie(institutionId);
  });
}

// ---------- Colegio ----------

export async function updateSchoolAction(input: unknown): Promise<ActionResult> {
  return runAction("update_school", updateSchoolSchema, input, async (data) =>
    updateSchool(await requireTenant(), data),
  );
}

export async function createCampusAction(input: unknown): Promise<ActionResult> {
  return runAction("create_campus", campusNameSchema, input, async ({ name }) => {
    await createCampus(await requireTenant(), name);
  });
}

export async function renameCampusAction(input: unknown): Promise<ActionResult> {
  return runAction("rename_campus", renameCampusSchema, input, async ({ campusId, name }) =>
    renameCampus(await requireTenant(), campusId, name),
  );
}

export async function setCampusArchivedAction(input: unknown): Promise<ActionResult> {
  return runAction("archive_campus", campusArchiveSchema, input, async ({ campusId, archived }) =>
    setCampusArchived(await requireTenant(), campusId, archived),
  );
}

// ---------- Invitaciones y miembros ----------

export async function createInvitationAction(
  input: unknown,
): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  return runAction("create_invitation", invitationSchema, input, async (data) => {
    const { token, expiresAt } = await createInvitation(await requireTenant(), data);
    return { token, expiresAt: expiresAt.toISOString() };
  });
}

export async function revokeInvitationAction(input: unknown): Promise<ActionResult> {
  return runAction("revoke_invitation", invitationIdSchema, input, async ({ invitationId }) =>
    revokeInvitation(await requireTenant(), invitationId),
  );
}

export async function updateMemberRolesAction(input: unknown): Promise<ActionResult> {
  return runAction("update_member_roles", memberRolesSchema, input, async (data) =>
    updateMemberRoles(await requireTenant(), data.membershipId, data.roles),
  );
}

export async function setMemberActiveAction(input: unknown): Promise<ActionResult> {
  return runAction("set_member_active", memberStatusSchema, input, async (data) =>
    setMemberActive(await requireTenant(), data.membershipId, data.active),
  );
}
