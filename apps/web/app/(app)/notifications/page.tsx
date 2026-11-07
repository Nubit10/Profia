import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import * as notifications from "@/modules/notifications";
import { requireTenant } from "@/modules/tenancy";
import { NotificationSettings } from "./notification-settings";

export const metadata: Metadata = { title: "Notificaciones" };

/** SPEC-0013 RN-15: Ajustes → Notificaciones de este dispositivo. */
export default async function NotificationsPage() {
  await requireTenant();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow="Ajustes"
        title="Notificaciones"
        description="Te avisamos cuando un taller, quiz o examen termina de prepararse, aunque Profe esté cerrado."
      />
      <NotificationSettings
        publicKey={notifications.vapidPublicKey()}
        actions={{
          register: notifications.registerPushDeviceAction,
          remove: notifications.removePushDeviceAction,
          status: notifications.pushDeviceStatusAction,
        }}
      />
    </div>
  );
}
