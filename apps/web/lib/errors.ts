// Errores de dominio que las server actions convierten en respuestas para el usuario.
// NOT_FOUND también se usa para recursos de otro espacio: no se revela que existen (ADR-0004).

export type DomainErrorCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INVALID" | "RATE_LIMITED";

export class DomainError extends Error {
  override name = "DomainError";

  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

export const notFound = (message = "No encontrado") => new DomainError("NOT_FOUND", message);
export const forbidden = (message = "No tienes permiso para esta acción") =>
  new DomainError("FORBIDDEN", message);
export const conflict = (message: string, field?: string) =>
  new DomainError("CONFLICT", message, field);
export const invalid = (message: string, field?: string) =>
  new DomainError("INVALID", message, field);
export const rateLimited = (message = "Demasiados intentos. Intenta de nuevo en unos minutos.") =>
  new DomainError("RATE_LIMITED", message);
