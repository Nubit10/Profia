"use client";

import { useEffect, useRef } from "react";

// SPEC-0013 RN-11 (patrón de Terram): toda capa que se abre (hoja, diálogo, menú, cajón) agrega una
// entrada al historial, así el botón Atrás del teléfono la cierra sin sacar al docente de la página.
// Las capas forman una pila: Atrás cierra solo la de arriba.

type Layer = { id: number; close: () => void };
const stack: Layer[] = [];
let nextId = 0;
let listening = false;
/** `history.back()` propios (al cerrar una capa por su botón): su `popstate` no cierra otra. */
let ownBacks = 0;
/** Momento del último clic en un enlace: esa capa se cierra porque se navega, no se retrocede. */
let linkClickedAt = 0;

function onPopState() {
  if (ownBacks > 0) {
    ownBacks -= 1;
    return;
  }
  const top = stack.pop();
  if (top) {
    top.close();
    return;
  }
  // Entrada de una capa que se cerró al navegar: no tiene nada que cerrar, se salta para que Atrás
  // nunca parezca no hacer nada.
  if (window.history.state?.profeLayer) window.history.back();
}

function onClick(event: MouseEvent) {
  if ((event.target as Element | null)?.closest?.("a[href]")) linkClickedAt = Date.now();
}

/** Llamar antes de `router.push` desde una capa abierta: al cerrarse no se retrocede. */
export function navigatingFromLayer() {
  linkClickedAt = Date.now();
}

function listen() {
  if (listening) return;
  window.addEventListener("popstate", onPopState);
  document.addEventListener("click", onClick, true);
  listening = true;
}

/** Cierra la capa con Atrás mientras `open` sea verdadero. */
export function useBackToClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    if (!open) return;
    listen();
    const layer: Layer = { id: (nextId += 1), close: () => closeRef.current() };
    stack.push(layer);
    // Misma URL y el estado de Next intacto: solo una entrada más para que Atrás tenga qué quitar.
    window.history.pushState({ ...window.history.state, profeLayer: layer.id }, "");
    return () => {
      const index = stack.indexOf(layer);
      if (index === -1) return; // la cerró Atrás: su entrada ya salió del historial
      stack.splice(index, 1);
      // Se cierra porque el docente tocó un enlace: retroceder desharía la navegación.
      if (Date.now() - linkClickedAt < 1_000) return;
      // Se cerró con su botón, Escape o un clic afuera: se quita la entrada que agregó.
      if (window.history.state?.profeLayer === layer.id) {
        ownBacks += 1;
        window.history.back();
      }
    };
  }, [open]);
}
