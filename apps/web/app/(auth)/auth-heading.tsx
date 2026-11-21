import type { ReactNode } from "react";

/** Título y una línea de ayuda de las pantallas de ingreso (sin tarjeta). */
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-2">
      <h1 className="font-display text-3xl leading-tight font-normal text-foreground sm:text-4xl">
        {title}
      </h1>
      {children && <p className="text-muted-foreground">{children}</p>}
    </header>
  );
}
