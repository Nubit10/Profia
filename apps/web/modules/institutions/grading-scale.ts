import { z } from "zod";

// Escala de valoración del espacio (SPEC-0024 RN-04, ADR-0019; Decreto 1290). Sin dependencias de
// servidor: el mismo schema valida el formulario y el servidor, y lo leen resources y documents.

export const PERFORMANCE_LEVELS = ["LOW", "BASIC", "HIGH", "SUPERIOR"] as const;
export type PerformanceLevel = (typeof PERFORMANCE_LEVELS)[number];
export const PERFORMANCE_LABELS: Record<PerformanceLevel, string> = {
  LOW: "Bajo",
  BASIC: "Básico",
  HIGH: "Alto",
  SUPERIOR: "Superior",
};

export const SCALE_MAXIMUMS = [5, 10, 100] as const;
export type ScaleMax = (typeof SCALE_MAXIMUMS)[number];

const band = z.object({
  from: z.number({ error: "Escribe el número" }),
  to: z.number({ error: "Escribe el número" }),
});

export const BANDS_ERROR = "Los rangos deben ir seguidos, de Bajo a Superior, sin huecos";

/** Paso de la escala: una cifra decimal en la de 5; enteros en las de 10 y 100. */
export const scaleStep = (max: number) => (max === 5 ? 0.1 : 1);

const onStep = (v: number, step: number) => Math.abs(Math.round(v / step) * step - v) < 1e-6;
const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

export const gradingBandsSchema = z
  .object({
    min: z
      .number({ error: "Escribe la nota mínima" })
      .min(0, "La nota mínima no puede ser negativa"),
    max: z
      .number({ error: "Escribe la nota máxima" })
      .refine(
        (v) => (SCALE_MAXIMUMS as readonly number[]).includes(v),
        "La nota máxima es 5, 10 o 100",
      ),
    bands: z.object({
      LOW: band,
      BASIC: band,
      HIGH: band,
      SUPERIOR: band,
    }),
  })
  .superRefine((s, ctx) => {
    if (s.min >= s.max) {
      ctx.addIssue({
        code: "custom",
        path: ["min"],
        message: "La nota mínima debe ser menor que la máxima",
      });
      return;
    }
    const step = scaleStep(s.max);
    const values = [s.min, ...PERFORMANCE_LEVELS.flatMap((l) => [s.bands[l].from, s.bands[l].to])];
    if (values.some((v) => !onStep(v, step))) {
      ctx.addIssue({
        code: "custom",
        path: ["bands"],
        message: step < 1 ? "Usa máximo un decimal" : "En esta escala las notas son enteras",
      });
      return;
    }
    let expected = s.min;
    for (const level of PERFORMANCE_LEVELS) {
      const { from, to } = s.bands[level];
      if (!same(from, expected) || to < from || to > s.max) {
        ctx.addIssue({ code: "custom", path: ["bands", level], message: BANDS_ERROR });
        return;
      }
      expected = Math.round((to + step) * 10) / 10;
    }
    if (!same(s.bands.SUPERIOR.to, s.max)) {
      ctx.addIssue({ code: "custom", path: ["bands", "SUPERIOR"], message: BANDS_ERROR });
    }
  });
export type GradingBands = z.output<typeof gradingBandsSchema>;

/** La nacional más usada (SPEC-0024 §2). */
export const DEFAULT_GRADING_BANDS: GradingBands = {
  min: 1,
  max: 5,
  bands: {
    LOW: { from: 1, to: 2.9 },
    BASIC: { from: 3, to: 3.9 },
    HIGH: { from: 4, to: 4.5 },
    SUPERIOR: { from: 4.6, to: 5 },
  },
};

/** Lee la escala guardada; si no hay o está dañada, la predeterminada. */
export function parseGradingBands(value: unknown): GradingBands {
  const parsed = gradingBandsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_GRADING_BANDS;
}

/** Nota en formato colombiano: "4,6" en la escala de 5; "8" en las de 10 y 100. */
export function formatScore(value: number, max: number): string {
  return scaleStep(max) < 1
    ? value.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : String(Math.round(value));
}

/** "4,6 – 5,0" */
export function bandRange(scale: GradingBands, level: PerformanceLevel): string {
  const { from, to } = scale.bands[level];
  return `${formatScore(from, scale.max)} – ${formatScore(to, scale.max)}`;
}

/** Propuesta de rangos al cambiar de escala (el docente la ajusta): reparte en proporción a la nacional. */
export function suggestedBands(max: ScaleMax): GradingBands {
  if (max === 5) return DEFAULT_GRADING_BANDS;
  if (max === 10) {
    return {
      min: 1,
      max: 10,
      bands: {
        LOW: { from: 1, to: 5 },
        BASIC: { from: 6, to: 7 },
        HIGH: { from: 8, to: 9 },
        SUPERIOR: { from: 10, to: 10 },
      },
    };
  }
  return {
    min: 0,
    max: 100,
    bands: {
      LOW: { from: 0, to: 59 },
      BASIC: { from: 60, to: 79 },
      HIGH: { from: 80, to: 89 },
      SUPERIOR: { from: 90, to: 100 },
    },
  };
}
