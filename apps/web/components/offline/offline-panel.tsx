"use client";

import { useSyncExternalStore } from "react";
import { HiOutlineCloudArrowDown, HiOutlineWifi } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { forceOfflineSync, useOfflineState } from "./offline-sync";
import { offlinePreference, setOfflinePreference, wipeOffline } from "./offline-store";

function subscribe(listener: () => void) {
  window.addEventListener("profe:offline-preference", listener);
  return () => window.removeEventListener("profe:offline-preference", listener);
}

/**
 * SPEC-0013 RN-14 / CA-0013-41: en el navegador, Profe pregunta una vez si guarda los recursos en
 * este dispositivo (los computadores del colegio suelen ser compartidos) y no guarda nada hasta que
 * el docente acepta. Ya activo, muestra cuántos van guardados y deja apagarlo.
 */
export function OfflinePanel({ hasResources }: { hasResources: boolean }) {
  // La preferencia vive en el navegador: en el servidor no se pinta nada (RN-09).
  const preference = useSyncExternalStore(subscribe, offlinePreference, () => "unknown" as const);
  const { saved, total, syncing } = useOfflineState();
  if (preference === "unknown" || !hasResources) return null;

  if (preference === null) {
    return (
      <section
        aria-labelledby="offline-title"
        data-testid="offline-panel"
        className="flex flex-col gap-3 rounded-3xl border border-brand-border bg-card p-5 shadow-soft sm:flex-row sm:items-center"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
          <HiOutlineCloudArrowDown className="size-6" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:basis-56">
          <h2 id="offline-title" className="font-bold">
            ¿Guardar tus recursos en este dispositivo para usarlos sin conexión?
          </h2>
          <p className="text-sm text-muted-foreground">
            Tus talleres, quices y exámenes en Word y PDF, listos para descargar aunque no haya
            internet. Si este computador lo usan otras personas, mejor no.
          </p>
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
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
    >
      <HiOutlineWifi className="size-4 shrink-0" aria-hidden />
      {preference === "on" ? (
        <>
          <span role="status">
            Sin conexión: guardados {Math.min(count, total || count)} de {total || count}
            {syncing ? " · guardando…" : ""}
          </span>
          {!syncing && count < total && (
            <Button type="button" variant="link" className="px-0" onClick={forceOfflineSync}>
              Guardar ahora
            </Button>
          )}
          <Button
            type="button"
            variant="link"
            className="px-0"
            onClick={async () => {
              await wipeOffline();
              setOfflinePreference("off");
              useOfflineState.setState({ saved: {}, total: 0 });
            }}
          >
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
