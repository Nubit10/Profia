"use client";

import { useEffect } from "react";

// Bloqueo de scroll compartido (lección de CliqCut): lleva la cuenta de quién lo pidió, para que
// cerrar el menú no desbloquee el fondo de un modal todavía abierto, ni al revés.
let locks = 0;
let previous: { html: string; body: string } | null = null;

function lock() {
  if (locks === 0) {
    previous = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }
  locks += 1;
}

function unlock() {
  locks = Math.max(0, locks - 1);
  if (locks === 0 && previous) {
    document.documentElement.style.overflow = previous.html;
    document.body.style.overflow = previous.body;
    previous = null;
  }
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
