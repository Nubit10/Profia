import "server-only";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { hasRole } from "@/lib/permissions";
import { recordAudit } from "@/modules/audit";
import type { TenantContext } from "@/modules/tenancy";
import { parseGradingBands, type GradingBands } from "./grading-scale";

// Escala de valoración del espacio (SPEC-0024 RN-04, ADR-0019).

/** Quién la cambia: el administrador del colegio o el docente independiente (dueño del espacio). */
export const canEditGradingBands = (ctx: TenantContext) => hasRole(ctx.roles, "ADMIN");

/** Cualquier miembro la lee (la rúbrica de sus planes la muestra). */
export async function getGradingBands(ctx: TenantContext): Promise<GradingBands> {
  const row = await db.institution.findUniqueOrThrow({
    where: { id: ctx.institutionId },
    select: { gradingBands: true },
  });
  return parseGradingBands(row.gradingBands);
}

export async function updateGradingBands(ctx: TenantContext, bands: GradingBands): Promise<void> {
  if (!canEditGradingBands(ctx)) throw forbidden("Solo el administrador puede cambiar la escala.");
  await db.$transaction(async (tx) => {
    await tx.institution.update({
      where: { id: ctx.institutionId },
      data: { gradingBands: bands },
    });
    await recordAudit(tx, {
      action: "institution.grading_bands_updated",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "institution",
      entityId: ctx.institutionId,
      metadata: { min: bands.min, max: bands.max },
    });
  });
}
