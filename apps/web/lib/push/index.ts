import "server-only";
import webpush from "web-push";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";

/**
 * Web Push estándar con VAPID (SPEC-0013 RN-15, ADR-0012; el mismo canal de Terram): navegadores y la
 * app instalada (en iPhone, iOS 16.4+ con Profe en la pantalla de inicio). Sin las claves no hay
 * canal (`null`).
 */
export type PushMessage = { title: string; body: string; url: string; tag: string };
export type PushDevice = { endpoint: string; p256dh: string; auth: string };
export type PushResult = { delivered: number; gone: string[]; failed: number };
export type PushClient = { send(devices: PushDevice[], message: PushMessage): Promise<PushResult> };

export function vapidPublicKey(): string | null {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = getEnv();
  return NEXT_PUBLIC_VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY ? NEXT_PUBLIC_VAPID_PUBLIC_KEY : null;
}

export function getPushClient(): PushClient | null {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = getEnv();
  if (!NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null;
  const options = {
    vapidDetails: {
      subject: VAPID_SUBJECT ?? "mailto:soporte@profe.app",
      publicKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
    },
    TTL: 24 * 3600,
    urgency: "normal" as const,
    timeout: 10_000,
  };
  return {
    async send(devices, message) {
      const payload = JSON.stringify(message);
      const results = await Promise.allSettled(
        devices.map((d) =>
          webpush.sendNotification(
            { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
            payload,
            options,
          ),
        ),
      );
      const outcome: PushResult = { delivered: 0, gone: [], failed: 0 };
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          outcome.delivered += 1;
          return;
        }
        const status = (result.reason as { statusCode?: number })?.statusCode;
        // 404/410: la suscripción ya no existe (se desinstaló o se quitó el permiso).
        if (status === 404 || status === 410) outcome.gone.push(devices[i]!.endpoint);
        else outcome.failed += 1;
      });
      // Nunca se registra el endpoint ni el contenido (ADR-0012).
      if (outcome.failed > 0) logger.warn("push.send_failed", { failed: outcome.failed });
      return outcome;
    },
  };
}
