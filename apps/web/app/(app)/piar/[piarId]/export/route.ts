import type { NextRequest } from "next/server";
import { z } from "zod";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { exportPiar } from "@/modules/documents";
import { requireTenant } from "@/modules/tenancy";

// SPEC-0017 T5: descarga del PIAR en Word o PDF. Solo el docente que lo creó (RN-01): lo ajeno
// responde 404, igual que lo inexistente.

const querySchema = z.object({ format: z.enum(["pdf", "docx"]).default("pdf") });

export async function GET(request: NextRequest, ctx: RouteContext<"/piar/[piarId]/export">) {
  const { piarId } = await ctx.params;
  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return new Response("Parámetros inválidos", { status: 400 });
  const tenant = await requireTenant();
  try {
    const file = await exportPiar(tenant, piarId, query.data.format);
    const ascii = file.filename.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
    return new Response(new Uint8Array(file.body), {
      headers: {
        "content-type": file.contentType,
        "content-disposition": `attachment; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        // Datos de un menor: nunca en cachés intermedias ni del navegador (ADR-0015).
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      const status = error.code === "NOT_FOUND" || error.code === "FORBIDDEN" ? 404 : 409;
      return new Response(status === 404 ? "No encontrado" : error.message, { status });
    }
    logger.error("piar.export_failed", { piarId, error });
    return new Response("No pudimos preparar la descarga", { status: 500 });
  }
}
