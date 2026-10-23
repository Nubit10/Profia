// Resultado de una server action. Sin dependencias de servidor: lo usan también los formularios.
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
