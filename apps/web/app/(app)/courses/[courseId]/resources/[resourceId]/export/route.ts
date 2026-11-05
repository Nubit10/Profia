import type { NextRequest } from "next/server";
import { z } from "zod";
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
});

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/courses/[courseId]/resources/[resourceId]/export">,
) {
  const { resourceId } = await ctx.params;
  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return new Response("Parámetros inválidos", { status: 400 });

  const tenant = await requireTenant();
  try {
    return fileResponse(await exportResource(tenant, resourceId, query.data));
  } catch (error) {
    return errorResponse(error, resourceId);
  }
}
