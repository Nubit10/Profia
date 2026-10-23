import "server-only";
import { db, type DbClient } from "@/lib/db";
import { logger, redact } from "@/lib/observability/logger";

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "institution.created"
  | "institution.updated"
  | "campus.created"
  | "campus.updated"
  | "campus.archived"
  | "campus.unarchived"
  | "invitation.created"
  | "invitation.revoked"
  | "invitation.accepted"
  | "membership.roles_changed"
  | "membership.deactivated"
  | "membership.reactivated"
  | "subject.created"
  | "subject.area_linked"
  | "subject.archived"
  | "subject.unarchived"
  | "course.created"
  | "course.updated"
  | "course.archived"
  | "course.unarchived"
  | "course_periods.updated"
  | "unit.created"
  | "unit.updated"
  | "unit.moved"
  | "unit.archived"
  | "unit.unarchived"
  | "topic.created"
  | "topic.updated"
  | "topic.moved"
  | "topic.archived"
  | "topic.unarchived"
  | "objective.created"
  | "objective.updated"
  | "objective.moved"
  | "objective.archived"
  | "objective.unarchived"
  | "planning.copied"
  | "ai.objectives_suggested"
  | "ai.suggestion_accepted"
  | "ai.suggestion_discarded"
  | "resource.generation_requested"
  | "resource.edited"
  | "resource.ready"
  | "resource.reopened"
  | "resource.archived"
  | "resource.restored"
  | "resource.duplicated"
  | "resource.item_regenerated"
  | "resource.exported"
  | "resource.grading_scale_updated"
  | "format.created"
  | "format.updated"
  | "format.deleted"
  | "logo.updated";

export type AuditEvent = {
  action: AuditAction;
  institutionId?: string | null;
  actorUserId?: string | null;
  entityType: string;
  entityId?: string | null;
  /** Solo IDs y valores no sensibles; se redacta igual por seguridad (RN-10). */
  metadata?: Record<string, unknown>;
};

/**
 * Registra un evento. Pasa el cliente de la transacción de la acción auditada para que
 * ambos se confirmen o se reviertan juntos (SPEC-0002 RN-10, CA-0002-12).
 */
export async function recordAudit(client: DbClient, event: AuditEvent): Promise<void> {
  await client.auditLog.create({
    data: {
      action: event.action,
      institutionId: event.institutionId ?? null,
      actorUserId: event.actorUserId ?? null,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      metadata: event.metadata ? (redact(event.metadata) as object) : undefined,
    },
  });
}

/** Para eventos sin transacción propia (login/logout): nunca rompe el flujo principal. */
export async function recordAuditSafely(event: AuditEvent): Promise<void> {
  try {
    await recordAudit(db, event);
  } catch (error) {
    // La auditoría de autenticación no debe impedir iniciar o cerrar sesión, pero sí se reporta.
    logger.warn("audit.record_failed", { action: event.action, error });
  }
}
