import type { Metadata } from "next";
import { ProfeLogo } from "@/components/brand/profe-logo";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Sin conexión", robots: { index: false } };
// SPEC-0013 RN-13: página estática; el service worker la guarda y la muestra sin señal. No lleva
// datos de nadie.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <ProfeLogo />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold">Sin conexión</h1>
        <p className="text-muted-foreground">
          No hay internet en este momento. Cuando vuelva la señal, toca «Reintentar» para seguir
          donde ibas.
        </p>
      </div>
      <RetryButton />
    </main>
  );
}
