import Link from "next/link";
import { ProfeLogo } from "@/components/brand/profe-logo";

const STEPS = [
  ["DBA", "Los referentes oficiales de tu grado"],
  ["Planeación", "Unidades, temas y objetivos del periodo"],
  ["Recurso", "Taller, quiz o examen para revisar"],
  ["Tu aula", "Word y PDF con tu formato y tu logo"],
];

/** Ingreso y registro: el formulario sobre la hoja rayada y, al lado, el recorrido de Profe. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid flex-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col items-center justify-center gap-8 bg-ruled px-4 py-12">
        <Link href="/" aria-label="Profe, inicio">
          <ProfeLogo />
        </Link>
        <div className="w-full max-w-sm">{children}</div>
        <p className="font-mono text-xs text-muted-foreground">
          La IA propone · tú revisas y decides
        </p>
      </div>
      <aside className="hidden flex-col justify-center bg-foreground p-12 text-background lg:flex xl:p-20">
        <div className="flex max-w-md flex-col gap-10">
          <div className="flex flex-col gap-4">
            <p className="font-mono text-xs tracking-[0.2em] text-highlight uppercase">
              Para docentes de Colombia
            </p>
            <h2 className="font-display text-4xl leading-tight font-semibold">
              Del DBA a la clase del lunes,{" "}
              <em className="text-highlight">sin gastarse el domingo.</em>
            </h2>
          </div>
          <ol className="flex flex-col">
            {STEPS.map(([title, text], i) => (
              <li
                key={title}
                className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-t border-background/15 py-4"
              >
                <span className="font-mono text-sm text-highlight">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-bold">{title}</span>
                <span className="col-start-2 text-sm text-background/70">{text}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </main>
  );
}
