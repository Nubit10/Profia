import { z } from "zod";

// Schemas compartidos entre formularios y servidor (SPEC-0006 §5). Sin dependencias de servidor.

export const MAX_PERIODS = 6;
export const DEFAULT_PERIODS = 4;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const isoDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.iso.date("Fecha inválida").nullable())
  .nullable()
  .optional();

const periodSchema = z.object({
  number: z.number().int().min(1).max(MAX_PERIODS),
  name: z.string().trim().min(2, "Nombre muy corto").max(40, "Nombre muy largo"),
  startDate: isoDate,
  endDate: isoDate,
});

export const coursePeriodsSchema = z
  .object({
    courseId: z.string().min(1),
    periods: z.array(periodSchema).min(1, "Al menos un periodo").max(MAX_PERIODS),
  })
  .superRefine(({ periods }, ctx) => {
    periods.forEach((p, i) => {
      if (p.number !== i + 1) {
        ctx.addIssue({
          code: "custom",
          path: ["periods", i, "number"],
          message: "Numeración sin huecos",
        });
      }
      if (p.startDate && p.endDate && p.startDate > p.endDate) {
        ctx.addIssue({
          code: "custom",
          path: ["periods", i, "endDate"],
          message: "La fecha de fin es anterior al inicio",
        });
      }
    });
    // RN-02: los periodos con fechas no se solapan.
    const dated = periods
      .map((p, i) => ({ ...p, i }))
      .filter((p) => p.startDate && p.endDate)
      .sort((a, b) => a.startDate!.localeCompare(b.startDate!));
    for (let k = 1; k < dated.length; k++) {
      if (dated[k]!.startDate! <= dated[k - 1]!.endDate!) {
        ctx.addIssue({
          code: "custom",
          path: ["periods", dated[k]!.i, "startDate"],
          message: `Se solapa con ${dated[k - 1]!.name}`,
        });
      }
    }
  });

const title = z.string().trim().min(3, "Mínimo 3 caracteres").max(150, "Máximo 150 caracteres");
const periodNumber = z.number().int().min(1).max(MAX_PERIODS).nullable();

export const unitSchema = z.object({
  courseId: z.string().min(1),
  periodNumber,
  title,
  description: optionalText(2000),
});
export const updateUnitSchema = unitSchema
  .omit({ courseId: true })
  .extend({ unitId: z.string().min(1) });

const plannedSessions = z.number().int().min(1).max(60).nullable().optional();

export const topicSchema = z.object({
  unitId: z.string().min(1),
  title,
  description: optionalText(2000),
  plannedSessions,
});
/** Tema creado desde el asistente, sin elegir unidad (SPEC-0012). */
export const quickTopicSchema = z.object({ courseId: z.string().min(1), title });

export const updateTopicSchema = topicSchema
  .omit({ unitId: true })
  .extend({ topicId: z.string().min(1) });

export const curriculumLinkSchema = z.object({
  code: z.string().min(1),
  evidenceIndexes: z.array(z.number().int().min(0)).max(20).default([]),
});

export const objectiveSchema = z.object({
  topicId: z.string().min(1),
  statement: z.string().trim().min(5, "Mínimo 5 caracteres").max(500, "Máximo 500 caracteres"),
  links: z.array(curriculumLinkSchema).max(10, "Máximo 10 DBA por objetivo").default([]),
});
export const updateObjectiveSchema = objectiveSchema
  .omit({ topicId: true })
  .extend({ objectiveId: z.string().min(1) });

export const PLANNING_KINDS = ["unit", "topic", "objective"] as const;
export type PlanningKind = (typeof PLANNING_KINDS)[number];

export const moveSchema = z.object({
  kind: z.enum(PLANNING_KINDS),
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});
export const archiveSchema = z.object({
  kind: z.enum(PLANNING_KINDS),
  id: z.string().min(1),
  archived: z.boolean(),
});
export const copySchema = z.object({
  fromCourseId: z.string().min(1),
  toCourseId: z.string().min(1),
});

export type CoursePeriodsInput = z.input<typeof coursePeriodsSchema>;
export type UnitInput = z.input<typeof unitSchema>;
export type TopicInput = z.input<typeof topicSchema>;
export type QuickTopicInput = z.input<typeof quickTopicSchema>;
export type ObjectiveInput = z.input<typeof objectiveSchema>;
export type CurriculumLinkInput = z.input<typeof curriculumLinkSchema>;
