import type { NextRequest } from "next/server";
import { z } from "zod";
import { exportBundle } from "@/modules/documents";
import { requireTenant } from "@/modules/tenancy";
import { errorResponse, fileResponse } from "../file-response";

// SPEC-0013 RN-06: hoja, clave y sus versiones en un solo archivo (`.zip` si es más de uno).

const DOCS = ["student", "key", "answers"] as const;

const querySchema = z.object({
  docs: z
    .string()
    .transform((v) => v.split(","))
    .pipe(z.array(z.enum(DOCS)).min(1).max(DOCS.length)),
  format: z.enum(["pdf", "docx"]).default("pdf"),
  variants: z.coerce.number().int().min(1).max(4).default(1),
  version: z.coerce.number().int().min(1).optional(),
});

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/courses/[courseId]/resources/[resourceId]/export/bundle">,
) {
  const { resourceId } = await ctx.params;
  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return new Response("Parámetros inválidos", { status: 400 });

  const tenant = await requireTenant();
  try {
    return fileResponse(await exportBundle(tenant, resourceId, query.data));
  } catch (error) {
    return errorResponse(error, resourceId);
  }
}
