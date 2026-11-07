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

// ---------- Propuesta con IA (SPEC-0014) ----------

export const PROPOSAL_SIZES = ["LESS", "DEFAULT", "MORE"] as const;
export type ProposalSize = (typeof PROPOSAL_SIZES)[number];
/** RN-05: unidades por periodo y temas por unidad según "Menos / Normal / Más". */
export const PROPOSAL_RANGES: Record<
  ProposalSize,
  { units: [number, number]; topics: [number, number] }
> = {
  LESS: { units: [1, 2], topics: [2, 3] },
  DEFAULT: { units: [2, 4], topics: [2, 4] },
  MORE: { units: [3, 5], topics: [3, 5] },
};
export const PROPOSAL_TITLE_MAX = 80;

/** "Otra propuesta": títulos que ya están en la revisión, para no repetirlos. */
const avoidTitles = z.array(z.string().trim().max(150)).max(120).default([]);

export const proposePlanningSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("PERIOD"),
    courseId: z.string().min(1),
    periodNumber: z.number().int().min(1).max(MAX_PERIODS),
    size: z.enum(PROPOSAL_SIZES).default("DEFAULT"),
    avoid: avoidTitles,
  }),
  z.object({
    scope: z.literal("YEAR"),
    courseId: z.string().min(1),
    size: z.enum(PROPOSAL_SIZES).default("DEFAULT"),
    avoid: avoidTitles,
  }),
  z.object({
    scope: z.literal("UNIT"),
    unitId: z.string().min(1),
    size: z.enum(PROPOSAL_SIZES).default("DEFAULT"),
    avoid: avoidTitles,
  }),
]);

const proposalTitle = z
  .string()
  .trim()
  .min(3, "Mínimo 3 caracteres")
  .max(PROPOSAL_TITLE_MAX, `Máximo ${PROPOSAL_TITLE_MAX} caracteres`);
const proposalTopic = z.object({
  title: proposalTitle,
  description: optionalText(200),
  dbaCodes: z.array(z.string().min(1).max(60)).max(3).default([]),
});

/** Lo que el docente dejó en la revisión (RN-02). Se revalida todo en el servidor. */
export const acceptProposalSchema = z.object({
  courseId: z.string().min(1),
  units: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("NEW"),
          periodNumber: z.number().int().min(1).max(MAX_PERIODS),
          title: proposalTitle,
          topics: z.array(proposalTopic).min(1).max(8),
        }),
        z.object({
          kind: z.literal("EXISTING"),
          unitId: z.string().min(1),
          topics: z.array(proposalTopic).min(1).max(8),
        }),
      ]),
    )
    .min(1, "Elige al menos un tema")
    .max(30),
});

/** RN-06 (SPEC-0007): nunca más de 5 objetivos activos por tema. */
export const MAX_OBJECTIVES_PER_TOPIC = 5;

export const proposeObjectivesSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("UNIT"), unitId: z.string().min(1) }),
  z.object({
    scope: z.literal("PERIOD"),
    courseId: z.string().min(1),
    periodNumber: z.number().int().min(1).max(MAX_PERIODS),
  }),
]);

/** Objetivos que el docente dejó marcados en la revisión en bloque (CA-0014-09). */
export const acceptObjectivesSchema = z.object({
  courseId: z.string().min(1),
  objectives: z
    .array(
      z.object({
        topicId: z.string().min(1),
        statement: z
          .string()
          .trim()
          .min(5, "Mínimo 5 caracteres")
          .max(500, "Máximo 500 caracteres"),
        dbaCodes: z.array(z.string().min(1).max(60)).max(10).default([]),
      }),
    )
    .min(1, "Elige al menos un objetivo")
    .max(60),
});

export type ProposeObjectivesInput = z.input<typeof proposeObjectivesSchema>;
export type AcceptObjectivesInput = z.input<typeof acceptObjectivesSchema>;

export type ProposePlanningInput = z.input<typeof proposePlanningSchema>;
export type AcceptProposalInput = z.input<typeof acceptProposalSchema>;

export type CoursePeriodsInput = z.input<typeof coursePeriodsSchema>;
export type UnitInput = z.input<typeof unitSchema>;
export type TopicInput = z.input<typeof topicSchema>;
export type QuickTopicInput = z.input<typeof quickTopicSchema>;
export type ObjectiveInput = z.input<typeof objectiveSchema>;
export type CurriculumLinkInput = z.input<typeof curriculumLinkSchema>;
