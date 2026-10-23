import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { conflict, invalid, notFound, rateLimited } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import { getLimiter } from "@/lib/rate-limit";
import { recordAudit } from "@/modules/audit";
import { requireSchoolAdmin, type TenantContext } from "@/modules/tenancy";

export const INVITATION_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const INVALID = "Esta invitación ya no es válida";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function pendingWhere(now = new Date()) {
  return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

/**
 * Crea una invitación (CA-0002-04). Devuelve el token en claro una única vez; en la base solo
 * queda su hash (RN-05). Una invitación nueva revoca la pendiente para el mismo correo (RN-07).
 */
export async function createInvitation(
  ctx: TenantContext,
  input: { email: string; roles: Role[] },
): Promise<{ token: string; invitationId: string; expiresAt: Date }> {
  requireSchoolAdmin(ctx);
  const limit = await getLimiter("invitation-create", 30, 60 * 60 * 1000).consume(ctx.membershipId);
  if (!limit.allowed) throw rateLimited();

  const email = input.email.trim().toLowerCase();
  const alreadyMember = await db.membership.findFirst({
    where: { institutionId: ctx.institutionId, status: "ACTIVE", user: { email } },
    select: { id: true },
  });
  if (alreadyMember) throw conflict("Esa persona ya es miembro del colegio", "email");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * DAY_MS);

  const invitation = await db.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { institutionId: ctx.institutionId, email, ...pendingWhere() },
      data: { revokedAt: new Date() },
    });
    const created = await tx.invitation.create({
      data: {
        institutionId: ctx.institutionId,
        email,
        roles: [...new Set(input.roles)],
        tokenHash: hashToken(token),
        invitedByMembershipId: ctx.membershipId,
        expiresAt,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: "invitation.created",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "invitation",
      entityId: created.id,
      metadata: { roles: input.roles },
    });
    return created;
  });

  return { token, invitationId: invitation.id, expiresAt };
}

export async function listPendingInvitations(ctx: TenantContext) {
  requireSchoolAdmin(ctx);
  return db.invitation.findMany({
    where: { institutionId: ctx.institutionId, ...pendingWhere() },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, roles: true, expiresAt: true, createdAt: true },
  });
}

export async function revokeInvitation(ctx: TenantContext, invitationId: string) {
  requireSchoolAdmin(ctx);
  await db.$transaction(async (tx) => {
    const { count } = await tx.invitation.updateMany({
      where: { id: invitationId, institutionId: ctx.institutionId, ...pendingWhere() },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw notFound();
    await recordAudit(tx, {
      action: "invitation.revoked",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "invitation",
      entityId: invitationId,
    });
  });
}

export type InvitationPreview =
  | { status: "valid"; institutionName: string; email: string; roles: Role[] }
  | { status: "invalid" };

/** Lo que ve quien abre el enlace. Quien tiene el enlace es el destinatario previsto. */
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      email: true,
      roles: true,
      acceptedAt: true,
      revokedAt: true,
      expiresAt: true,
      institution: { select: { name: true } },
    },
  });
  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.revokedAt ||
    invitation.expiresAt <= new Date()
  ) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    institutionName: invitation.institution.name,
    email: invitation.email,
    roles: invitation.roles,
  };
}

/**
 * Acepta una invitación (CA-0002-05/06). El "claim" es atómico: dos aceptaciones simultáneas
 * del mismo enlace no crean dos membresías.
 */
export async function acceptInvitation(
  user: { id: string; email: string },
  token: string,
): Promise<{ institutionId: string }> {
  const limit = await getLimiter("invitation-accept", 10, 15 * 60 * 1000).consume(user.id);
  if (!limit.allowed) throw rateLimited();

  return db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, institutionId: true, email: true, roles: true },
    });
    if (!invitation) throw invalid(INVALID);
    if (invitation.email !== user.email.toLowerCase()) {
      throw invalid(`Esta invitación es para ${invitation.email}. Inicia sesión con ese correo.`);
    }

    const now = new Date();
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, ...pendingWhere(now) },
      data: { acceptedAt: now, acceptedByUserId: user.id },
    });
    if (claimed.count === 0) throw invalid(INVALID);

    const existing = await tx.membership.findUnique({
      where: { institutionId_userId: { institutionId: invitation.institutionId, userId: user.id } },
      select: { id: true, status: true },
    });
    let membershipId: string;
    if (!existing) {
      const created = await tx.membership.create({
        data: { institutionId: invitation.institutionId, userId: user.id, roles: invitation.roles },
        select: { id: true },
      });
      membershipId = created.id;
    } else {
      membershipId = existing.id;
      if (existing.status === "INACTIVE") {
        await tx.membership.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", roles: invitation.roles },
        });
      }
    }

    await recordAudit(tx, {
      action: "invitation.accepted",
      institutionId: invitation.institutionId,
      actorUserId: user.id,
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { membershipId },
    });
    return { institutionId: invitation.institutionId };
  });
}
