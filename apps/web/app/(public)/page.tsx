import Link from "next/link";
import {
  HiOutlineArrowDown,
  HiOutlineArrowRight,
  HiOutlineBuildingLibrary,
  HiOutlineDocumentText,
  HiOutlineShieldCheck,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { ProfeLogo } from "@/components/brand/profe-logo";
import { AiFlow } from "@/components/landing/ai-flow";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Página pública de Profe. Lenguaje propio del aula: la hoja de cuaderno rayada, las notas adhesivas
 * del escritorio, el tablero verde donde se dibuja en tiza cómo trabaja la IA y el resaltador
 * amarillo. Habla como habla un docente colombiano y todo dato de muestra se rotula como ejemplo.
 * RN-05 de SPEC-0012: sin cifras de usuarios ni testimonios inventados.
 */

// -- Lo que le duele al docente y cómo responde Profe -------------------------------------------
const PAINS = [
  {
    pain: "Son las 10 de la noche del domingo y el taller del lunes todavía no existe.",
    answer: "Pides el taller con el tema y el grado. En un par de minutos lo tienes para revisar.",
    tone: "bg-highlight",
    tilt: "-rotate-1",
  },
  {
    pain: "Lo que encuentras en internet no es de tu grado o no tiene nada que ver con los DBA.",
    answer: "Profe parte del DBA oficial de tu curso. Cada actividad sabe a qué apunta.",
    tone: "bg-tint-2",
    tilt: "rotate-1",
  },
  {
    pain: "Coordinación pide la planeación del periodo con objetivos y DBA, y es un trabajo de días.",
    answer: "La IA te propone unidades, temas y objetivos del periodo amarrados a sus DBA.",
    tone: "bg-tint-5",
    tilt: "rotate-[0.6deg]",
  },
  {
    pain: "Pasar todo al formato del colegio y hacer cuatro versiones del quiz para que no se copien.",
    answer:
      "Sale en Word con tu formato y tu logo, y el quiz en versiones A, B, C y D con su clave.",
    tone: "bg-tint-4",
    tilt: "-rotate-[0.6deg]",
  },
];

// -- Por qué no un chat de IA cualquiera --------------------------------------------------------
const VERSUS = [
  [
    "No sabe qué DBA tiene tu grado y a veces se los inventa.",
    "Lee el DBA oficial del MEN de tu curso antes de escribir.",
  ],
  [
    "Cada vez le explicas otra vez tu curso, tu grado y tu tema.",
    "Ya conoce tu curso y tu planeación: solo eliges el tema.",
  ],
  [
    "Te deja un texto que hay que copiar y arreglar en Word.",
    "Te entrega el Word y el PDF con tu formato, tu logo y la clave aparte.",
  ],
  [
    "Si una pregunta sale con dos respuestas, te enteras en clase.",
    "Revisa cada pregunta y corrige lo que falla antes de mostrártelo.",
  ],
  [
    "Lo que hiciste ayer se pierde en la conversación.",
    "Tus talleres, quices y exámenes quedan ordenados por periodo, unidad y tema.",
  ],
];

// -- Herramientas -------------------------------------------------------------------------------
const TOOLS = [
  [
    "Planeación por periodos",
    "Periodos, unidades y temas con objetivos vinculados a los DBA. Lo que coordinación te pide, sin empezar en blanco.",
  ],
  [
    "Talleres",
    "Actividades por momentos (inicio, desarrollo, cierre) con ejemplos de la vida en Colombia, listas para llevar a clase.",
  ],
  [
    "Quices",
    "Preguntas con respuesta y justificación, y hasta cuatro versiones para que nadie se copie.",
  ],
  [
    "Exámenes",
    "De unidad o de periodo, por secciones, con puntaje, conversión a nota de 1,0 a 5,0 y hoja de respuestas.",
  ],
  [
    "Tu propio formato",
    "Subes tu formato en Word una vez y Profe respeta tu encabezado y tus secciones en adelante.",
  ],
  [
    "DBA y Estándares",
    "Los referentes oficiales de tu grado a la mano, con su fuente, y busca por lo que quieres enseñar.",
  ],
  [
    "En el celular",
    "Se instala como una aplicación y te avisa cuando el material está listo, aunque la tengas cerrada.",
  ],
];

const FAQ = [
  [
    "¿Cuánto cuesta?",
    "Puedes empezar gratis. Hoy cada docente puede crear hasta 10 recursos con IA al día.",
  ],
  [
    "¿La IA reemplaza mi criterio?",
    "No. La IA propone y tú decides: nada queda guardado sin tu revisión, y puedes editar o volver a pedir cada pregunta o actividad.",
  ],
  [
    "¿De dónde salen los DBA y Estándares?",
    "De los documentos oficiales del Ministerio de Educación Nacional. Cada referencia muestra su fuente.",
  ],
  [
    "¿Puedo usar el formato de mi colegio?",
    "Sí. Subes el formato en Word y los talleres salen con su encabezado y sus secciones. El colegio también puede subir uno institucional y su logo.",
  ],
  [
    "¿Qué datos de mis estudiantes necesita Profe?",
    "Ninguno. Profe trabaja con tus cursos y temas; te pedimos no escribir nombres ni datos de estudiantes en las indicaciones.",
  ],
  [
    "¿Tengo que instalar algo?",
    "No. Funciona en el navegador del computador o del celular, y si quieres lo agregas a la pantalla de inicio.",
  ],
];

/** Hoja de planeación de ejemplo: el DBA baja a un objetivo y el objetivo a un taller. */
function PlanningSheet() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md lg:mr-0">
      <div className="absolute -top-5 -right-3 z-10 rotate-3 rounded-sm bg-highlight px-4 py-2.5 shadow-lift sm:-right-6">
        <span className="block font-mono text-[10px] tracking-[0.18em] text-foreground/70 uppercase">
          Quiz
        </span>
        <span className="block text-sm font-extrabold text-foreground">
          Versiones A · B · C · D
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-lift">
        <div className="flex items-center justify-between border-b border-dashed border-border px-5 py-3">
          <span className="font-display text-lg font-semibold">Planeación · Periodo 1</span>
          <span className="rounded-full bg-tint-1 px-2.5 py-0.5 text-xs font-bold text-tint-1-fg">
            Mat. 6°
          </span>
        </div>
        <div className="flex flex-col gap-1 p-5">
          <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            DBA 1 · MEN
          </p>
          <p className="text-sm leading-snug">
            Interpreta los números enteros y racionales […] en diferentes contextos…
          </p>
          <HiOutlineArrowDown className="my-2 size-4 text-brand-from" />
          <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Objetivo
          </p>
          <p className="text-sm leading-snug">
            Ubicar números enteros en la recta a partir de temperaturas de ciudades de Colombia.
          </p>
          <HiOutlineArrowDown className="my-2 size-4 text-brand-from" />
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-sm font-extrabold">Taller · La recta numérica</p>
            <ol className="mt-2 flex flex-col gap-1.5 text-sm">
              {[
                ["Inicio", "¿Qué hace más frío: −2 °C en el páramo o 3 °C en Tunja?"],
                ["Desarrollo", "Ubica seis temperaturas en la recta."],
                ["Cierre", "Explica qué es el opuesto de un número."],
              ].map(([m, t]) => (
                <li key={m} className="flex gap-2">
                  <span className="w-20 shrink-0 text-xs font-bold text-brand-strong">{m}</span>
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-6 -left-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lift sm:-left-8">
        <span className="block font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Descarga
        </span>
        <span className="block text-sm font-extrabold">Word · PDF · con tu logo</span>
      </div>
      <p className="mt-10 text-right font-mono text-[11px] text-muted-foreground">
        Planeación de ejemplo
      </p>
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-xs tracking-[0.2em] text-brand-strong uppercase", className)}>
      {children}
    </p>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Profe, inicio">
            <ProfeLogo size={32} />
          </Link>
          <nav aria-label="Secciones" className="hidden flex-1 justify-center gap-7 md:flex">
            {[
              ["#como-funciona", "Cómo funciona"],
              ["#herramientas", "Herramientas"],
              ["#colegios", "Colegios"],
              ["#preguntas", "Preguntas"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
              Ingresar
            </Link>
            <Link href="/register" className={buttonVariants()}>
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero ------------------------------------------------------------------------------- */}
        <section className="border-b border-border bg-ruled">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-4 pt-14 pb-20 sm:px-6 sm:pl-16 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-24">
            <div className="flex flex-col gap-7">
              <SectionLabel>Para docentes de Colombia · alineado con el MEN</SectionLabel>
              <h1 className="font-display text-[2.6rem] leading-[1.05] font-semibold sm:text-6xl">
                IA para docentes: del DBA a la clase del lunes,{" "}
                <em className="mark-highlight">sin gastarse el domingo.</em>
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Le dices a Profe qué vas a enseñar y a qué curso. Él busca los DBA oficiales de ese
                grado y te entrega el taller, el quiz, el examen o la planeación del periodo,{" "}
                <strong className="font-semibold text-foreground">
                  listos para revisar y descargar en Word
                </strong>{" "}
                con el formato de tu colegio.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/register" className={buttonVariants({ variant: "brand", size: "xl" })}>
                  Empieza gratis
                  <HiOutlineArrowRight aria-hidden />
                </Link>
                <a
                  href="#como-funciona"
                  className={buttonVariants({ variant: "outline", size: "xl" })}
                >
                  Ver cómo funciona
                </a>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                Sin tarjeta · funciona en el celular · tú apruebas todo
              </p>
            </div>
            <PlanningSheet />
          </div>
        </section>

        {/* ¿Te suena? ------------------------------------------------------------------------- */}
        <section aria-labelledby="pains-title">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex max-w-2xl flex-col gap-3">
              <SectionLabel>¿Te suena?</SectionLabel>
              <h2 id="pains-title" className="font-display text-3xl font-semibold sm:text-4xl">
                Enseñar te encanta. Lo que cansa es todo lo que hay que preparar
              </h2>
              <p className="text-lg text-muted-foreground">
                Entre clases, reuniones y calificar, el material se termina haciendo de noche y en
                fines de semana. Profe se encarga de esa parte para que tú llegues al salón a
                enseñar.
              </p>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2">
              {PAINS.map(({ pain, answer, tone, tilt }) => (
                <li
                  key={pain}
                  className={cn(
                    "flex flex-col rounded-sm p-6 shadow-lift transition-transform hover:rotate-0",
                    tone,
                    tilt,
                  )}
                >
                  <p className="font-display text-xl leading-snug text-foreground italic">
                    “{pain}”
                  </p>
                  <p className="mt-5 border-t border-foreground/15 pt-4 text-[0.95rem] text-foreground">
                    <span className="font-bold">Con Profe: </span>
                    {answer}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Cómo funciona: el tablero ---------------------------------------------------------- */}
        <section
          id="como-funciona"
          aria-labelledby="how-title"
          className="scroll-mt-20 px-3 sm:px-6"
        >
          <div className="mx-auto w-full max-w-6xl rounded-2xl border-[10px] border-b-[18px] border-tint-3-fg/80 bg-board px-5 py-12 shadow-lift sm:px-10 lg:py-16">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
              <div className="flex flex-col gap-3">
                <SectionLabel className="text-highlight">Cómo funciona la IA de Profe</SectionLabel>
                <h2
                  id="how-title"
                  className="font-display text-3xl font-semibold text-chalk sm:text-4xl"
                >
                  Del DBA a tu material, en cinco pasos
                </h2>
              </div>
              <p className="text-chalk/75">
                No es un chat que escribe lo primero que se le ocurre. Cada pedido pasa por las
                mismas cinco estaciones, y en dos de ellas mandas tú: al pedir y al decidir.
              </p>
            </div>
            <div className="mt-10">
              <AiFlow />
            </div>
          </div>
        </section>

        {/* Por qué no un chat cualquiera ------------------------------------------------------ */}
        <section aria-labelledby="versus-title">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex max-w-2xl flex-col gap-3">
              <SectionLabel>¿Y por qué no un chat de IA?</SectionLabel>
              <h2 id="versus-title" className="font-display text-3xl font-semibold sm:text-4xl">
                Un chat te da texto. Profe te da la clase lista
              </h2>
              <p className="text-lg text-muted-foreground">
                Si ya has probado pedirle un taller a un chat, sabes que el trabajo empieza después:
                revisar, corregir, pasarlo a Word. Esta es la diferencia.
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="hidden grid-cols-2 bg-surface font-mono text-xs tracking-[0.15em] uppercase sm:grid">
                <span className="px-6 py-3 text-muted-foreground">Un chat de IA cualquiera</span>
                <span className="border-l border-border px-6 py-3 text-brand-strong">Profe</span>
              </div>
              <ul>
                {VERSUS.map(([chat, profe]) => (
                  <li
                    key={chat}
                    className="grid border-t border-border first:border-t-0 sm:grid-cols-2 sm:first:border-t"
                  >
                    <span className="flex gap-3 px-6 py-4 text-muted-foreground">
                      <span aria-hidden className="text-brand-from">
                        ✕
                      </span>
                      {chat}
                    </span>
                    <span className="flex gap-3 border-border bg-brand-softer px-6 py-4 font-medium sm:border-l">
                      <span aria-hidden className="text-success">
                        ✓
                      </span>
                      {profe}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="max-w-3xl text-muted-foreground">
              <strong className="text-foreground">Y la última palabra siempre es tuya.</strong> Nada
              se guarda sin tu visto bueno, no necesita nombres ni datos de tus estudiantes, y cada
              pregunta o actividad se puede editar o volver a pedir. Cuando calificas lo que te
              entrega, Profe lo tiene en cuenta para lo siguiente.
            </p>
          </div>
        </section>

        {/* Herramientas ----------------------------------------------------------------------- */}
        <section
          id="herramientas"
          aria-labelledby="tools-title"
          className="scroll-mt-20 border-t border-border bg-ruled"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:pl-16 lg:grid-cols-[1fr_1.4fr] lg:py-24">
            <div className="flex flex-col gap-3 lg:sticky lg:top-24 lg:h-fit">
              <SectionLabel>Herramientas</SectionLabel>
              <h2 id="tools-title" className="font-display text-3xl font-semibold sm:text-4xl">
                Todo lo que preparas para tus clases, en un solo lugar
              </h2>
              <p className="text-muted-foreground">
                Cada herramienta parte de tu curso y tu planeación, así el material queda conectado
                con lo que enseñas y no tienes que explicar dos veces.
              </p>
            </div>
            <ul className="flex flex-col rounded-xl border border-border bg-card px-6 shadow-soft">
              {TOOLS.map(([title, text], i) => (
                <li
                  key={title}
                  className="grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-1 border-b border-dashed border-border py-5 last:border-b-0"
                >
                  <span className="font-mono text-sm text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="col-start-2 text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Colegios --------------------------------------------------------------------------- */}
        <section
          id="colegios"
          aria-labelledby="schools-title"
          className="scroll-mt-20 border-t border-border bg-surface"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div className="flex flex-col gap-4">
              <SectionLabel>Para colegios</SectionLabel>
              <h2 id="schools-title" className="font-display text-3xl font-semibold sm:text-4xl">
                Lleva Profe a todo tu equipo docente
              </h2>
              <p className="text-muted-foreground">
                Rectoría y coordinación reciben material con la misma presentación, alineado con los
                DBA y a tiempo. Registra tu colegio, organiza tus sedes e invita a tus profesores
                con un enlace.
              </p>
              <div>
                <Link href="/register" className={buttonVariants({ size: "lg" })}>
                  Registrar mi colegio
                  <HiOutlineArrowRight aria-hidden />
                </Link>
              </div>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {[
                {
                  icon: HiOutlineBuildingLibrary,
                  t: "Sedes",
                  d: "Varias sedes en un mismo colegio.",
                },
                {
                  icon: HiOutlineUserGroup,
                  t: "Invitaciones",
                  d: "Tus profesores entran con un enlace.",
                },
                {
                  icon: HiOutlineDocumentText,
                  t: "Formato institucional",
                  d: "Un formato y un logo para todos.",
                },
                {
                  icon: HiOutlineShieldCheck,
                  t: "Datos separados",
                  d: "Cada colegio ve solo lo suyo.",
                },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex flex-col gap-2 bg-card p-5">
                  <Icon className="size-6 text-brand" aria-hidden />
                  <span className="font-bold">{t}</span>
                  <span className="text-sm text-muted-foreground">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Preguntas -------------------------------------------------------------------------- */}
        <section id="preguntas" aria-labelledby="faq-title" className="scroll-mt-20">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6 lg:py-24">
            <h2 id="faq-title" className="font-display text-3xl font-semibold sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <div className="flex flex-col border-t border-border">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group border-b border-border py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                    {q}
                    <span
                      aria-hidden
                      className="font-mono text-xl text-brand-from transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Cierre ----------------------------------------------------------------------------- */}
        <section aria-labelledby="cta-title" className="border-t border-border bg-ruled">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:pl-16">
            <h2
              id="cta-title"
              className="max-w-3xl font-display text-4xl font-semibold sm:text-5xl"
            >
              Prueba con el tema que vas a dar <span className="mark-highlight">esta semana.</span>
            </h2>
            <p className="max-w-xl text-lg text-muted-foreground">
              Crea tu cuenta, agrega tu curso y pide tu primer taller. En pocos minutos sabrás si
              Profe te ahorra el domingo. Es gratis.
            </p>
            <Link href="/register" className={buttonVariants({ size: "xl" })}>
              Crear mi cuenta gratis
              <HiOutlineArrowRight aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
          <p>
            &copy; {new Date().getFullYear()} Profe &middot; Todos los derechos reservados &middot;
            by{" "}
            <a
              href="https://nubitech.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground transition hover:text-brand-strong"
            >
              Nubitech
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
