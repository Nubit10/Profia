"use client";

import { useLinkStatus } from "next/link";

/**
 * SPEC-0013 CA-0013-27: con mala señal, el enlace tocado muestra al instante que está cargando,
 * aunque la pantalla de destino todavía no se haya precargado. Va dentro de un `<Link>`.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className="ml-auto flex shrink-0 items-center" data-testid="link-pending">
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
      />
      <span className="sr-only">Cargando…</span>
    </span>
  );
}
