"use client";

import { useEffect, useState } from "react";
import { HiOutlineDocumentText, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { sileo } from "sileo";
import {
  currentOwner,
  downloadSaved,
  lastSynced,
  listSaved,
  type SavedEntry,
} from "@/components/offline/offline-store";
import { formatDateTime } from "@/lib/dates";

const DAY_MS = 24 * 3600 * 1000;

/**
 * SPEC-0013 RN-14 / CA-0013-38: sin señal, los recursos guardados en este dispositivo, por curso,
 * listos para descargar sin ninguna petición a la red.
 */
export function OfflineLibrary() {
  const [state, setState] = useState<{
    owner: string;
    entries: SavedEntry[];
    synced: Date | null;
    stale: boolean;
  } | null>(null);

  // Todo sale del dispositivo, después de pintar (en el servidor la página no sabe nada).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const owner = currentOwner();
      if (!owner) return;
      const entries = await listSaved(owner);
      const synced = lastSynced();
      const stale = !synced || Date.now() - synced.getTime() > DAY_MS;
      if (!cancelled) setState({ owner, entries, synced, stale });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state || state.entries.length === 0) return null;
  const { owner, stale } = state;

  const courses = new Map<string, SavedEntry[]>();
  for (const entry of [...state.entries].sort((a, b) => a.title.localeCompare(b.title, "es"))) {
    courses.set(entry.courseTitle, [...(courses.get(entry.courseTitle) ?? []), entry]);
  }

  return (
    <section aria-labelledby="saved-title" className="flex w-full flex-col gap-4 text-left">
      <h2 id="saved-title" className="text-lg font-extrabold">
        Guardados en este dispositivo
      </h2>
      {stale && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft p-3 text-sm"
        >
          <HiOutlineExclamationTriangle className="mt-0.5 shrink-0 text-warning" aria-hidden />
          Puede que no sea la última versión: no se han actualizado
          {state.synced ? ` desde el ${formatDateTime(state.synced)}` : " todavía"}.
        </p>
      )}
      {[...courses].map(([course, entries]) => (
        <div key={course} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-muted-foreground">{course}</h3>
          <ul className="flex flex-col gap-2" aria-label={`Recursos de ${course}`}>
            {entries.map((entry) => (
              <li
                key={entry.resourceId}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div>
                  <p className="font-semibold">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Guardado el {formatDateTime(entry.savedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entry.files.map((file) => (
                    <button
                      key={file.key}
                      type="button"
                      onClick={() =>
                        downloadSaved(owner, file).catch(() =>
                          sileo.error({ title: "Ese archivo no está guardado" }),
                        )
                      }
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted"
                    >
                      <HiOutlineDocumentText aria-hidden />
                      {file.label} en {file.format === "pdf" ? "PDF" : "Word"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
