"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import type { ActionResult } from "@/lib/action-result";
import {
  RESOURCE_TYPE_LABELS,
  type GenerationWatch,
  type WatchedResource,
} from "@/modules/resources/client";

// SPEC-0013 RN-08: el shell avisa cuando un recurso del docente termina de generarse, esté en la
// página que esté. Los ids pendientes viven en el navegador (por cuenta y espacio) para que el aviso
// salga una vez aunque el docente haya cerrado la pestaña mientras se generaba.

const POLL_MS = 5_000;
/** Prefijo de las claves de este aviso en el navegador; se borran al cerrar sesión. */
export const WATCH_STORAGE_PREFIX = "profe:watch:";
const MAX_WATCHED = 20;

export type WatchAction = (input: { ids: string[] }) => Promise<ActionResult<GenerationWatch>>;

/** "Quiz: La recta numérica" → "La recta numérica". */
const shortTitle = (title: string) => title.replace(/^[^:]{1,20}:\s*/, "");

export function finishedMessage(resource: WatchedResource) {
  const label = RESOURCE_TYPE_LABELS[resource.type].toLowerCase();
  const name = shortTitle(resource.title);
  return resource.status === "FAILED"
    ? { title: `No pudimos crear tu ${label}`, description: `«${name}». Ábrelo para reintentar.` }
    : {
        title: `Tu ${label} está listo`,
        description: `«${name}» está listo para revisar.`,
      };
}

function readPending(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writePending(key: string, ids: string[]) {
  try {
    if (ids.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(ids.slice(-MAX_WATCHED)));
  } catch {
    // Sin almacenamiento el aviso funciona igual mientras la pestaña siga abierta.
  }
}

/**
 * Vigila las generaciones del docente. `initial` son las que el servidor vio al pintar el layout
 * (se actualiza con cada `router.refresh()`, p. ej. al pedir un recurso nuevo). Consulta cada 5 s
 * solo mientras haya algo generándose. Devuelve cuántas hay en curso, para el menú.
 */
export function useGenerationWatcher({
  initial,
  storageKey,
  action,
}: {
  initial: string[];
  storageKey: string;
  action: WatchAction;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const initialKey = initial.join(",");
  // Lo que dijo la última consulta, atado a la lista del servidor con la que se hizo: si el layout
  // trae otra lista (p. ej. un recurso nuevo), vale la del servidor hasta la próxima consulta.
  const [polled, setPolled] = useState<{ key: string; count: number } | null>(null);
  const generating = polled?.key === initialKey ? polled.count : initial.length;
  const pending = useRef<string[]>([]);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const check = useCallback(
    async (key: string) => {
      const ids = pending.current;
      const result = await action({ ids }).catch(() => null);
      if (!result?.ok || !result.data) return;
      const { generating: now, finished } = result.data;
      for (const resource of finished) {
        const href = `/courses/${resource.courseId}/resources/${resource.id}`;
        // En la página del recurso ya se ve el resultado: no se repite el aviso.
        if (pathRef.current === href) continue;
        const message = finishedMessage(resource);
        const button = { title: "Abrir", onClick: () => router.push(href) };
        if (resource.status === "FAILED") sileo.error({ ...message, button });
        else sileo.success({ ...message, button });
      }
      const done = new Set(finished.map((r) => r.id));
      pending.current = [
        ...new Set([...ids.filter((id) => !done.has(id)), ...now.map((r) => r.id)]),
      ];
      writePending(storageKey, pending.current);
      setPolled({ key, count: now.length });
    },
    [action, router, storageKey],
  );

  // Al montar y cada vez que el servidor ve generaciones nuevas.
  useEffect(() => {
    const fromServer = initialKey ? initialKey.split(",") : [];
    pending.current = [...new Set([...readPending(storageKey), ...fromServer])];
    writePending(storageKey, pending.current);
    if (pending.current.length > 0) void check(initialKey);
  }, [initialKey, storageKey, check]);

  useEffect(() => {
    if (generating === 0) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void check(initialKey);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(initialKey);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [generating, check, initialKey]);

  return generating;
}
