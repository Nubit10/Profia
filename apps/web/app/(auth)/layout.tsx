import Link from "next/link";
import { HiCheckCircle } from "react-icons/hi2";
import { ProfeLogo } from "@/components/brand/profe-logo";

const POINTS = [
  "Talleres y quices listos para revisar en segundos",
  "Alineados con los DBA y Estándares del MEN",
  "Tu formato y tu logo en Word y PDF",
];

/** Ingreso y registro (SPEC-0012): formulario a la izquierda y el valor de Profe al lado. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid flex-1 bg-hero lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-8 px-4 py-12">
        <Link href="/" aria-label="Profe, inicio">
          <ProfeLogo />
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10" />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/10"
        />
        <div className="relative flex max-w-md flex-col gap-6">
          <h2 className="text-4xl leading-tight font-extrabold">
            Más tiempo para enseñar, menos tiempo preparando
          </h2>
          <ul className="flex flex-col gap-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-lg font-semibold">
                <HiCheckCircle className="size-6 shrink-0" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <p className="text-white/90">La IA propone; tú revisas y decides.</p>
        </div>
      </aside>
    </main>
  );
}
