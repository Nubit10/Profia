"use client";

import { useState, useSyncExternalStore } from "react";
import { HiOutlineBellAlert } from "react-icons/hi2";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { enablePush, pushState, snooze, snoozed, type PushActions } from "./push-device";

const noop = () => () => {};

/**
 * SPEC-0013 RN-15 / CA-0013-32: la primera vez que el docente genera algo, una tarjeta pregunta
 * "¿Te avisamos cuando esté listo?". Nunca se pide el permiso al cargar una página. En iPhone sin
 * Profe instalada explica que los avisos llegan a la app instalada.
 */
export function NotifyCard({
  publicKey,
  actions,
}: {
  /** Clave pública VAPID; `null` si el canal no está configurado (no se ofrece nada). */
  publicKey: string | null;
  actions: PushActions;
}) {
  // El estado del navegador no se conoce en el servidor: no se pinta nada al hidratar (RN-09).
  const initial = useSyncExternalStore(
    noop,
    () => (snoozed() ? "snoozed" : pushState()),
    () => null,
  );
  const [state, setState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = state ?? initial;
  if (!publicKey || (current !== "default" && current !== "ios-install")) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const next = await enablePush(publicKey, actions);
      setState(next === "granted" ? "done" : next);
      if (next === "granted") {
        sileo.success({ title: "Te avisaremos", description: "Aunque cierres Profe." });
      }
    } catch {
      sileo.error({ title: "No pudimos activar los avisos", description: "Intenta más tarde." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="notify-title"
      data-testid="notify-card"
      className="flex flex-col gap-3 rounded-3xl border border-brand-border bg-card p-5 shadow-soft sm:flex-row sm:items-center"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
        <HiOutlineBellAlert className="size-6" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <h2 id="notify-title" className="font-bold">
          ¿Te avisamos cuando esté listo?
        </h2>
        <p className="text-sm text-muted-foreground">
          {current === "ios-install"
            ? "En iPhone los avisos llegan a Profe instalada: en Safari toca Compartir → «Agregar a pantalla de inicio» y entra desde ese ícono."
            : "Puedes cerrar Profe o cambiar de pestaña: te llega un aviso cuando termine."}
        </p>
      </div>
      {current === "default" && (
        <div className="flex gap-2">
          <Button type="button" disabled={busy} onClick={() => void enable()}>
            Avisarme
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              snooze();
              setState("snoozed");
            }}
          >
            Ahora no
          </Button>
        </div>
      )}
    </section>
  );
}
