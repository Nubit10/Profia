"use client";

import { Button } from "@/components/ui/button";

// Error genérico: nunca muestra detalles internos ni stack traces al usuario.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-muted-foreground">No pudimos cargar esta página. Intenta de nuevo.</p>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
