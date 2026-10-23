import "server-only";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";

// Utilidades de los route handlers de subida (SPEC-0010). Los archivos se procesan en memoria y no
// se guardan (RN-03).

export const STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INVALID: 400,
  RATE_LIMITED: 429,
};

/** Lee el campo `file` de un formulario multipart con un tope de tamaño. */
export async function readUpload(request: Request, maxBytes: number) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes + 64 * 1024) return { error: "El archivo es demasiado grande" } as const;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return { error: "Falta el archivo" } as const;
  if (file.size > maxBytes) return { error: "El archivo es demasiado grande" } as const;
  return { file, data: Buffer.from(await file.arrayBuffer()) } as const;
}

export function errorResponse(error: unknown, event: string) {
  if (error instanceof DomainError) {
    return Response.json({ error: error.message }, { status: STATUS[error.code] ?? 400 });
  }
  logger.error(event, { error });
  return Response.json({ error: "No pudimos procesar el archivo" }, { status: 500 });
}
