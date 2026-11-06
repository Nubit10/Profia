import type { NextRequest } from "next/server";
import { z } from "zod";
import { getLimiter } from "@/lib/rate-limit";
import { exportResource, VARIANTS } from "@/modules/documents";
import { requireTenant } from "@/modules/tenancy";
import { errorResponse, fileResponse } from "./file-response";

// Descarga de un recurso en DOCX o PDF (SPEC-0009 §5). Se genera al momento desde la versión
// pedida; nada se guarda en disco.

const querySchema = z.object({
  doc: z.enum(["student", "key", "answers"]).default("student"),
  format: z.enum(["pdf", "docx"]).default("pdf"),
  version: z.coerce.number().int().min(1).optional(),
  variant: z.enum(VARIANTS).default("A"),
  /** SPEC-0013 RN-14: el dispositivo guarda el archivo para usarlo sin conexión. */
  purpose: z.enum(["offline"]).optional(),
});

/** ADR-0012: la sincronización baja como máximo 30 archivos por minuto por docente. */
const OFFLINE_PER_MINUTE = 30;

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/courses/[courseId]/resources/[resourceId]/export">,
) {
  const { resourceId } = await ctx.params;
  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return new Response("Parámetros inválidos", { status: 400 });

  const tenant = await requireTenant();
  const { purpose, ...wanted } = query.data;
  const offline = purpose === "offline";
  if (
    offline &&
    !(await getLimiter("offline-sync", OFFLINE_PER_MINUTE, 60_000).consume(tenant.userId)).allowed
  ) {
    return new Response("Demasiadas descargas seguidas", {
      status: 429,
      headers: { "retry-after": "60" },
    });
  }
  try {
    return fileResponse(await exportResource(tenant, resourceId, { ...wanted, offline }));
  } catch (error) {
    return errorResponse(error, resourceId);
  }
}
