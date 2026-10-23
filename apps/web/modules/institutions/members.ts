import "server-only";
import { db, type Prisma } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import { recordAudit } from "@/modules/audit";
import { requireSchoolAdmin, type TenantContext } from "@/modules/tenancy";

const LAST_ADMIN = "El colegio necesita al menos un administrador";

export async function listMembers(ctx: TenantContext) {
  requireSchoolAdmin(ctx);
  const members = await db.membership.findMany({
    where: { institutionId: ctx.institutionId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      roles: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  return members.map((m) => ({ ...m, isSelf: m.id === ctx.membershipId }));
}

/**
 * Bloquea las membresías del colegio y verifica que, tras el cambio, quede al menos un ADMIN
 * activo (RN-01). El bloqueo evita que dos admins se quiten el rol al mismo tiempo (CA-0002-10).
 */
async function assertAdminRemains(
  tx: Prisma.TransactionClient,
  institutionId: string,
  membershipId: string,
  next: { roles: Role[]; active: boolean },
) {
  await tx.$queryRaw`SELECT id FROM memberships WHERE "institutionId" = ${institutionId} FOR UPDATE`;
  if (next.active && next.roles.includes("ADMIN")) return;
  const otherAdmins = await tx.membership.count({
    where: {
      institutionId,
      status: "ACTIVE",
      roles: { has: "ADMIN" },
      id: { not: membershipId },
    },
  });
  if (otherAdmins === 0) throw conflict(LAST_ADMIN);
}

async function findMember(tx: Prisma.TransactionClient, ctx: TenantContext, membershipId: string) {
  const member = await tx.membership.findFirst({
    where: { id: membershipId, institutionId: ctx.institutionId },
    select: { id: true, roles: true, status: true },
  });
  if (!member) throw notFound();
  return member;
}

export async function updateMemberRoles(ctx: TenantContext, membershipId: string, roles: Role[]) {
  requireSchoolAdmin(ctx);
  const nextRoles = [...new Set(roles)];
  await db.$transaction(async (tx) => {
    const member = await findMember(tx, ctx, membershipId);
    await assertAdminRemains(tx, ctx.institutionId, membershipId, {
      roles: nextRoles,
      active: member.status === "ACTIVE",
    });
    await tx.membership.update({ where: { id: membershipId }, data: { roles: nextRoles } });
    await recordAudit(tx, {
      action: "membership.roles_changed",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "membership",
      entityId: membershipId,
      metadata: { from: member.roles, to: nextRoles },
    });
  });
}

export async function setMemberActive(ctx: TenantContext, membershipId: string, active: boolean) {
  requireSchoolAdmin(ctx);
  await db.$transaction(async (tx) => {
    const member = await findMember(tx, ctx, membershipId);
    if ((member.status === "ACTIVE") === active) return;
    await assertAdminRemains(tx, ctx.institutionId, membershipId, { roles: member.roles, active });
    await tx.membership.update({
      where: { id: membershipId },
      data: { status: active ? "ACTIVE" : "INACTIVE" },
    });
    await recordAudit(tx, {
      action: active ? "membership.reactivated" : "membership.deactivated",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "membership",
      entityId: membershipId,
    });
  });
}
