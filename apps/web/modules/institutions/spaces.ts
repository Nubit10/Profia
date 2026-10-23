import "server-only";
import { db, isUniqueViolation, type DbClient } from "@/lib/db";
import { cleanText, normalizeName } from "@/lib/text";
import type { Role } from "@/lib/permissions";
import { recordAudit } from "@/modules/audit";
import { seedPreloadedSubjects } from "@/modules/courses";
import { requireSchoolAdmin, type TenantContext } from "@/modules/tenancy";
import type { registerSchoolSchema, updateSchoolSchema } from "./schemas";
import type { z } from "zod";

type User = { id: string; name: string };

export const MAIN_CAMPUS_NAME = "Sede principal";

async function createCampusAndOwner(
  tx: DbClient,
  institutionId: string,
  userId: string,
  roles: Role[],
) {
  await tx.campus.create({
    data: {
      institutionId,
      name: MAIN_CAMPUS_NAME,
      normalizedName: normalizeName(MAIN_CAMPUS_NAME),
    },
  });
  await tx.membership.create({ data: { institutionId, userId, roles } });
  await seedPreloadedSubjects(tx, institutionId);
}

/**
 * Espacio del docente independiente (CA-0002-02). Sin datos institucionales.
 * Idempotente: un usuario tiene como máximo uno (RN-03).
 */
export async function createIndependentSpace(user: User): Promise<{ institutionId: string }> {
  const existing = await db.institution.findUnique({
    where: { independentOwnerId: user.id },
    select: { id: true },
  });
  if (existing) return { institutionId: existing.id };

  try {
    return await db.$transaction(async (tx) => {
      const institution = await tx.institution.create({
        data: {
          type: "INDEPENDENT",
          name: `Espacio de ${cleanText(user.name)}`,
          independentOwnerId: user.id,
        },
        select: { id: true },
      });
      await createCampusAndOwner(tx, institution.id, user.id, ["ADMIN", "TEACHER"]);
      await recordAudit(tx, {
        action: "institution.created",
        institutionId: institution.id,
        actorUserId: user.id,
        entityType: "institution",
        entityId: institution.id,
        metadata: { type: "INDEPENDENT" },
      });
      return { institutionId: institution.id };
    });
  } catch (error) {
    // Doble clic o dos pestañas: la restricción única decide y devolvemos el existente.
    if (!isUniqueViolation(error)) throw error;
    const space = await db.institution.findUniqueOrThrow({
      where: { independentOwnerId: user.id },
      select: { id: true },
    });
    return { institutionId: space.id };
  }
}

/** Registro de un colegio con sus datos (CA-0002-03). Quien lo registra queda ADMIN. */
export async function registerSchool(
  user: User,
  input: z.output<typeof registerSchoolSchema>,
): Promise<{ institutionId: string }> {
  const { alsoTeaches, ...data } = input;
  return db.$transaction(async (tx) => {
    const institution = await tx.institution.create({
      data: { type: "SCHOOL", ...data, name: cleanText(data.name) },
      select: { id: true },
    });
    const roles: Role[] = alsoTeaches ? ["ADMIN", "TEACHER"] : ["ADMIN"];
    await createCampusAndOwner(tx, institution.id, user.id, roles);
    await recordAudit(tx, {
      action: "institution.created",
      institutionId: institution.id,
      actorUserId: user.id,
      entityType: "institution",
      entityId: institution.id,
      metadata: { type: "SCHOOL", sector: data.sector },
    });
    return { institutionId: institution.id };
  });
}

export async function getSchool(ctx: TenantContext) {
  requireSchoolAdmin(ctx);
  return db.institution.findUniqueOrThrow({
    where: { id: ctx.institutionId },
    select: {
      id: true,
      name: true,
      sector: true,
      daneCode: true,
      nit: true,
      department: true,
      municipality: true,
      calendar: true,
    },
  });
}

export async function updateSchool(ctx: TenantContext, input: z.output<typeof updateSchoolSchema>) {
  requireSchoolAdmin(ctx);
  await db.$transaction(async (tx) => {
    await tx.institution.update({
      where: { id: ctx.institutionId },
      data: {
        ...input,
        name: cleanText(input.name),
        daneCode: input.daneCode ?? null,
        nit: input.nit ?? null,
      },
    });
    await recordAudit(tx, {
      action: "institution.updated",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "institution",
      entityId: ctx.institutionId,
    });
  });
}
