import "server-only";
import { recordAuditSafely } from "@/modules/audit";
import { getResourceForExport, listMyResources } from "@/modules/resources";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "@/modules/resources/client";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { hasAnswerSheet } from "./build-exam";
import type { DocFormat } from "./model";

// SPEC-0013 RN-14 y ADR-0012: qué documentos guarda el dispositivo para usarlos sin conexión. Solo la
// lista: los archivos se bajan uno a uno por la ruta de descarga de siempre (`purpose=offline`).

export type OfflineDoc = "student" | "key" | "answers";

export type OfflineFile = {
  doc: OfflineDoc;
  format: DocFormat;
  /** "Hoja del estudiante", "Clave"… para el botón de la pantalla "Sin conexión". */
  label: string;
  url: string;
};

export type OfflineEntry = {
  resourceId: string;
  courseId: string;
  courseTitle: string;
  title: string;
  type: ResourceType;
  version: number;
  updatedAt: string;
  files: OfflineFile[];
};

const FORMATS: DocFormat[] = ["pdf", "docx"];

/**
 * Recursos del docente en el espacio activo que se pueden descargar (borrador o listo; no archivados
 * ni en generación), en su última versión: hoja y clave (guía del docente en talleres; hoja de
 * respuestas en exámenes que la tienen), en PDF y Word, versión A.
 */
export async function listOfflineLibrary(ctx: TenantContext): Promise<OfflineEntry[]> {
  requireRole(ctx, "TEACHER");
  const resources = (await listMyResources(ctx)).filter(
    (r) => r.status === "DRAFT" || r.status === "READY",
  );
  const entries: OfflineEntry[] = [];
  for (const r of resources) {
    const docs: { doc: OfflineDoc; label: string }[] = [
      {
        doc: "student",
        label: r.type === "WORKSHOP" ? "Guía del estudiante" : "Hoja del estudiante",
      },
      { doc: "key", label: r.type === "WORKSHOP" ? "Guía del docente" : "Clave" },
    ];
    if (r.type === "EXAM") {
      const exam = await getResourceForExport(ctx, r.id).catch(() => null);
      if (exam?.data.type === "EXAM" && hasAnswerSheet(exam.data.content)) {
        docs.push({ doc: "answers", label: "Hoja de respuestas" });
      }
    }
    const base = `/courses/${r.courseId}/resources/${r.id}/export`;
    entries.push({
      resourceId: r.id,
      courseId: r.courseId,
      courseTitle: r.courseTitle,
      title: r.title || `${RESOURCE_TYPE_LABELS[r.type]}: ${r.topicTitle}`,
      type: r.type,
      version: r.version,
      updatedAt: r.updatedAt.toISOString(),
      files: docs.flatMap(({ doc, label }) =>
        FORMATS.map((format) => ({
          doc,
          format,
          label,
          url: `${base}?doc=${doc}&format=${format}&version=${r.version}&variant=A&purpose=offline`,
        })),
      ),
    });
  }
  return entries;
}

/**
 * Las descargas para guardar sin conexión no son descargas del docente: no suman `resource.exported`
 * (no inflan métricas ni cuentan como su primera descarga). Se registra una vez por sincronización.
 */
export async function recordOfflineSync(ctx: TenantContext, files: number) {
  requireRole(ctx, "TEACHER");
  await recordAuditSafely({
    action: "resource.cached_offline",
    institutionId: ctx.institutionId,
    actorUserId: ctx.userId,
    entityType: "offline_library",
    metadata: { files },
  });
}
