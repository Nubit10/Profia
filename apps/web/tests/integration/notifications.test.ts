import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { PushClient, PushDevice, PushMessage } from "@/lib/push";
import {
  hasPushDevice,
  notifyGenerationFinished,
  registerPushDevice,
  removePushDevice,
} from "@/modules/notifications";
import { pushDeviceSchema } from "@/modules/notifications/client";
import { createUser, resetDatabase } from "../support/factories";

// SPEC-0013 RN-15 y ADR-0012: dispositivos que reciben avisos y su envío.

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

const device = (n: number) => ({
  installationId: `instalacion-${n}-0000000000`,
  subscription: {
    endpoint: `https://push.example.test/send/${n}`,
    keys: { p256dh: `p256dh-clave-publica-${n}-0000000000`, auth: `auth-${n}-0000` },
  },
});

/** Servicio push de prueba: guarda lo que se le pide enviar y responde lo que se le diga. */
function fakePush(gone: string[] = []) {
  const sent: { devices: PushDevice[]; message: PushMessage }[] = [];
  const client: PushClient = {
    async send(devices, message) {
      sent.push({ devices, message });
      return {
        delivered: devices.length - gone.length,
        gone: devices.map((d) => d.endpoint).filter((e) => gone.includes(e)),
        failed: 0,
      };
    },
  };
  return { client, sent };
}

const finished = (userId: string, outcome: "READY" | "FAILED" = "READY") => ({
  userId,
  resourceId: "res1",
  courseId: "cur1",
  typeLabel: "quiz",
  name: "La recta numérica",
  outcome,
});

describe("dispositivos (RN-15)", () => {
  it("CA-0013-32: activar los avisos guarda el dispositivo de quien tiene la sesión", async () => {
    const ana = await createUser("Ana");
    await registerPushDevice(ana.id, device(1));
    expect(await hasPushDevice(ana.id, device(1).installationId)).toBe(true);

    // Volver a activarlo no duplica; otra cuenta en el mismo dispositivo se lo queda.
    await registerPushDevice(ana.id, device(1));
    const luis = await createUser("Luis");
    await registerPushDevice(luis.id, device(1));
    expect(await hasPushDevice(ana.id, device(1).installationId)).toBe(false);
    expect(await hasPushDevice(luis.id, device(1).installationId)).toBe(true);
    expect(await db.pushSubscription.count()).toBe(1);

    // Solo su dueño lo quita.
    await removePushDevice(ana.id, device(1).installationId);
    expect(await db.pushSubscription.count()).toBe(1);
    await removePushDevice(luis.id, device(1).installationId);
    expect(await db.pushSubscription.count()).toBe(0);
  });

  it("CA-0013-32: solo se aceptan servicios de avisos con HTTPS (formulario y base)", async () => {
    const http = {
      ...device(2),
      subscription: { ...device(2).subscription, endpoint: "http://x.test/1" },
    };
    expect(pushDeviceSchema.safeParse(http).success).toBe(false);
    const ana = await createUser("Ana");
    await expect(
      db.pushSubscription.create({
        data: {
          userId: ana.id,
          installationId: "instalacion-http-0000",
          endpoint: "http://x.test",
          p256dh: "p256dh-clave-publica-000000",
          auth: "auth-0000",
        },
      }),
    ).rejects.toThrow();
  });
});

describe("envío (RN-15)", () => {
  it("CA-0013-33: el aviso dice qué terminó y abre el recurso", async () => {
    const ana = await createUser("Ana");
    await registerPushDevice(ana.id, device(1));
    const push = fakePush();
    await notifyGenerationFinished(finished(ana.id), push.client);
    expect(push.sent).toEqual([
      {
        devices: [expect.objectContaining({ endpoint: device(1).subscription.endpoint })],
        message: {
          title: "Tu quiz está listo",
          body: "«La recta numérica» está listo para revisar.",
          url: "/courses/cur1/resources/res1",
          tag: "resource-res1",
        },
      },
    ]);
    await notifyGenerationFinished(finished(ana.id, "FAILED"), push.client);
    expect(push.sent[1]!.message.title).toBe("No pudimos crear tu quiz");
  });

  it("CA-0013-35: a otro docente no le llega el aviso de un recurso ajeno", async () => {
    const ana = await createUser("Ana");
    const luis = await createUser("Luis");
    await registerPushDevice(ana.id, device(1));
    await registerPushDevice(luis.id, device(2));
    const push = fakePush();
    await notifyGenerationFinished(finished(ana.id), push.client);
    expect(push.sent.flatMap((s) => s.devices.map((d) => d.endpoint))).toEqual([
      device(1).subscription.endpoint,
    ]);
  });

  it("CA-0013-36: una suscripción vencida (410) se borra y sin claves no se envía nada", async () => {
    const ana = await createUser("Ana");
    await registerPushDevice(ana.id, device(1));
    await registerPushDevice(ana.id, device(2));
    const push = fakePush([device(1).subscription.endpoint]);
    await notifyGenerationFinished(finished(ana.id), push.client);
    expect((await db.pushSubscription.findMany()).map((d) => d.installationId)).toEqual([
      device(2).installationId,
    ]);

    // Sin canal configurado (sin claves VAPID): no hay envío ni error.
    await expect(notifyGenerationFinished(finished(ana.id), null)).resolves.toBeUndefined();
  });
});
