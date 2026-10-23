import "server-only";
import { db, isUniqueViolation } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { cleanText, normalizeName } from "@/lib/text";
import { recordAudit } from "@/modules/audit";
import { requireSchoolAdmin, type TenantContext } from "@/modules/tenancy";

const DUPLICATE = "Ya existe una sede con ese nombre";

/** Sedes del espacio activo. Cualquier miembro las lee (para elegir sede en un curso). */
export async function listCampuses(ctx: TenantContext, opts: { includeArchived?: boolean } = {}) {
  return db.campus.findMany({
    where: {
      institutionId: ctx.institutionId,
      ...(opts.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    select: { id: true, name: true, archivedAt: true },
  });
}

export async function createCampus(ctx: TenantContext, name: string) {
  requireSchoolAdmin(ctx);
  try {
    return await db.$transaction(async (tx) => {
      const campus = await tx.campus.create({
        data: {
          institutionId: ctx.institutionId,
          name: cleanText(name),
          normalizedName: normalizeName(name),
        },
        select: { id: true },
      });
      await recordAudit(tx, {
        action: "campus.created",
        institutionId: ctx.institutionId,
        actorUserId: ctx.userId,
        entityType: "campus",
        entityId: campus.id,
      });
      return campus;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(DUPLICATE, "name");
    throw error;
  }
}

export async function renameCampus(ctx: TenantContext, campusId: string, name: string) {
  requireSchoolAdmin(ctx);
  try {
    await db.$transaction(async (tx) => {
      const { count } = await tx.campus.updateMany({
        where: { id: campusId, institutionId: ctx.institutionId },
        data: { name: cleanText(name), normalizedName: normalizeName(name) },
      });
      if (count === 0) throw notFound();
      await recordAudit(tx, {
        action: "campus.updated",
        institutionId: ctx.institutionId,
        actorUserId: ctx.userId,
        entityType: "campus",
        entityId: campusId,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(DUPLICATE, "name");
    throw error;
  }
}

/** Archivar o desarchivar. El colegio conserva siempre al menos una sede activa (RN-11). */
export async function setCampusArchived(ctx: TenantContext, campusId: string, archived: boolean) {
  requireSchoolAdmin(ctx);
  await db.$transaction(async (tx) => {
    // Bloquea las sedes del colegio para que dos archivados simultáneos no dejen cero activas.
    await tx.$queryRaw`SELECT id FROM campuses WHERE "institutionId" = ${ctx.institutionId} FOR UPDATE`;

    const campus = await tx.campus.findFirst({
      where: { id: campusId, institutionId: ctx.institutionId },
      select: { archivedAt: true },
    });
    if (!campus) throw notFound();
    if (archived === !!campus.archivedAt) return;

    if (archived) {
      const othersActive = await tx.campus.count({
        where: { institutionId: ctx.institutionId, archivedAt: null, id: { not: campusId } },
      });
      if (othersActive === 0) throw conflict("El colegio necesita al menos una sede activa");
    }
    await tx.campus.update({
      where: { id: campusId },
      data: { archivedAt: archived ? new Date() : null },
    });
    await recordAudit(tx, {
      action: archived ? "campus.archived" : "campus.unarchived",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "campus",
      entityId: campusId,
    });
  });
}
