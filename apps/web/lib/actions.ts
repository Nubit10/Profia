import "server-only";
import { z } from "zod";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import type { ActionResult } from "@/lib/action-result";

export type { ActionResult } from "@/lib/action-result";

const UNEXPECTED_ERROR = "No pudimos completar la operación. Intenta de nuevo.";

/**
 * Ejecuta una server action: valida la entrada con el schema y traduce errores de dominio
 * a un ActionResult. Los errores inesperados se registran y se devuelve un mensaje genérico.
 */
export async function runAction<S extends z.ZodType, T = void>(
  name: string,
  schema: S,
  input: unknown,
  handler: (data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del formulario",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }
  try {
    const data = await handler(parsed.data);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        ok: false,
        error: error.message,
        ...(error.field ? { fieldErrors: { [error.field]: [error.message] } } : {}),
      };
    }
    // redirect() y notFound() de Next se propagan.
    if (isNextControlFlow(error)) throw error;
    logger.error(`action.${name}.unexpected_error`, { error });
    return { ok: false, error: UNEXPECTED_ERROR };
  }
}

function isNextControlFlow(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    /^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND)/.test(digest)
  );
}
