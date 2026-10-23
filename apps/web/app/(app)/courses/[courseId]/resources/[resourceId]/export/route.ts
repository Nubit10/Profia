import type { NextRequest } from "next/server";
import { z } from "zod";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { exportResource, VARIANTS } from "@/modules/documents";
import { requireTenant } from "@/modules/tenancy";

// Descarga de un recurso en DOCX o PDF (SPEC-0009 §5). Se genera al momento desde la versión
// pedida; nada se guarda en disco.

const querySchema = z.object({
  doc: z.enum(["student", "key", "answers"]).default("student"),
  format: z.enum(["pdf", "docx"]).default("pdf"),
  version: z.coerce.number().int().min(1).optional(),
  variant: z.enum(VARIANTS).default("A"),
});

const STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 404,
  CONFLICT: 409,
  INVALID: 400,
};

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/courses/[courseId]/resources/[resourceId]/export">,
) {
  const { resourceId } = await ctx.params;
  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return new Response("Parámetros inválidos", { status: 400 });

  const tenant = await requireTenant();
  try {
    const file = await exportResource(tenant, resourceId, query.data);
    // RFC 6266/5987: nombre con tildes y "°" para navegadores modernos, y uno ASCII de respaldo.
    const ascii = file.filename.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
    return new Response(new Uint8Array(file.body), {
      headers: {
        "content-type": file.contentType,
        "content-disposition": `attachment; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      // CA-0009-06: un recurso ajeno responde 404, igual que uno inexistente.
      return new Response(error.code === "FORBIDDEN" ? "No encontrado" : error.message, {
        status: STATUS[error.code] ?? 400,
      });
    }
    logger.error("document.export_failed", { resourceId, error });
    return new Response("No pudimos generar el documento", { status: 500 });
  }
}
