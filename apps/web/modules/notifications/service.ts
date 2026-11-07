import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/observability/logger";
import { getPushClient, type PushClient } from "@/lib/push";
import type { PushDeviceInput } from "./schemas";

// SPEC-0013 RN-15 y ADR-0012: dispositivos que reciben avisos y envío cuando termina una generación.

/**
 * Registra (o actualiza) el dispositivo para el usuario con sesión. Un dispositivo compartido avisa
 * solo a la última cuenta que entró: registrarlo lo pasa a quien tiene la sesión.
 */
export async function registerPushDevice(userId: string, input: PushDeviceInput) {
  const { installationId, subscription } = input;
  const data = {
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  };
  await db.$transaction(async (tx) => {
    // El mismo endpoint con otro id de instalación (p. ej. se borraron los datos del sitio).
    await tx.pushSubscription.deleteMany({
      where: { endpoint: subscription.endpoint, installationId: { not: installationId } },
    });
    await tx.pushSubscription.upsert({
      where: { installationId },
      create: { installationId, ...data },
      update: data,
    });
  });
}

/** Quita el dispositivo; solo el dueño de la sesión puede quitar el suyo. */
export async function removePushDevice(userId: string, installationId: string) {
  await db.pushSubscription.deleteMany({ where: { userId, installationId } });
}

/** Si este dispositivo tiene los avisos activos para el usuario. */
export async function hasPushDevice(userId: string, installationId: string) {
  return (await db.pushSubscription.count({ where: { userId, installationId } })) > 0;
}

export type GenerationFinished = {
  userId: string;
  resourceId: string;
  courseId: string;
  /** "quiz", "taller", "examen" (en minúscula, como va en la frase). */
  typeLabel: string;
  /** "La recta numérica": el título sin el prefijo del tipo. */
  name: string;
  outcome: "READY" | "FAILED";
};

/**
 * Avisa al docente que pidió el recurso, en todos sus dispositivos. Nunca lanza: la generación ya
 * terminó y un aviso que no sale no la afecta. El contenido lleva solo el tipo y el título.
 */
export async function notifyGenerationFinished(
  event: GenerationFinished,
  client: PushClient | null = getPushClient(),
) {
  if (!client) return;
  try {
    const devices = await db.pushSubscription.findMany({
      where: { userId: event.userId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    if (devices.length === 0) return;
    const ready = event.outcome === "READY";
    const result = await client.send(devices, {
      title: ready ? `Tu ${event.typeLabel} está listo` : `No pudimos crear tu ${event.typeLabel}`,
      body: ready
        ? `«${event.name}» está listo para revisar.`
        : `«${event.name}». Toca para reintentar.`,
      url: `/courses/${event.courseId}/resources/${event.resourceId}`,
      tag: `resource-${event.resourceId}`,
    });
    if (result.gone.length > 0) {
      await db.pushSubscription.deleteMany({ where: { endpoint: { in: result.gone } } });
    }
  } catch (error) {
    logger.warn("push.notify_failed", { error });
  }
}
