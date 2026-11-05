import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import type { ExportedFile } from "@/modules/documents";

// Respuesta común de las descargas de un recurso (SPEC-0009 §5, SPEC-0013 RN-06).

const STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 404,
  CONFLICT: 409,
  INVALID: 400,
};

/** RFC 6266/5987: nombre con tildes y "°" para navegadores modernos, y uno ASCII de respaldo. */
export function fileResponse(file: ExportedFile) {
  const ascii = file.filename.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
  return new Response(new Uint8Array(file.body), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function errorResponse(error: unknown, resourceId: string) {
  if (error instanceof DomainError) {
    // CA-0009-06: un recurso ajeno responde 404, igual que uno inexistente.
    return new Response(error.code === "FORBIDDEN" ? "No encontrado" : error.message, {
      status: STATUS[error.code] ?? 400,
    });
  }
  logger.error("document.export_failed", { resourceId, error });
  return new Response("No pudimos preparar la descarga", { status: 500 });
}
