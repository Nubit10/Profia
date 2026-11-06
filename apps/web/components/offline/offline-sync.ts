"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { ActionResult } from "@/lib/action-result";
import type { OfflineEntry } from "@/modules/documents/client";
import {
  cacheName,
  claimOwner,
  fileKey,
  listSaved,
  markSynced,
  offlinePreference,
  putSaved,
  removeSaved,
  setOfflinePreference,
  type SavedEntry,
} from "./offline-store";

// SPEC-0013 RN-14: con Profe abierto y con señal, baja lo que falta o cambió de a un archivo y borra
// lo archivado. Corre en la página (no en segundo plano del navegador: no existe en Safari).

export type OfflineActions = {
  library: () => Promise<ActionResult<{ institutionId: string; entries: OfflineEntry[] }>>;
  recordSync: (input: { files: number }) => Promise<ActionResult>;
};

type OfflineState = {
  /** Recurso → versión guardada en este dispositivo. */
  saved: Record<string, number>;
  /** Cuántos recursos tiene el docente en el espacio activo (según el servidor). */
  total: number;
  syncing: boolean;
  enabled: boolean;
  /** La pidió el docente aunque el navegador tenga activo el ahorro de datos. */
  forced: boolean;
};

export const useOfflineState = create<OfflineState>(() => ({
  saved: {},
  total: 0,
  syncing: false,
  enabled: false,
  forced: false,
}));

/** Pausa entre archivos: el servidor deja bajar 30 por minuto (ADR-0012). */
const PAUSE_MS = 2_100;
const RESYNC_MS = 5 * 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** `filename*=UTF-8''…` de la respuesta (el nombre de SPEC-0009, con tildes). */
function filenameOf(response: Response, fallback: string) {
  const header = response.headers.get("content-disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (star) return decodeURIComponent(star);
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? fallback;
}

function standalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function refreshSaved(owner: string) {
  const entries = await listSaved(owner);
  useOfflineState.setState({
    saved: Object.fromEntries(entries.map((e) => [e.resourceId, e.version])),
  });
  return entries;
}

let running = false;

async function sync(owner: string, spaceIds: string[], actions: OfflineActions) {
  if (running || !navigator.onLine) return;
  const { forced } = useOfflineState.getState();
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    ?.saveData;
  if (saveData && !forced) return;
  running = true;
  useOfflineState.setState({ syncing: true });
  let downloaded = 0;
  try {
    const result = await actions.library();
    if (!result.ok || !result.data) return;
    const { institutionId, entries } = result.data;
    useOfflineState.setState({ total: entries.length });
    // Se pide que el navegador no borre esto por falta de espacio, si lo permite.
    await navigator.storage?.persist?.().catch(() => false);

    const saved = await listSaved(owner);
    const wanted = new Set(entries.map((e) => e.resourceId));
    // Archivados, borrados o de un espacio al que ya no pertenece: se quitan del dispositivo.
    for (const entry of saved) {
      const gone =
        !spaceIds.includes(entry.institutionId) ||
        (entry.institutionId === institutionId && !wanted.has(entry.resourceId));
      if (gone) await removeSaved(owner, entry);
    }

    const cache = await caches.open(cacheName(owner));
    // Los más recientes primero: si falta espacio, quedan guardados los que más se usan.
    const ordered = [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const entry of ordered) {
      const previous = saved.find((s) => s.resourceId === entry.resourceId);
      if (previous && previous.version === entry.version && previous.owner === owner) continue;
      const files = [];
      for (const file of entry.files) {
        const response = await fetch(file.url, { credentials: "same-origin" });
        if (response.status === 429) return; // límite del servidor: sigue en la próxima visita
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const key = fileKey(entry.resourceId, entry.version, file.doc, file.format);
        const fallback = `${entry.title}.${file.format}`;
        const filename = filenameOf(response, fallback);
        await cache.put(key, response);
        files.push({ doc: file.doc, format: file.format, label: file.label, filename, key });
        downloaded += 1;
        await sleep(PAUSE_MS);
      }
      if (previous) await removeSaved(owner, previous);
      const record: SavedEntry = {
        ...entry,
        files,
        owner,
        institutionId,
        savedAt: new Date().toISOString(),
      };
      await putSaved(record);
      useOfflineState.setState((s) => ({
        saved: { ...s.saved, [entry.resourceId]: entry.version },
      }));
    }
    markSynced();
  } catch {
    // Sin señal, sin espacio o un archivo que falló: se reintenta en la próxima sincronización.
  } finally {
    running = false;
    useOfflineState.setState({ syncing: false });
    if (downloaded > 0) await actions.recordSync({ files: downloaded }).catch(() => undefined);
  }
}

/**
 * Mantiene la biblioteca sin conexión del docente al día. En la app instalada viene encendida; en
 * el navegador espera a que el docente acepte (RN-14). Va en el shell del área de trabajo.
 */
export function useOfflineSync({
  userId,
  spaceIds,
  actions,
}: {
  userId: string;
  spaceIds: string[];
  actions: OfflineActions;
}) {
  const spacesKey = spaceIds.join(",");
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const spaces = spacesKey.split(",");

    const start = async () => {
      await claimOwner(userId);
      if (offlinePreference() === null && standalone()) setOfflinePreference("on");
      const enabled = offlinePreference() === "on";
      useOfflineState.setState({ enabled });
      await refreshSaved(userId);
      if (!enabled || cancelled) return;
      void sync(userId, spaces, actions);
      timer = setInterval(() => void sync(userId, spaces, actions), RESYNC_MS);
    };
    void start();

    const onOnline = () => {
      if (useOfflineState.getState().enabled) void sync(userId, spaces, actions);
    };
    const onPreference = () => {
      clearInterval(timer);
      void start();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener(SYNC_EVENT, onOnline);
    window.addEventListener("profe:offline-preference", onPreference);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SYNC_EVENT, onOnline);
      window.removeEventListener("profe:offline-preference", onPreference);
    };
  }, [userId, spacesKey, actions]);
}

const SYNC_EVENT = "profe:offline-sync";

/** Un recurso cambió (se guardó, se marcó como listo o se archivó): sincronizar ya. */
export function requestOfflineSync() {
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/** El docente pide sincronizar ya, aunque el navegador tenga activo el ahorro de datos. */
export function forceOfflineSync() {
  useOfflineState.setState({ forced: true });
  setOfflinePreference("on");
}
