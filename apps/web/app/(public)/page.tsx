import Link from "next/link";
import type { IconType } from "react-icons";
import {
  HiCheckCircle,
  HiOutlineArrowDownTray,
  HiOutlineArrowRight,
  HiOutlineBookOpen,
  HiOutlineBuildingLibrary,
  HiOutlineCalendarDays,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClipboardDocumentList,
  HiOutlineDocumentText,
  HiOutlinePencilSquare,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { ProfeLogo, ProfeMark } from "@/components/brand/profe-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Landing pública (SPEC-0012 §2). RN-05: sin cifras ni testimonios inventados; la confianza se
// construye con hechos verificables. RN-06: lo que no existe aparece como "Próximamente".

type Tool = { icon: IconType; title: string; text: string; soon?: boolean };

const TOOLS: Tool[] = [
  {
    icon: HiOutlineCalendarDays,
    title: "Planeación por periodos",
    text: "Organiza el año en periodos, unidades y temas. La IA te sugiere objetivos alineados con los DBA.",
  },
  {
    icon: HiOutlinePencilSquare,
    title: "Talleres con IA",
    text: "Actividades por momentos (inicio, desarrollo, cierre u otras) listas para revisar y llevar a clase.",
  },
  {
    icon: HiOutlineClipboardDocumentCheck,
    title: "Quices con clave",
    text: "Preguntas con su respuesta y justificación, y hasta cuatro versiones para evitar la copia.",
  },
  {
    icon: HiOutlineArrowDownTray,
    title: "Word y PDF",
    text: "Descarga la hoja del estudiante y la clave aparte, con el logo de tu colegio.",
  },
  {
    icon: HiOutlineDocumentText,
    title: "Tu propio formato",
    text: "Sube tu formato de taller en Word: Profe respeta tu encabezado y tus secciones.",
  },
  {
    icon: HiOutlineBookOpen,
    title: "DBA y Estándares",
    text: "Consulta los referentes oficiales del MEN de tu grado y busca por lo que quieres enseñar.",
  },
  {
    icon: HiOutlineClipboardDocumentList,
    title: "Exámenes",
    text: "De unidad o de periodo, por secciones y con puntaje: emparejamiento, preguntas abiertas con criterios, conversión a nota y hoja de respuestas.",
  },
];

const TRUST = [
  "Alineado con los DBA y Estándares del MEN",
  "Tú revisas todo antes de usarlo",
  "Descarga en Word y PDF",
];

const STEPS = [
  {
    title: "Crea tu curso",
    text: "Asignatura, grado y grupo. Profe carga los DBA y Estándares que corresponden.",
  },
  {
    title: "Elige un tema",
    text: "De tu planeación o uno nuevo. Ajusta cantidad, dificultad y duración si quieres.",
  },
  {
    title: "Revisa y descarga",
    text: "La IA prepara el material en segundos; tú lo editas, lo calificas y lo descargas.",
  },
];

const FAQ = [
  {
    q: "¿Cuánto cuesta?",
    a: "Puedes empezar gratis. Hoy cada docente puede crear hasta 10 recursos con IA al día.",
  },
  {
    q: "¿La IA reemplaza mi criterio?",
    a: "No. La IA propone y tú decides: nada queda listo sin tu revisión, y puedes editar o regenerar cada pregunta o actividad.",
  },
  {
    q: "¿De dónde salen los DBA y Estándares?",
    a: "De los documentos oficiales del Ministerio de Educación Nacional. Cada referencia muestra su fuente y su página.",
  },
  {
    q: "¿Puedo usar el formato de mi colegio?",
    a: "Sí. Subes el formato en Word y los talleres salen con su encabezado y sus secciones. El colegio también puede subir uno institucional y su logo.",
  },
  {
    q: "¿Qué datos de mis estudiantes necesita Profe?",
    a: "Ninguno. Profe trabaja con tus cursos y temas; te pedimos no escribir nombres ni datos de estudiantes en las indicaciones.",
  },
];

function ProductPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-xl lg:mx-0">
      <div className="absolute -top-6 -left-6 hidden rounded-2xl border border-border bg-card px-4 py-2.5 shadow-lift sm:flex sm:items-center sm:gap-2">
        <HiOutlineSparkles className="text-brand" />
        <span className="text-sm font-bold">Taller listo en segundos</span>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted px-4 py-3">
          <span className="size-2.5 rounded-full bg-brand-from" />
          <span className="size-2.5 rounded-full bg-brand-via" />
          <span className="size-2.5 rounded-full bg-brand-to" />
          <span className="ml-3 rounded-md bg-card px-3 py-0.5 text-xs text-muted-foreground">
            profe · Crear taller
          </span>
        </div>
        <div className="grid grid-cols-[96px_1fr] sm:grid-cols-[132px_1fr]">
          <div className="flex flex-col gap-2 border-r border-border p-3">
            <ProfeMark size={28} />
            <span className="mt-2 h-7 rounded-lg bg-brand-gradient" />
            {["w-16", "w-20", "w-14", "w-[4.5rem]"].map((w, i) => (
              <span
                key={w}
                className={cn("h-2.5 rounded-full", i === 1 ? "bg-brand" : "bg-muted", w)}
              />
            ))}
          </div>
          <div className="flex flex-col gap-3 p-4">
            <span className="text-xs font-bold text-brand-strong">Matemáticas · 6° · 601</span>
            <span className="text-base font-extrabold">Taller: La recta numérica</span>
            {[
              { m: "Inicio", t: "¿Qué temperatura hace en Bogotá y en Tunja?" },
              { m: "Desarrollo", t: "Ubica los números enteros en la recta." },
              { m: "Cierre", t: "Explica con tus palabras qué es un opuesto." },
            ].map(({ m, t }) => (
              <div key={m} className="rounded-xl border border-border p-3">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-strong">
                  {m}
                </span>
                <p className="mt-1.5 text-sm">{t}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <span className="rounded-lg bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                DBA 1
              </span>
              <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                Word · PDF
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Profe, inicio">
            <ProfeLogo size={34} />
          </Link>
          <nav aria-label="Secciones" className="hidden flex-1 items-center gap-1 md:flex">
            {[
              ["#herramientas", "Herramientas"],
              ["#como-funciona", "Cómo funciona"],
              ["#colegios", "Colegios"],
              ["#preguntas", "Preguntas"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-brand-soft hover:text-brand-strong"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
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
        <section className="bg-hero">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div className="flex flex-col gap-6">
              <span className="flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold shadow-soft">
                <span className="size-2 rounded-full bg-brand-via" aria-hidden />
                Hecho para docentes de Colombia
              </span>
              <h1 className="text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-6xl">
                <span className="text-brand-gradient">IA para docentes:</span> planea, crea y evalúa
                en minutos
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Talleres, quices y planeación alineados con los DBA y Estándares del MEN. La IA
                propone; tú revisas y decides. Descarga en Word y PDF con tu formato.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/register" className={buttonVariants({ variant: "brand", size: "xl" })}>
                  Empieza gratis
                  <HiOutlineArrowRight aria-hidden />
                </Link>
                <a
                  href="#herramientas"
                  className={buttonVariants({ variant: "outline", size: "xl" })}
                >
                  Ver herramientas
                </a>
              </div>
              <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5">
                {TRUST.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm font-semibold">
                    <HiCheckCircle className="size-5 shrink-0 text-success" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section id="herramientas" aria-labelledby="tools-title" className="scroll-mt-20">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="text-sm font-bold text-brand-strong">Herramientas</p>
              <h2 id="tools-title" className="text-3xl font-extrabold sm:text-4xl">
                Todo lo que preparas para tus clases, en un solo lugar
              </h2>
              <p className="text-muted-foreground">
                Cada herramienta parte de tu curso y tu planeación, así el material queda conectado
                con lo que enseñas.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map(({ icon: Icon, title, text, soon }) => (
                <li
                  key={title}
                  className={cn(
                    "flex flex-col gap-3 rounded-3xl border p-6",
                    soon
                      ? "border-dashed border-border bg-muted/50"
                      : "border-border bg-card shadow-soft",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-2xl",
                      soon ? "bg-muted text-muted-foreground" : "bg-brand-soft text-brand-strong",
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    {title}
                    {soon && (
                      <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold text-muted-foreground ring-1 ring-border">
                        Próximamente
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="how-title" className="scroll-mt-20 bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="text-sm font-bold text-brand-strong">Cómo funciona</p>
              <h2 id="how-title" className="text-3xl font-extrabold sm:text-4xl">
                De tu tema a un material listo, en tres pasos
              </h2>
            </div>
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 shadow-soft"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-gradient text-lg font-extrabold text-white">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="colegios" aria-labelledby="schools-title" className="scroll-mt-20">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid gap-10 rounded-[2rem] border border-brand-border bg-hero p-8 shadow-soft sm:p-12 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <p className="flex items-center gap-2 text-sm font-bold text-brand-strong">
                  <HiOutlineBuildingLibrary aria-hidden />
                  Para colegios
                </p>
                <h2 id="schools-title" className="text-3xl font-extrabold sm:text-4xl">
                  Lleva Profe a todo tu equipo docente
                </h2>
                <p className="text-muted-foreground">
                  Registra tu colegio, organiza tus sedes e invita a tus profesores con un enlace.
                  Todos crean material con el formato y el logo de la institución.
                </p>
                <div>
                  <Link href="/register" className={buttonVariants({ size: "lg" })}>
                    Registrar mi colegio
                    <HiOutlineArrowRight aria-hidden />
                  </Link>
                </div>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
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
                    d: "Un formato de taller para todos.",
                  },
                  {
                    icon: HiOutlineShieldCheck,
                    t: "Datos separados",
                    d: "Cada colegio ve solo lo suyo.",
                  },
                ].map(({ icon: Icon, t, d }) => (
                  <li
                    key={t}
                    className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
                  >
                    <Icon className="size-6 text-brand" aria-hidden />
                    <span className="font-bold">{t}</span>
                    <span className="text-sm text-muted-foreground">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="preguntas" aria-labelledby="faq-title" className="scroll-mt-20 bg-surface">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6 lg:py-24">
            <h2 id="faq-title" className="text-center text-3xl font-extrabold sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <div className="flex flex-col gap-3">
              {FAQ.map(({ q, a }) => (
                <details
                  key={q}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-soft"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                    {q}
                    <HiOutlineArrowRight
                      className="size-4 shrink-0 text-brand transition group-open:rotate-90"
                      aria-hidden
                    />
                  </summary>
                  <p className="mt-3 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-title">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <div className="flex flex-col items-center gap-5 rounded-[2rem] bg-brand-gradient px-6 py-14 text-center text-white shadow-lift">
              <h2 id="cta-title" className="max-w-2xl text-3xl font-extrabold sm:text-4xl">
                Tu próximo taller puede estar listo antes de terminar el café
              </h2>
              <p className="max-w-xl text-white/90">
                Crea tu cuenta, agrega tu curso y prueba con un tema que vayas a enseñar esta
                semana.
              </p>
              <Link href="/register" className={buttonVariants({ variant: "inverse", size: "xl" })}>
                Crear mi cuenta gratis
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <ProfeLogo size={28} />
          <p>Hecho en Colombia para docentes · © {new Date().getFullYear()} Profe</p>
          <div className="flex gap-4">
            <Link href="/login" className="font-semibold hover:text-foreground">
              Ingresar
            </Link>
            <Link href="/register" className="font-semibold hover:text-foreground">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
