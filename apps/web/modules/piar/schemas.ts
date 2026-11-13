import { z } from "zod";

// SPEC-0017: contenido del PIAR. RN-02: solo lo mínimo, y nunca diagnósticos. Todo se guarda
// cifrado (ADR-0015). El mismo schema valida el formulario y el servidor.

const longText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

export const MAX_PIAR_PERIODS = 6;

export const piarPeriodSchema = z.object({
  number: z.number().int().min(1).max(MAX_PIAR_PERIODS),
  name: z.string().trim().min(1).max(40),
  purpose: longText(800),
  curricular: longText(1500),
  didactic: longText(1500),
  evaluative: longText(1500),
  followUp: longText(800),
});
export type PiarPeriod = z.infer<typeof piarPeriodSchema>;

export const piarContentSchema = z.object({
  student: z.object({
    name: z.string().trim().min(1, "Escribe el nombre del estudiante").max(120),
    /** Opcional: algunos ajustes dependen de la edad. */
    age: z.number().int().min(3).max(25).nullable(),
    /** Decisión 3: si hay valoración o soporte externo y quién lo emitió; nunca el diagnóstico. */
    externalSupport: z.boolean(),
    supportIssuer: longText(120),
  }),
  learning: z.object({
    strengths: longText(1500),
    howLearnsBest: longText(1500),
  }),
  barriers: longText(1500),
  periods: z.array(piarPeriodSchema).max(MAX_PIAR_PERIODS),
  family: longText(1500),
});
export type PiarContent = z.infer<typeof piarContentSchema>;

export const createPiarSchema = z.object({
  courseId: z.string().min(1, "Elige el curso"),
  studentName: z.string().trim().min(1, "Escribe el nombre del estudiante").max(120),
  /** RN-04: autorización del acudiente y del colegio (Ley 1581 de 2012). */
  consent: z.literal(true, { error: "Confirma que tienes la autorización" }),
});
export type CreatePiarInput = z.infer<typeof createPiarSchema>;

export const savePiarSchema = z.object({ piarId: z.string().min(1), content: piarContentSchema });
export const piarIdSchema = z.object({ piarId: z.string().min(1) });
export const proposePiarSchema = z.object({
  piarId: z.string().min(1),
  periodNumber: z.number().int().min(1).max(MAX_PIAR_PERIODS),
});

/** Mínimo de las barreras para pedir ajustes a la IA (§7). */
export const MIN_BARRIERS_FOR_AI = 10;

export const PIAR_PRIVACY_NOTE =
  "Datos privados de un menor de edad. Solo tú los ves y se guardan cifrados.";
export const PIAR_CONFIDENTIAL_FOOTER =
  "Confidencial: contiene datos personales de un menor de edad (Ley 1581 de 2012). No lo compartas fuera del proceso educativo.";
