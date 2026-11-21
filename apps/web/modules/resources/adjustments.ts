import { z } from "zod";
import {
  DIFFICULTIES,
  ITEM_COUNT_LIMITS,
  type Blueprint,
  type Difficulty,
  type ResourceType,
} from "./schemas";
import type { ResourceContent } from "./types";

// SPEC-0027: ajustes rápidos con botones. Códigos fijos del producto; el texto que recibe la IA vive
// en el anexo `adjust.v1` del AI Engine. Este archivo es puro y se usa en el navegador y el servidor.

export const RESOURCE_ADJUSTMENTS = [
  "EASIER",
  "HARDER",
  "SHORTER",
  "EVERYDAY_EXAMPLES",
  "ADD_ITEMS",
] as const;
export type ResourceAdjustment = (typeof RESOURCE_ADJUSTMENTS)[number];

export const ITEM_ADJUSTMENTS = ["EASIER", "ANOTHER", "CLEARER"] as const;
export type ItemAdjustment = (typeof ITEM_ADJUSTMENTS)[number];

export const RESOURCE_ADJUSTMENT_LABELS: Record<ResourceAdjustment, string> = {
  EASIER: "Más fácil",
  HARDER: "Más difícil",
  SHORTER: "Más corto",
  EVERYDAY_EXAMPLES: "Más ejemplos de la vida diaria",
  ADD_ITEMS: "Agregar 2",
};

/** "Agregar 2 preguntas" o "Agregar 2 actividades", según el tipo. */
export function adjustmentLabel(code: ResourceAdjustment, type: ResourceType): string {
  if (code !== "ADD_ITEMS") return RESOURCE_ADJUSTMENT_LABELS[code];
  return type === "WORKSHOP" ? "Agregar 2 actividades" : "Agregar 2 preguntas";
}

export function itemAdjustmentLabel(code: ItemAdjustment, kind: "question" | "activity"): string {
  if (code === "EASIER") return "Más fácil";
  if (code === "CLEARER") return "Mejor redactada";
  return kind === "activity" ? "Otra actividad" : "Otra pregunta";
}

export const requestAdjustmentSchema = z.object({
  resourceId: z.string().min(1),
  adjustment: z.enum(RESOURCE_ADJUSTMENTS),
});
export const decideAdjustmentSchema = z.object({
  adjustmentId: z.string().min(1),
  accept: z.boolean(),
});

/** Cantidad de preguntas o actividades del contenido actual (lo que el docente ve). */
export function itemCount(data: ResourceContent): number {
  switch (data.type) {
    case "QUIZ":
      return data.content.questions.length;
    case "WORKSHOP":
      return data.content.moments.reduce((n, m) => n + m.activities.length, 0);
    case "EXAM":
      return data.content.sections.reduce((n, s) => n + s.questions.length, 0);
    case "LESSON_PLAN":
      return data.content.sessions.length;
  }
}

/** Mínimo de actividades del taller: una por momento o sección de actividades. */
function minItems(data: ResourceContent): number {
  if (data.type === "WORKSHOP") {
    return Math.max(ITEM_COUNT_LIMITS.WORKSHOP.min, data.content.moments.length);
  }
  return data.type === "QUIZ" ? ITEM_COUNT_LIMITS.QUIZ.min : 1;
}

/** §2: qué botones tiene cada tipo. El examen no cambia de tamaño (los puntos suman 100). */
export function availableAdjustments(data: ResourceContent): ResourceAdjustment[] {
  const n = itemCount(data);
  return RESOURCE_ADJUSTMENTS.filter((code) => {
    if (data.type === "EXAM") return code !== "SHORTER" && code !== "ADD_ITEMS";
    if (code === "ADD_ITEMS") {
      if (data.type === "LESSON_PLAN") return false;
      return n + 2 <= ITEM_COUNT_LIMITS[data.type].max;
    }
    return true;
  });
}

const shift = (d: Difficulty, by: -1 | 1): Difficulty =>
  DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, Math.max(0, DIFFICULTIES.indexOf(d) + by))]!;

/**
 * El blueprint con el que se pide el ajuste: parte de lo que el docente tiene hoy (cantidad de
 * ítems del contenido actual) y cambia lo que el ajuste pide. Los validadores del AI Engine hacen
 * cumplir la cantidad y la dificultad.
 */
export function adjustedBlueprint(
  blueprint: Blueprint,
  data: ResourceContent,
  code: ResourceAdjustment,
): Blueprint {
  const difficulty =
    code === "EASIER"
      ? shift(blueprint.difficulty, -1)
      : code === "HARDER"
        ? shift(blueprint.difficulty, 1)
        : blueprint.difficulty;
  if (blueprint.type === "EXAM") return { ...blueprint, difficulty };
  if (blueprint.type === "LESSON_PLAN") {
    return { ...blueprint, difficulty, sessions: itemCount(data) };
  }
  const n = itemCount(data);
  const limits = ITEM_COUNT_LIMITS[blueprint.type];
  const target =
    code === "SHORTER"
      ? Math.max(minItems(data), n - Math.max(1, Math.round(n * 0.3)))
      : code === "ADD_ITEMS"
        ? Math.min(limits.max, n + 2)
        : n;
  return {
    ...blueprint,
    difficulty,
    itemCount: Math.min(limits.max, Math.max(limits.min, target)),
  };
}

/**
 * La versión actual que se envía a la IA: sin identificadores internos ni marcas del producto,
 * para no gastar tokens en lo que la IA no usa.
 */
export function adjustmentCurrent(data: ResourceContent): unknown {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== "id" && key !== "answerCheck")
          .map(([key, v]) => [key, strip(v)]),
      );
    }
    return value;
  };
  return strip(data.content);
}
