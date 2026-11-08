"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HiOutlinePause, HiOutlinePlay } from "react-icons/hi2";
import { cn } from "@/lib/utils";

/*
 * Cómo trabaja la IA de Profe, dibujado "en tiza" sobre el tablero. Cada ejemplo recorre las
 * cinco estaciones reales del sistema: el pedido del docente, la búsqueda de los DBA oficiales
 * (AI Engine, búsqueda híbrida), la escritura con un prompt versionado, la revisión automática
 * (schema + validador pedagógico + reparación) y la decisión del docente. Todo es un ejemplo.
 * Escritorio: las cinco estaciones en fila. Celular: la misma historia como lista.
 */

type Check = { label: string; fixed?: string };
type Scenario = {
  tab: string;
  ask: { kind: string; course: string; topic: string };
  dba: { code: string; text: string; source: string };
  draft: string[];
  checks: Check[];
  result: { title: string; detail: string };
};

const SCENARIOS: Scenario[] = [
  {
    tab: "Taller",
    ask: { kind: "Taller", course: "Matemáticas · 6°", topic: "La recta numérica" },
    dba: {
      code: "DBA 1 · Matemáticas 6°",
      text: "Interpreta los números enteros y racionales […] con sus operaciones, en diferentes contextos…",
      source: "DBA Matemáticas v2 · MEN",
    },
    draft: [
      "Inicio · ¿Hace más frío a −2 °C o a 3 °C?",
      "Desarrollo · Ubica 6 temperaturas en la recta",
      "Cierre · ¿Qué es el opuesto de un número?",
    ],
    checks: [
      { label: "Es para 6° grado" },
      { label: "Cada actividad apunta al DBA" },
      { label: "Tiene inicio, desarrollo y cierre" },
    ],
    result: {
      title: "Taller listo para revisar",
      detail: "Word con tu formato · guía del docente",
    },
  },
  {
    tab: "Quiz",
    ask: { kind: "Quiz · 10 preguntas", course: "Lenguaje · 3°", topic: "La fábula" },
    dba: {
      code: "DBA 3 · Lenguaje 3°",
      text: "Reconoce algunas características de los textos narrativos, tales como el concepto de narrador y estructura narrativa…",
      source: "DBA Lenguaje v2 · MEN",
    },
    draft: [
      "1. ¿Quiénes son los personajes de la fábula?",
      "2. ¿Qué enseñanza nos deja?",
      "… 8 preguntas más con su clave",
    ],
    checks: [
      { label: "Una sola respuesta correcta", fixed: "La pregunta 4 tenía dos: se corrigió" },
      { label: "Lenguaje para niños de 8 años" },
      { label: "Clave con justificación" },
    ],
    result: { title: "Quiz en 4 versiones", detail: "A · B · C · D · clave aparte" },
  },
  {
    tab: "Examen",
    ask: { kind: "Examen de periodo", course: "Matemáticas · 9°", topic: "Funciones lineales" },
    dba: {
      code: "DBA 8 · Matemáticas 9°",
      text: "Utiliza expresiones numéricas, algebraicas o gráficas para hacer descripciones de situaciones concretas…",
      source: "DBA Matemáticas v2 · MEN",
    },
    draft: [
      "Sección A · Selección múltiple (20 pts)",
      "Sección B · Emparejamiento (10 pts)",
      "Sección C · Abiertas con criterios (20 pts)",
    ],
    checks: [
      { label: "Los puntajes suman 50" },
      { label: "Cubre todos los temas del periodo" },
      { label: "Cada abierta tiene criterios" },
    ],
    result: {
      title: "Examen con nota de 1,0 a 5,0",
      detail: "Hoja de respuestas · tabla de conversión",
    },
  },
  {
    tab: "Planeación",
    ask: { kind: "Planeación del periodo", course: "Transición", topic: "Periodo 1 · 10 semanas" },
    dba: {
      code: "DBA 2 · Transición",
      text: "Se apropia de hábitos y prácticas para el cuidado personal y de su entorno.",
      source: "DBA Transición · MEN",
    },
    draft: [
      "Unidad 1 · Quién soy y cómo me cuido",
      "Unidad 2 · Mi familia y mi escuela",
      "Temas con objetivo por cada DBA",
    ],
    checks: [
      { label: "Cada tema queda con su DBA" },
      { label: "Cabe en las semanas del periodo" },
      { label: "Nada se guarda sin tu visto bueno" },
    ],
    result: { title: "Periodo planeado", detail: "Unidades, temas y objetivos para aceptar" },
  },
];

const STATIONS = [
  { n: "01", title: "Tú pides", sub: "Qué, para quién y de qué tema" },
  { n: "02", title: "Busca el DBA", sub: "En los documentos del MEN" },
  { n: "03", title: "La IA escribe", sub: "Con tu grado y tu formato" },
  { n: "04", title: "Se revisa sola", sub: "Y corrige lo que falle" },
  { n: "05", title: "Tú decides", sub: "Editas, apruebas y descargas" },
];

const STEP_MS = 1500;
const LAST = STATIONS.length - 1;

const REDUCED = "(prefers-reduced-motion: reduce)";
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

function Station({ s, i, step }: { s: Scenario; i: number; step: number }) {
  if (i === 0)
    return (
      <>
        <p className="text-base font-bold text-chalk">{s.ask.kind}</p>
        <p className="text-sm text-chalk/70">{s.ask.course}</p>
        <p className="mt-2 font-display text-lg text-highlight italic">«{s.ask.topic}»</p>
      </>
    );
  if (i === 1)
    return (
      <>
        <p className="font-mono text-[11px] tracking-wider text-highlight uppercase">
          {s.dba.code}
        </p>
        <p className="mt-1 text-sm leading-snug text-chalk">{s.dba.text}</p>
        <p className="mt-2 text-xs text-chalk/55">Fuente: {s.dba.source}</p>
      </>
    );
  if (i === 2)
    return (
      <ul className="flex flex-col gap-1.5">
        {s.draft.map((d) => (
          <li
            key={d}
            className="border-b border-dashed border-chalk/20 pb-1.5 text-sm text-chalk/90"
          >
            {d}
          </li>
        ))}
      </ul>
    );
  if (i === 3)
    return (
      <ul className="flex flex-col gap-2">
        {s.checks.map((c) => (
          <li key={c.label} className="text-sm">
            <span className="flex gap-2 text-chalk">
              <span aria-hidden className={c.fixed ? "text-highlight" : "text-chalk/80"}>
                {c.fixed ? "↺" : "✓"}
              </span>
              {c.label}
            </span>
            {c.fixed && step >= 3 && (
              <span className="mt-0.5 block pl-5 text-xs text-highlight">{c.fixed}</span>
            )}
          </li>
        ))}
      </ul>
    );
  return (
    <>
      <p className="font-display text-lg leading-tight text-chalk">{s.result.title}</p>
      <p className="mt-1 text-sm text-chalk/70">{s.result.detail}</p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        {["Editar", "Regenerar una", "Aprobar"].map((a, k) => (
          <span
            key={a}
            className={cn(
              "rounded-full border px-2.5 py-1",
              k === 2
                ? "border-highlight bg-highlight font-bold text-foreground"
                : "border-chalk/30 text-chalk/80",
            )}
          >
            {a}
          </span>
        ))}
      </div>
    </>
  );
}

export function AiFlow() {
  const [scene, setScene] = useState(0);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(
      () => {
        if (step < LAST) setStep(step + 1);
        else {
          setStep(0);
          setScene((v) => (v + 1) % SCENARIOS.length);
        }
      },
      step === LAST ? STEP_MS * 2.4 : STEP_MS,
    );
    return () => clearTimeout(t);
  }, [step, paused, reduced]);

  const shown = reduced ? LAST : step;
  const s = SCENARIOS[scene];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-chalk/60">Mira un ejemplo:</span>
        {SCENARIOS.map((sc, i) => (
          <button
            key={sc.tab}
            type="button"
            onClick={() => {
              setScene(i);
              setStep(0);
            }}
            aria-pressed={i === scene}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm transition-colors",
              i === scene
                ? "border-highlight bg-highlight font-bold text-foreground"
                : "border-chalk/25 text-chalk/75 hover:border-chalk/60 hover:text-chalk",
            )}
          >
            {sc.tab}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Reanudar animación" : "Pausar animación"}
          className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-chalk/25 px-4 text-sm text-chalk/75 hover:text-chalk"
        >
          {paused ? <HiOutlinePlay aria-hidden /> : <HiOutlinePause aria-hidden />}
          {paused ? "Reanudar" : "Pausar"}
        </button>
      </div>

      {/* Escritorio: las cinco estaciones en fila, unidas por la línea de tiza. */}
      <div className="relative mt-10 hidden lg:block">
        <div
          aria-hidden
          className="absolute top-5 right-[10%] left-[10%] border-t-2 border-dashed border-chalk/25"
        />
        <div
          aria-hidden
          className="absolute top-5 left-[10%] border-t-2 border-highlight transition-all duration-700 ease-out"
          style={{ width: `${(shown / LAST) * 80}%` }}
        />
        <ol className="relative grid grid-cols-5 gap-4">
          {STATIONS.map((st, i) => {
            const on = i <= shown;
            return (
              <li key={st.n} className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border-2 font-mono text-sm transition-colors duration-300",
                    i === shown
                      ? "border-highlight bg-highlight font-bold text-foreground"
                      : on
                        ? "border-highlight bg-board text-highlight"
                        : "border-chalk/25 bg-board text-chalk/40",
                  )}
                >
                  {st.n}
                </span>
                <p
                  className={cn(
                    "mt-3 font-bold transition-colors",
                    on ? "text-chalk" : "text-chalk/45",
                  )}
                >
                  {st.title}
                </p>
                <p className="text-center text-xs text-chalk/50">{st.sub}</p>
                <div
                  className={cn(
                    "mt-4 min-h-52 w-full rounded-lg border p-4 transition-all duration-500",
                    on
                      ? "translate-y-0 border-chalk/25 bg-board-raised opacity-100"
                      : "translate-y-2 border-chalk/10 opacity-25",
                  )}
                >
                  <Station s={s} i={i} step={shown} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Celular y tableta: la misma historia como lista. */}
      <ol className="mt-8 flex flex-col gap-3 lg:hidden">
        {STATIONS.map((st, i) => (
          <li
            key={st.n}
            className={cn(
              "rounded-lg border p-4 transition-all duration-300",
              i <= shown
                ? "border-chalk/25 bg-board-raised opacity-100"
                : "border-chalk/10 opacity-35",
            )}
          >
            <p className="font-mono text-xs tracking-wider text-highlight uppercase">
              {st.n} · {st.title}
            </p>
            <div className="mt-2">
              <Station s={s} i={i} step={shown} />
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-right font-mono text-xs text-chalk/45">Ejemplos ilustrativos</p>
    </div>
  );
}
