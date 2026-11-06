// SPEC-0013 F-17: mientras una pantalla carga sus datos se ve su forma, no la pantalla anterior
// quieta. Sin animación con movimiento reducido.

function Block({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-muted motion-reduce:animate-none ${className}`} />
  );
}

export function PageSkeleton({ variant = "list" }: { variant?: "list" | "detail" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="page-skeleton"
      className="flex max-w-5xl flex-col gap-6"
    >
      <span className="sr-only">Cargando…</span>
      <div className="flex flex-col gap-2">
        <Block className="h-4 w-32" />
        <Block className="h-8 w-64 max-w-full" />
      </div>
      {variant === "detail" ? (
        <>
          <Block className="h-28 w-full" />
          <Block className="h-12 w-full" />
          <Block className="h-64 w-full" />
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Block key={i} className="h-24" />
          ))}
        </div>
      )}
    </div>
  );
}
