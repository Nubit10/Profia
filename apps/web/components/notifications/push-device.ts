"use client";

import type { ActionResult } from "@/lib/action-result";

// SPEC-0013 RN-15: activar y desactivar los avisos del navegador en este dispositivo (Web Push).

export type PushActions = {
  register: (input: unknown) => Promise<ActionResult>;
  remove: (input: { installationId: string }) => Promise<ActionResult>;
  status: (input: { installationId: string }) => Promise<ActionResult<{ active: boolean }>>;
};

/** Estado de los avisos en este navegador. */
export type PushState =
  | "unsupported" // el navegador no tiene avisos
  | "ios-install" // iPhone o iPad sin Profe instalada: los avisos solo llegan a la app instalada
  | "denied" // el docente los bloqueó en el navegador
  | "default" // todavía no se ha preguntado
  | "granted"; // permiso dado (puede o no tener este dispositivo registrado)

const INSTALLATION_KEY = "profe:installation";
const SNOOZE_KEY = "profe:avisos-ahora-no";
const SNOOZE_MS = 7 * 24 * 3600 * 1000;

/** Id aleatorio de esta instalación del navegador (no identifica a nadie). */
export function installationId(): string {
  try {
    const saved = localStorage.getItem(INSTALLATION_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(INSTALLATION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function pushState(): PushState {
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return ios && !standalone ? "ios-install" : "unsupported";
  return Notification.permission as PushState;
}

/** "Ahora no" en la tarjeta: no se vuelve a preguntar en 7 días. */
export function snoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    // Sin almacenamiento se volverá a preguntar la próxima vez.
  }
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function registration() {
  return (
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/" }))
  );
}

/** Pide el permiso (si hace falta), suscribe el navegador y lo registra en el servidor. */
export async function enablePush(publicKey: string, actions: PushActions): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PushState;
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }));
  const result = await actions.register({
    installationId: installationId(),
    subscription: subscription.toJSON(),
  });
  if (!result.ok) throw new Error(result.error);
  return "granted";
}

/** Quita los avisos de este dispositivo (en el navegador y en el servidor). */
export async function disablePush(actions: Pick<PushActions, "remove">) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    const subscription = await reg?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {
    // Si el navegador no deja quitarla, igual se borra en el servidor.
  }
  await actions.remove({ installationId: installationId() });
}
