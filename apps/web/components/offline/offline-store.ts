"use client";

import type { OfflineEntry } from "@/modules/documents/client";

// SPEC-0013 RN-14 y ADR-0012: biblioteca sin conexión del dispositivo. Los archivos van en Cache
// Storage (una caché por cuenta: `profe-offline-<usuario>`) y su índice en IndexedDB. Nada de esto
// sale del dispositivo; se borra al cerrar sesión o cuando entra otra cuenta.

const DB_NAME = "profe-offline";
const STORE = "entries";
const CACHE_PREFIX = "profe-offline-";
const OWNER_KEY = "profe:offline:owner";
const ENABLED_KEY = "profe:offline:enabled";
const SYNC_KEY = "profe:offline:synced-at";

export type SavedFile = {
  doc: string;
  format: string;
  label: string;
  filename: string;
  key: string;
};
export type SavedEntry = Omit<OfflineEntry, "files"> & {
  owner: string;
  institutionId: string;
  savedAt: string;
  files: SavedFile[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "resourceId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export const cacheName = (owner: string) => `${CACHE_PREFIX}${owner}`;

/** Clave del archivo en la caché: no depende de la URL de descarga ni de la sesión. */
export const fileKey = (resourceId: string, version: number, doc: string, format: string) =>
  `/__offline/${resourceId}/${version}/${doc}.${format}`;

export async function listSaved(owner: string): Promise<SavedEntry[]> {
  try {
    const all = await tx<SavedEntry[]>("readonly", (s) => s.getAll() as IDBRequest<SavedEntry[]>);
    return all.filter((e) => e.owner === owner);
  } catch {
    return [];
  }
}

export async function putSaved(entry: SavedEntry) {
  await tx("readwrite", (s) => s.put(entry));
}

export async function removeSaved(owner: string, entry: SavedEntry) {
  const cache = await caches.open(cacheName(owner));
  await Promise.all(entry.files.map((f) => cache.delete(f.key)));
  await tx("readwrite", (s) => s.delete(entry.resourceId));
}

/** Borra todo lo guardado sin conexión en este dispositivo, de cualquier cuenta. */
export async function wipeOffline() {
  try {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
    }
  } catch {
    // Sin Cache Storage no hay archivos que borrar.
  }
  await new Promise<void>((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
  try {
    localStorage.removeItem(OWNER_KEY);
    localStorage.removeItem(SYNC_KEY);
  } catch {
    // Nada más que limpiar.
  }
}

/** Si entra otra cuenta en el dispositivo, lo de la anterior se borra antes de sincronizar. */
export async function claimOwner(userId: string) {
  let owner: string | null = null;
  try {
    owner = localStorage.getItem(OWNER_KEY);
  } catch {
    owner = null;
  }
  if (owner && owner !== userId) await wipeOffline();
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Sin almacenamiento local la biblioteca no se puede asociar a la cuenta.
  }
}

export function currentOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/** "on" | "off" | null (todavía no decidió). */
export function offlinePreference(): "on" | "off" | null {
  try {
    const value = localStorage.getItem(ENABLED_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

export function setOfflinePreference(value: "on" | "off") {
  try {
    localStorage.setItem(ENABLED_KEY, value);
  } catch {
    // Sin almacenamiento se volverá a preguntar.
  }
  window.dispatchEvent(new Event("profe:offline-preference"));
}

export function markSynced() {
  try {
    localStorage.setItem(SYNC_KEY, new Date().toISOString());
  } catch {
    // Solo sirve para avisar si lo guardado puede estar viejo.
  }
}

export function lastSynced(): Date | null {
  try {
    const value = localStorage.getItem(SYNC_KEY);
    return value ? new Date(value) : null;
  } catch {
    return null;
  }
}

/** Descarga un archivo guardado, sin red: lo saca de la caché y lo entrega al navegador. */
export async function downloadSaved(owner: string, file: SavedFile) {
  const response = await caches.match(file.key, { cacheName: cacheName(owner) });
  if (!response) throw new Error("No está guardado");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
