"use client";

import { useEffect, useState } from "react";
import { HiOutlineBellAlert, HiOutlineBellSlash } from "react-icons/hi2";
import { sileo } from "sileo";
import {
  disablePush,
  enablePush,
  installationId,
  pushState,
  type PushActions,
  type PushState,
} from "@/components/notifications/push-device";
import { Button } from "@/components/ui/button";

type View = PushState | "loading" | "active" | "off";

const MESSAGES: Partial<Record<View, string>> = {
  unsupported: "Este navegador no permite avisos. Prueba con Chrome, Edge, Firefox o Safari.",
  "ios-install":
    "En iPhone los avisos llegan a Profe instalada: en Safari toca Compartir → «Agregar a pantalla de inicio», entra desde ese ícono y vuelve aquí.",
  denied:
    "Los avisos están bloqueados en este navegador. Actívalos en la configuración del sitio (el ícono junto a la dirección) y recarga la página.",
};

export function NotificationSettings({
  publicKey,
  actions,
}: {
  publicKey: string | null;
  actions: PushActions;
}) {
  const [view, setView] = useState<View>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const state = pushState();
    const resolve =
      state === "granted"
        ? actions
            .status({ installationId: installationId() })
            .then((r) => (r.ok && r.data?.active ? "active" : "off") as View)
        : Promise.resolve<View>(state === "default" ? "off" : state);
    void resolve.then((next) => {
      if (!cancelled) setView(next);
    });
    return () => {
      cancelled = true;
    };
  }, [actions]);

  if (!publicKey) {
    return (
      <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Los avisos del navegador no están disponibles en este momento.
      </p>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (view === "active") {
        await disablePush(actions);
        setView("off");
        sileo.success({ title: "Avisos desactivados en este dispositivo" });
      } else {
        const next = await enablePush(publicKey, actions);
        setView(next === "granted" ? "active" : next);
        if (next === "granted") sileo.success({ title: "Avisos activados en este dispositivo" });
      }
    } catch {
      sileo.error({ title: "No pudimos cambiar los avisos", description: "Intenta más tarde." });
    } finally {
      setBusy(false);
    }
  };

  const active = view === "active";
  return (
    <section
      aria-labelledby="device-title"
      className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
          {active ? (
            <HiOutlineBellAlert className="size-6" aria-hidden />
          ) : (
            <HiOutlineBellSlash className="size-6" aria-hidden />
          )}
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="device-title" className="font-bold">
            Este dispositivo
          </h2>
          <p className="text-sm text-muted-foreground" role="status">
            {view === "loading"
              ? "Revisando…"
              : active
                ? "Recibe avisos de tus talleres, quices y exámenes."
                : (MESSAGES[view] ?? "No recibe avisos.")}
          </p>
        </div>
      </div>
      {(view === "active" || view === "off") && (
        <Button
          type="button"
          variant={active ? "outline" : "default"}
          className="w-fit"
          disabled={busy}
          onClick={() => void toggle()}
        >
          {active ? "Desactivar avisos" : "Activar avisos"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Si este dispositivo lo usan varias personas, los avisos le llegan solo a la última cuenta
        que entró. Al cerrar sesión se desactivan.
      </p>
    </section>
  );
}
