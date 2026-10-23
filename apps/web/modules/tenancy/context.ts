import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { hasRole, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/modules/auth";

export const ACTIVE_SPACE_COOKIE = "profe_active_space";

export type SpaceType = "INDEPENDENT" | "SCHOOL";

export type SpaceSummary = {
  institutionId: string;
  membershipId: string;
  name: string;
  type: SpaceType;
  roles: Role[];
};

/** Contexto de tenant construido en el servidor (ADR-0004). Nunca viene del cliente. */
export type TenantContext = {
  userId: string;
  userName: string;
  userEmail: string;
  institutionId: string;
  institutionName: string;
  institutionType: SpaceType;
  membershipId: string;
  roles: Role[];
  /** Espacios activos del usuario, para el selector. */
  spaces: SpaceSummary[];
};

/** Membresías activas del usuario, leídas de la base en cada request (SPEC-0002 RN-09). */
export async function listActiveSpaces(userId: string): Promise<SpaceSummary[]> {
  const memberships = await db.membership.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      roles: true,
      institution: { select: { id: true, name: true, type: true } },
    },
  });
  return memberships
    .filter((m) => m.roles.length > 0)
    .map((m) => ({
      institutionId: m.institution.id,
      membershipId: m.id,
      name: m.institution.name,
      type: m.institution.type,
      roles: m.roles,
    }));
}

/** RN-04: la preferencia (cookie) solo vale si el usuario tiene membresía activa en ese espacio. */
export function pickActiveSpace(
  spaces: SpaceSummary[],
  preferredInstitutionId: string | undefined,
): SpaceSummary | null {
  return spaces.find((s) => s.institutionId === preferredInstitutionId) ?? spaces[0] ?? null;
}

/** Construye el contexto para un usuario. La usan las páginas (vía cookie) y los tests. */
export async function resolveTenantContext(
  user: { id: string; name: string; email: string },
  preferredInstitutionId?: string,
): Promise<TenantContext | null> {
  const spaces = await listActiveSpaces(user.id);
  const active = pickActiveSpace(spaces, preferredInstitutionId);
  if (!active) return null;
  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    institutionId: active.institutionId,
    institutionName: active.name,
    institutionType: active.type,
    membershipId: active.membershipId,
    roles: active.roles,
    spaces,
  };
}

/** Contexto de la request actual, o null si no hay sesión o el usuario no tiene espacios. */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const preferred = (await cookies()).get(ACTIVE_SPACE_COOKIE)?.value;
  return resolveTenantContext(user, preferred);
});

/** Exige sesión y un espacio activo. Sin espacio, lleva al onboarding (CA-0002-01). */
export async function requireTenant(): Promise<TenantContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await getTenantContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

export function requireRole(ctx: TenantContext, role: Role): void {
  if (!hasRole(ctx.roles, role)) throw forbidden();
}

/** Acciones de administración que solo existen en colegios: sedes, invitaciones, miembros. */
export function requireSchoolAdmin(ctx: TenantContext): void {
  if (ctx.institutionType !== "SCHOOL" || !hasRole(ctx.roles, "ADMIN")) throw forbidden();
}

export function isSchoolAdmin(ctx: TenantContext): boolean {
  return ctx.institutionType === "SCHOOL" && hasRole(ctx.roles, "ADMIN");
}
