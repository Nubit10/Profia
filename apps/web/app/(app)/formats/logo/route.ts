import { getLogo, saveLogo } from "@/modules/formats";
import { MAX_LOGO_BYTES } from "@/modules/formats/client";
import { requireTenant } from "@/modules/tenancy";
import { errorResponse, readUpload } from "../upload";

// Logo de la institución (SPEC-0010 RN-09, ADR-0010): subirlo y verlo. No hay URL pública: solo
// quien tiene sesión en el espacio lo ve.

export async function GET() {
  const ctx = await requireTenant();
  const logo = await getLogo(ctx);
  if (!logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "content-type": logo.mimeType,
      "cache-control": "private, no-cache",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}

export async function POST(request: Request) {
  const ctx = await requireTenant();
  const upload = await readUpload(request, MAX_LOGO_BYTES);
  if ("error" in upload) return Response.json({ error: upload.error }, { status: 400 });
  try {
    return Response.json(await saveLogo(ctx, upload.data));
  } catch (error) {
    return errorResponse(error, "logo.upload_failed");
  }
}
