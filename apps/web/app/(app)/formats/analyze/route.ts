import { analyzeFormatFile } from "@/modules/formats";
import { MAX_FORMAT_BYTES } from "@/modules/formats/client";
import { requireTenant } from "@/modules/tenancy";
import { errorResponse, readUpload } from "../upload";

// Analiza un formato en Word y devuelve la estructura propuesta; nada se guarda (SPEC-0010 RN-03).
export async function POST(request: Request) {
  const ctx = await requireTenant();
  const upload = await readUpload(request, MAX_FORMAT_BYTES);
  if ("error" in upload) return Response.json({ error: upload.error }, { status: 400 });
  if (!/\.docx$/i.test(upload.file.name)) {
    return Response.json(
      { error: "Sube el formato como documento de Word (.docx)" },
      { status: 400 },
    );
  }
  try {
    return Response.json(await analyzeFormatFile(ctx, upload.data, upload.file.name));
  } catch (error) {
    return errorResponse(error, "format.analyze_failed");
  }
}
