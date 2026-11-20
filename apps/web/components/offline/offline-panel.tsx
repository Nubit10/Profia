"use client";

import { useState, useSyncExternalStore } from "react";
import { HiOutlineCloudArrowDown, HiOutlineWifi } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { forceOfflineSync, useOfflineState } from "./offline-sync";
import { offlinePreference, setOfflinePreference, wipeOffline } from "./offline-store";

const QUESTION = "¿Guardar tus recursos en este dispositivo para usarlos sin conexión?";
const EXPLANATION =
  "Tus talleres, quices y exámenes en Word y PDF, listos para descargar aunque no haya internet. Si este computador lo usan otras personas, mejor no.";

function subscribe(listener: () => void) {
  window.addEventListener("profe:offline-preference", listener);
  return () => window.removeEventListener("profe:offline-preference", listener);
}

/** La preferencia vive en el navegador: en el servidor es "unknown" y no se pinta nada (RN-09). */
function usePreference() {
  return useSyncExternalStore(subscribe, offlinePreference, () => "unknown" as const);
}

async function stopSaving() {
  await wipeOffline();
  setOfflinePreference("off");
  useOfflineState.setState({ saved: {}, total: 0 });
}

function SavedCount() {
  const { saved, total, syncing } = useOfflineState();
  const count = Object.keys(saved).length;
  return (
    <span role="status">
      Sin conexión: guardados {Math.min(count, total || count)} de {total || count}
      {syncing ? " · guardando…" : ""}
    </span>
  );
}

/**
 * SPEC-0013 RN-14 / CA-0013-41: en el navegador, Profe pregunta una vez si guarda los recursos en
 * este dispositivo (los computadores del colegio suelen ser compartidos) y no guarda nada hasta que
 * el docente acepta. Ya activo, muestra cuántos van guardados y deja apagarlo.
 * SPEC-0018: en el celular se oculta (`max-sm:hidden`) y la pregunta vive en `OfflineButton`.
 */
export function OfflinePanel({ hasResources }: { hasResources: boolean }) {
  const preference = usePreference();
  const { saved, total, syncing } = useOfflineState();
  if (preference === "unknown" || !hasResources) return null;

  if (preference === null) {
    return (
      <section
        aria-labelledby="offline-title"
        data-testid="offline-panel"
        className="flex flex-col gap-3 rounded-3xl border border-brand-border bg-card p-5 shadow-soft max-sm:hidden sm:flex-row sm:items-center"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
          <HiOutlineCloudArrowDown className="size-6" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:basis-56">
          <h2 id="offline-title" className="font-bold">
            {QUESTION}
          </h2>
          <p className="text-sm text-muted-foreground">{EXPLANATION}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setOfflinePreference("on")}>
            Guardar en este dispositivo
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOfflinePreference("off")}>
            No, gracias
          </Button>
        </div>
      </section>
    );
  }

  const count = Object.keys(saved).length;
  return (
    <div
      data-testid="offline-panel"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground max-sm:hidden"
    >
      <HiOutlineWifi className="size-4 shrink-0" aria-hidden />
      {preference === "on" ? (
        <>
          <SavedCount />
          {!syncing && count < total && (
            <Button type="button" variant="link" className="px-0" onClick={forceOfflineSync}>
              Guardar ahora
            </Button>
          )}
          <Button type="button" variant="link" className="px-0" onClick={stopSaving}>
            Dejar de guardar en este dispositivo
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="link"
          className="px-0"
          onClick={() => setOfflinePreference("on")}
        >
          Guardar mis recursos para usarlos sin conexión
        </Button>
      )}
    </div>
  );
}

/**
 * SPEC-0018: en el celular, la pregunta de "sin conexión" es un ícono junto a "Crear con IA" con un
 * punto de aviso mientras el docente no decide; al tocarlo, una hoja inferior explica y da las
 * opciones. Cerrarla sin elegir no cambia nada (RN-03). Solo se ve por debajo de `sm`.
 */
export function OfflineButton({ hasResources }: { hasResources: boolean }) {
  const preference = usePreference();
  const { saved, total, syncing } = useOfflineState();
  const [open, setOpen] = useState(false);
  if (preference === "unknown" || !hasResources) return null;

  const pending = preference === null;
  const choose = (value: "on" | "off") => {
    setOfflinePreference(value);
    setOpen(false);
  };
  const missing = !syncing && Object.keys(saved).length < total;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        data-testid="offline-button"
        className="relative size-11 rounded-xl sm:hidden"
        aria-label={
          pending
            ? "Guardar recursos sin conexión (pendiente de decidir)"
            : "Guardar recursos sin conexión"
        }
        onClick={() => setOpen(true)}
      >
        <HiOutlineCloudArrowDown className="size-6" aria-hidden />
        {pending && (
          <span
            data-testid="offline-alert"
            aria-hidden
            className="absolute -top-1 -right-1 size-3 rounded-full bg-warning ring-2 ring-background"
          />
        )}
      </Button>
      <DialogContent data-testid="offline-dialog">
        <DialogHeader>
          <DialogTitle>{preference === "on" ? "Tus recursos sin conexión" : QUESTION}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{EXPLANATION}</DialogDescription>
        {preference === "on" && (
          <p className="text-sm">
            <SavedCount />
          </p>
        )}
        <DialogFooter>
          {preference === "on" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await stopSaving();
                  setOpen(false);
                }}
              >
                Dejar de guardar en este dispositivo
              </Button>
              {missing && (
                <Button type="button" onClick={forceOfflineSync}>
                  Guardar ahora
                </Button>
              )}
            </>
          ) : (
            <>
              {pending && (
                <Button type="button" variant="ghost" onClick={() => choose("off")}>
                  No, gracias
                </Button>
              )}
              <Button type="button" onClick={() => choose("on")}>
                Guardar en este dispositivo
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Sin conexión" en un recurso guardado en su versión actual (o "Guardando…"). */
export function OfflineBadge({ resourceId, version }: { resourceId: string; version: number }) {
  const { saved, enabled, syncing } = useOfflineState();
  if (!enabled) return null;
  const ready = saved[resourceId] === version;
  if (!ready && !syncing) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success"
      data-testid={ready ? "offline-ready" : "offline-saving"}
    >
      <HiOutlineCloudArrowDown className="size-3.5" aria-hidden />
      {ready ? "Disponible sin conexión" : "Guardando…"}
    </span>
  );
}
