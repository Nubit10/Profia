"use client";

import { useState, useSyncExternalStore } from "react";
import { HiOutlineArrowDownOnSquare } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// SPEC-0013 RN-12: "Instalar Profe". Usa el aviso del navegador donde existe (Chrome, Edge, Android)
// y en iPhone o iPad explica cómo agregarla a la pantalla de inicio (texto de CliqCut adaptado).
// No aparece con Profe ya instalada ni en navegadores que no pueden instalarla.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// El navegador avisa una sola vez y puede ser antes de que se monte el menú: se escucha al cargar.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

type Mode = "prompt" | "ios" | null;

function currentMode(): Mode {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  if (deferred) return "prompt";
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `className` para que se vea como las demás opciones del pie del menú. */
export function InstallApp({ className, onDone }: { className: string; onDone?: () => void }) {
  // En el servidor no se sabe: no se pinta nada y no hay diferencia al hidratar (RN-09).
  const mode = useSyncExternalStore(subscribe, currentMode, () => null);
  const [help, setHelp] = useState(false);
  if (!mode) return null;

  const install = async () => {
    if (mode === "ios") {
      setHelp(true);
      return;
    }
    const prompt = deferred;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
    deferred = null;
    notify();
    onDone?.();
  };

  return (
    <>
      <button type="button" onClick={() => void install()} className={className}>
        <HiOutlineArrowDownOnSquare className="size-[18px] text-brand" aria-hidden />
        Instalar Profe
      </button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Instala Profe en tu iPhone</DialogTitle>
            <DialogDescription>
              Queda como una app, con su ícono, a pantalla completa.
            </DialogDescription>
          </DialogHeader>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
            <li>Abre Profe en Safari.</li>
            <li>
              Toca <span className="font-semibold">Compartir</span> (el cuadro con la flecha hacia
              arriba).
            </li>
            <li>
              Elige <span className="font-semibold">Agregar a pantalla de inicio</span>.
            </li>
            <li>Luego entra desde ese ícono.</li>
          </ol>
          <Button type="button" onClick={() => setHelp(false)}>
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
