import { z } from "zod";

// SPEC-0023 / ADR-0018: figuras como datos. El AI Engine las valida; aquí se valida otra vez al
// guardar (el contenido puede venir del editor) y `svg.ts` las dibuja.

const label = z.string().max(40);

export const figureSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("NUMBER_LINE"),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    marks: z.array(z.object({ value: z.number(), label: label.default("") })).max(6),
  }),
  z.object({
    kind: z.literal("BAR_CHART"),
    title: z.string().max(80).default(""),
    categories: z.array(label).min(2).max(8),
    values: z.array(z.number().min(0).max(1_000_000)).min(2).max(8),
    unit: z.string().max(20).default(""),
  }),
  z.object({
    kind: z.literal("TABLE"),
    headers: z.array(label).min(2).max(5),
    rows: z.array(z.array(label)).min(1).max(8),
  }),
  z.object({
    kind: z.literal("FRACTION"),
    numerator: z.number().int().min(0),
    denominator: z.number().int().min(2).max(12),
    shape: z.enum(["CIRCLE", "BAR"]).default("BAR"),
  }),
  z.object({
    kind: z.literal("RECTANGLE"),
    width: z.number().positive().max(1000),
    height: z.number().positive().max(1000),
    unit: z.string().max(10).default(""),
  }),
]);
export type Figure = z.output<typeof figureSchema>;
