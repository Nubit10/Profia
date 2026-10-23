import "server-only";

// API pública del módulo de auditoría (SPEC-0002 RN-10).
export { recordAudit, recordAuditSafely, type AuditAction, type AuditEvent } from "./service";
