import Link from "next/link";
import { HiCheck } from "react-icons/hi2";
import { ProfiaLogo } from "@/components/brand/profia-logo";

/**
 * Ingreso, registro y recuperar contraseña: el formulario sin tarjeta sobre un fondo liso y, en el
 * computador, un panel oscuro con una sola frase y dos avisos de ejemplo (decorativos).
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col bg-brand-softer px-6 py-6 sm:px-10 sm:py-8">
        <Link href="/" aria-label="ProfIA, inicio" className="self-start">
          <ProfiaLogo size={32} />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-foreground px-12 py-16 text-background lg:flex lg:flex-col xl:px-16"
      >
        <p className="max-w-lg font-display text-4xl leading-tight font-normal">
          Mientras tomas el tinto, ProfIA ya armó <em className="text-ring">el taller del lunes</em>{" "}
          y su quiz.
        </p>
        <div className="relative mt-auto mb-24 ml-auto w-full max-w-sm">
          <div className="-rotate-2 rounded-xl bg-background px-4 py-3 text-foreground shadow-lift">
            <p className="text-xs text-muted-foreground">ProfIA · hace 2 min</p>
            <p className="text-sm">
              <strong>Taller listo:</strong> Fracciones · 6°
            </p>
          </div>
          <div className="mt-3 ml-10 rounded-xl border border-background/15 bg-background/5 px-4 py-3">
            <p className="text-sm text-background/70">Quiz de Matemáticas</p>
            <p className="flex items-center gap-1.5 text-sm text-highlight">
              <HiCheck className="size-4" />
              Respuestas verificadas · clave aparte
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
