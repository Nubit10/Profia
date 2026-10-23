import { z } from "zod";
import type { Grade } from "@/modules/courses/client";

// Schemas y catálogos compartidos entre formularios y servidor (SPEC-0008). Sin dependencias de
// servidor: el mismo schema valida el formulario (React Hook Form) y la server action.

export const RESOURCE_TYPES = ["QUIZ", "WORKSHOP", "EXAM"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  QUIZ: "Quiz",
  WORKSHOP: "Taller",
  EXAM: "Examen",
};

export const STATUS_LABELS = {
  GENERATING: "Generando",
  FAILED: "Falló",
  DRAFT: "Borrador",
  READY: "Listo",
  ARCHIVED: "Archivado",
} as const;

export const LEVELS = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"] as const;
export type CognitiveLevel = (typeof LEVELS)[number];
export const LEVEL_LABELS: Record<CognitiveLevel, string> = {
  REMEMBER: "Recordar",
  UNDERSTAND: "Comprender",
  APPLY: "Aplicar",
  ANALYZE: "Analizar",
  EVALUATE: "Evaluar",
  CREATE: "Crear",
};

export const QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Selección múltiple",
  TRUE_FALSE: "Verdadero o falso",
  SHORT_ANSWER: "Respuesta corta",
};

export const DIFFICULTIES = ["BASIC", "INTERMEDIATE", "ADVANCED"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  BASIC: "Básica",
  INTERMEDIATE: "Intermedia",
  ADVANCED: "Avanzada",
};

export const STRUCTURES = [
  "START_DEVELOPMENT_CLOSE",
  "EXPLORE_PRACTICE_APPLY",
  "EXPERIENCE_FOUNDATION_EXERCISE_APPLY",
  "PROBLEM_SITUATION",
] as const;
export type WorkshopStructure = (typeof STRUCTURES)[number];

/** RN-10: el docente elige la estructura; cada opción explica para qué sirve y sus momentos. */
export const WORKSHOP_STRUCTURES: Record<
  WorkshopStructure,
  { label: string; moments: string[]; description: string }
> = {
  START_DEVELOPMENT_CLOSE: {
    label: "Inicio, desarrollo y cierre",
    moments: ["Inicio", "Desarrollo", "Cierre"],
    description:
      "La más usada. El inicio activa saberes previos, el desarrollo trabaja el tema y el cierre recoge lo aprendido. Sirve para casi cualquier clase.",
  },
  EXPLORE_PRACTICE_APPLY: {
    label: "Exploración, práctica y aplicación",
    moments: ["Exploración", "Práctica", "Aplicación"],
    description:
      "El estudiante primero descubre la idea con un ejemplo o una pregunta, luego la ejercita y al final la usa en una situación nueva. Útil para procedimientos y conceptos.",
  },
  EXPERIENCE_FOUNDATION_EXERCISE_APPLY: {
    label: "Vivencia, fundamentación, ejercitación y aplicación",
    moments: ["Vivencia", "Fundamentación", "Ejercitación", "Aplicación"],
    description:
      "Secuencia de muchas guías colombianas: parte de una experiencia cercana, explica el concepto, lo practica y lo lleva a la vida diaria. Necesita al menos 4 actividades.",
  },
  PROBLEM_SITUATION: {
    label: "Situación problema",
    moments: [
      "Planteamiento del problema",
      "Investigación",
      "Propuesta de solución",
      "Socialización",
    ],
    description:
      "Los estudiantes enfrentan un problema real o cercano, investigan, proponen una solución y la presentan. Ideal para trabajo en grupo y grados altos. Necesita al menos 4 actividades.",
  },
};

export const ITEM_COUNT_LIMITS: Record<"QUIZ" | "WORKSHOP", { min: number; max: number }> = {
  QUIZ: { min: 3, max: 15 },
  WORKSHOP: { min: 2, max: 8 },
};

const distributionSchema = z
  .partialRecord(z.enum(LEVELS), z.number().int().min(0).max(100))
  .refine((d) => Object.values(d).reduce((a, b) => a + (b ?? 0), 0) === 100, {
    message: "Los porcentajes deben sumar 100",
  });

const blueprintBase = {
  topicId: z.string().min(1),
  objectiveIds: z.array(z.string().min(1)).max(5, "Máximo 5 objetivos"),
  durationMinutes: z
    .number({ error: "Escribe la duración" })
    .int()
    .min(15, "Mínimo 15 minutos")
    .max(180, "Máximo 180 minutos"),
  difficulty: z.enum(DIFFICULTIES),
  cognitiveDistribution: distributionSchema,
  notes: z.string().trim().max(500, "Máximo 500 caracteres").nullable(),
  /** RN-07: preferencias que el docente decidió no usar en esta generación. */
  excludedPreferenceIds: z.array(z.string()).max(50).default([]),
};

const quizBlueprint = z.object({
  ...blueprintBase,
  type: z.literal("QUIZ"),
  itemCount: z.number().int().min(3, "Mínimo 3 preguntas").max(15, "Máximo 15 preguntas"),
  questionTypes: z
    .array(z.enum(QUESTION_TYPES))
    .min(1, "Elige al menos un tipo de pregunta")
    .refine((t) => new Set(t).size === t.length, "Tipos repetidos"),
});

const workshopBlueprint = z.object({
  ...blueprintBase,
  type: z.literal("WORKSHOP"),
  itemCount: z.number().int().min(2, "Mínimo 2 actividades").max(8, "Máximo 8 actividades"),
  /** "CUSTOM" = formato propio del docente o del colegio (SPEC-0010). */
  structure: z.enum([...STRUCTURES, "CUSTOM"]),
  formatId: z.string().min(1).optional(),
});

// --- Examen (SPEC-0011) -----------------------------------------------------------------------

export const EXAM_QUESTION_TYPES = [...QUESTION_TYPES, "MATCHING", "OPEN"] as const;
export type ExamQuestionType = (typeof EXAM_QUESTION_TYPES)[number];
export const EXAM_QUESTION_TYPE_LABELS: Record<ExamQuestionType, string> = {
  ...QUESTION_TYPE_LABELS,
  MATCHING: "Emparejamiento",
  OPEN: "Pregunta abierta",
};

/** RN-09: tamaño del examen. En emparejamiento cada "pregunta" es un bloque de pares. */
export const EXAM_LIMITS = {
  topics: { min: 1, max: 12 },
  objectives: 15,
  sections: { min: 2, max: 5 },
  questions: { min: 10, max: 40 },
  perSection: {
    MULTIPLE_CHOICE: 20,
    TRUE_FALSE: 20,
    SHORT_ANSWER: 20,
    MATCHING: 2,
    OPEN: 5,
  } satisfies Record<ExamQuestionType, number>,
  pairs: { min: 4, max: 8 },
  distractors: 2,
  criteria: { min: 1, max: 4 },
  duration: { min: 30, max: 240 },
  totalPoints: { min: 10, max: 100 },
};

/** RN-11: un examen gasta 2 recursos del cupo diario. */
export const EXAM_QUOTA_COST = 2;

/** Puntos: positivos y con máximo un decimal (RN-06). */
export const pointsSchema = z
  .number({ error: "Escribe los puntos" })
  .positive("Los puntos deben ser mayores que 0")
  .max(100, "Máximo 100 puntos")
  .refine((v) => Math.abs(Math.round(v * 10) - v * 10) < 1e-6, "Usa máximo un decimal");

export const roundPoints = (v: number) => Math.round(v * 10) / 10;

const examSectionBlueprint = z.object({
  questionType: z.enum(EXAM_QUESTION_TYPES),
  questionCount: z.number({ error: "Escribe cuántas preguntas" }).int().min(1, "Mínimo 1"),
  pointsPerQuestion: pointsSchema,
  instructions: z.string().trim().max(300, "Máximo 300 caracteres").nullable().default(null),
});
export type ExamSectionBlueprint = z.output<typeof examSectionBlueprint>;

/** De dónde partió el docente; solo sirve para el título y para volver a abrir el asistente. */
export const examScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("UNIT"), unitId: z.string().min(1) }),
  z.object({ kind: z.literal("PERIOD"), periodNumber: z.number().int().min(1).max(6) }),
  z.object({ kind: z.literal("TOPICS") }),
]);
export type ExamScope = z.output<typeof examScopeSchema>;

const examBlueprint = z.object({
  type: z.literal("EXAM"),
  scope: examScopeSchema,
  topicIds: z
    .array(z.string().min(1))
    .min(1, "Elige al menos un tema")
    .max(EXAM_LIMITS.topics.max, `Máximo ${EXAM_LIMITS.topics.max} temas`)
    .refine((t) => new Set(t).size === t.length, "Temas repetidos"),
  objectiveIds: z
    .array(z.string().min(1))
    .max(EXAM_LIMITS.objectives, `Máximo ${EXAM_LIMITS.objectives} objetivos`),
  durationMinutes: z
    .number({ error: "Escribe la duración" })
    .int()
    .min(EXAM_LIMITS.duration.min, `Mínimo ${EXAM_LIMITS.duration.min} minutos`)
    .max(EXAM_LIMITS.duration.max, `Máximo ${EXAM_LIMITS.duration.max} minutos`),
  difficulty: z.enum(DIFFICULTIES),
  sections: z
    .array(examSectionBlueprint)
    .min(EXAM_LIMITS.sections.min, `Mínimo ${EXAM_LIMITS.sections.min} secciones`)
    .max(EXAM_LIMITS.sections.max, `Máximo ${EXAM_LIMITS.sections.max} secciones`),
  totalPoints: z
    .number({ error: "Escribe el puntaje total" })
    .int()
    .min(EXAM_LIMITS.totalPoints.min, `Mínimo ${EXAM_LIMITS.totalPoints.min} puntos`)
    .max(EXAM_LIMITS.totalPoints.max, `Máximo ${EXAM_LIMITS.totalPoints.max} puntos`),
  cognitiveDistribution: distributionSchema,
  notes: blueprintBase.notes,
  excludedPreferenceIds: blueprintBase.excludedPreferenceIds,
});

export const examQuestionCount = (sections: { questionCount: number }[]) =>
  sections.reduce((sum, s) => sum + (Number(s.questionCount) || 0), 0);

/** Suma real de los puntos del blueprint (RN-06: puede no coincidir con el total pedido). */
export const examBlueprintPoints = (
  sections: { questionCount: number; pointsPerQuestion: number }[],
) =>
  roundPoints(
    sections.reduce(
      (sum, s) => sum + (Number(s.questionCount) || 0) * (Number(s.pointsPerQuestion) || 0),
      0,
    ),
  );

/** Peso de cada tipo al repartir los puntos: un emparejamiento o una abierta valen más. */
const POINT_WEIGHTS: Record<ExamQuestionType, number> = {
  MULTIPLE_CHOICE: 1,
  TRUE_FALSE: 1,
  SHORT_ANSWER: 1.5,
  MATCHING: 3,
  OPEN: 3,
};

/** RN-06: reparte el total entre las secciones según cuántas preguntas tienen y su tipo. */
export function distributePoints<
  T extends { questionType: ExamQuestionType; questionCount: number },
>(sections: T[], total: number): (T & { pointsPerQuestion: number })[] {
  const weight = sections.reduce(
    (sum, s) => sum + POINT_WEIGHTS[s.questionType] * Math.max(0, Number(s.questionCount) || 0),
    0,
  );
  return sections.map((s) => ({
    ...s,
    pointsPerQuestion: weight
      ? Math.max(0.1, roundPoints((total * POINT_WEIGHTS[s.questionType]) / weight))
      : 1,
  }));
}

const usedLevels = (d: Partial<Record<CognitiveLevel, number>>) =>
  Object.values(d).filter((v) => (v ?? 0) > 0).length;

export const blueprintSchema = z
  .discriminatedUnion("type", [quizBlueprint, workshopBlueprint, examBlueprint])
  .superRefine((b, ctx) => {
    const items = b.type === "EXAM" ? examQuestionCount(b.sections) : b.itemCount;
    if (usedLevels(b.cognitiveDistribution) > items) {
      ctx.addIssue({
        code: "custom",
        path: ["cognitiveDistribution"],
        message: `Con ${items} ítems no caben ${usedLevels(b.cognitiveDistribution)} niveles: quita niveles o aumenta la cantidad`,
      });
    }
    if (b.type === "EXAM") {
      const { min, max } = EXAM_LIMITS.questions;
      if (items < min || items > max) {
        ctx.addIssue({
          code: "custom",
          path: ["sections"],
          message: `El examen debe tener entre ${min} y ${max} preguntas (tiene ${items})`,
        });
      }
      b.sections.forEach((section, i) => {
        const cap = EXAM_LIMITS.perSection[section.questionType];
        if (section.questionCount > cap) {
          ctx.addIssue({
            code: "custom",
            path: ["sections", i, "questionCount"],
            message: `${EXAM_QUESTION_TYPE_LABELS[section.questionType]}: máximo ${cap} por sección`,
          });
        }
      });
      // RN-03 y §7: cada tema necesita al menos una pregunta.
      if (b.topicIds.length > items) {
        ctx.addIssue({
          code: "custom",
          path: ["sections"],
          message: `Elegiste ${b.topicIds.length} temas y el examen tiene ${items} preguntas: cada tema necesita al menos una`,
        });
      }
      return;
    }
    if (b.type === "WORKSHOP" && b.structure === "CUSTOM" && !b.formatId) {
      ctx.addIssue({ code: "custom", path: ["structure"], message: "Elige uno de tus formatos" });
    }
    if (b.type === "WORKSHOP" && b.structure !== "CUSTOM") {
      const moments = WORKSHOP_STRUCTURES[b.structure].moments.length;
      if (b.itemCount < moments) {
        ctx.addIssue({
          code: "custom",
          path: ["itemCount"],
          message: `Esta estructura tiene ${moments} momentos: necesita al menos ${moments} actividades`,
        });
      }
    }
  });
export type BlueprintInput = z.input<typeof blueprintSchema>;
export type Blueprint = z.output<typeof blueprintSchema>;

type Defaults = {
  difficulty: Difficulty;
  durationMinutes: number;
  quizCount: number;
  workshopCount: number;
  questionTypes: QuestionType[];
  distribution: Partial<Record<CognitiveLevel, number>>;
};

/** Valores por defecto según el grado (SPEC-0008 §5); el docente los cambia. */
export function defaultsForGrade(grade: Grade): Defaults {
  if (["JARDIN", "TRANSICION", "G1", "G2", "G3"].includes(grade)) {
    return {
      difficulty: "BASIC",
      durationMinutes: 45,
      quizCount: 5,
      workshopCount: 3,
      questionTypes: ["MULTIPLE_CHOICE", "TRUE_FALSE"],
      distribution: { REMEMBER: 40, UNDERSTAND: 40, APPLY: 20 },
    };
  }
  if (["G4", "G5", "G6", "G7"].includes(grade)) {
    return {
      difficulty: "INTERMEDIATE",
      durationMinutes: 50,
      quizCount: 8,
      workshopCount: 4,
      questionTypes: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"],
      distribution: { REMEMBER: 20, UNDERSTAND: 30, APPLY: 30, ANALYZE: 20 },
    };
  }
  return {
    difficulty: "INTERMEDIATE",
    durationMinutes: 55,
    quizCount: 10,
    workshopCount: 4,
    questionTypes: ["MULTIPLE_CHOICE", "SHORT_ANSWER"],
    distribution: { UNDERSTAND: 20, APPLY: 30, ANALYZE: 30, EVALUATE: 20 },
  };
}

type ExamDefaults = {
  difficulty: Difficulty;
  durationMinutes: number;
  sections: { questionType: ExamQuestionType; questionCount: number }[];
  distribution: Partial<Record<CognitiveLevel, number>>;
};

/** SPEC-0011 §5: valores por defecto del examen según el grado; el docente los cambia. */
export function examDefaultsForGrade(grade: Grade): ExamDefaults {
  if (["JARDIN", "TRANSICION", "G1", "G2", "G3"].includes(grade)) {
    return {
      difficulty: "BASIC",
      durationMinutes: 45,
      sections: [
        { questionType: "MULTIPLE_CHOICE", questionCount: 8 },
        { questionType: "TRUE_FALSE", questionCount: 4 },
      ],
      distribution: { REMEMBER: 40, UNDERSTAND: 40, APPLY: 20 },
    };
  }
  if (["G4", "G5", "G6", "G7"].includes(grade)) {
    return {
      difficulty: "INTERMEDIATE",
      durationMinutes: 60,
      sections: [
        { questionType: "MULTIPLE_CHOICE", questionCount: 10 },
        { questionType: "TRUE_FALSE", questionCount: 5 },
        { questionType: "SHORT_ANSWER", questionCount: 4 },
      ],
      distribution: { REMEMBER: 20, UNDERSTAND: 30, APPLY: 30, ANALYZE: 20 },
    };
  }
  return {
    difficulty: "INTERMEDIATE",
    durationMinutes: 90,
    sections: [
      { questionType: "MULTIPLE_CHOICE", questionCount: 12 },
      { questionType: "MATCHING", questionCount: 1 },
      { questionType: "SHORT_ANSWER", questionCount: 4 },
      { questionType: "OPEN", questionCount: 2 },
    ],
    distribution: { UNDERSTAND: 20, APPLY: 30, ANALYZE: 30, EVALUATE: 20 },
  };
}

// --- Contenido editable por el docente (RN-08) ------------------------------------------------

const text = (max: number, label: string) =>
  z.string().trim().min(1, `${label}: no puede quedar vacío`).max(max, `${label}: máximo ${max}`);

export const quizQuestionSchema = z
  .object({
    id: z.string().min(1).max(40),
    type: z.enum(QUESTION_TYPES),
    stem: text(1000, "Enunciado"),
    options: z.array(z.string().trim().min(1, "Opción vacía").max(300)).max(6),
    answer: text(600, "Respuesta"),
    explanation: z.string().trim().max(1000),
    cognitiveLevel: z.enum(LEVELS),
    dbaCodes: z.array(z.string()).max(6),
  })
  .superRefine((q, ctx) => {
    if (q.type === "MULTIPLE_CHOICE") {
      if (q.options.length < 2) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "Mínimo 2 opciones" });
      }
      if (new Set(q.options).size !== q.options.length) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "Hay opciones repetidas" });
      }
      if (!q.options.includes(q.answer)) {
        ctx.addIssue({ code: "custom", path: ["answer"], message: "Marca la opción correcta" });
      }
    }
    if (q.type === "TRUE_FALSE" && !["Verdadero", "Falso"].includes(q.answer)) {
      ctx.addIssue({ code: "custom", path: ["answer"], message: "Elige Verdadero o Falso" });
    }
  });
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizContentSchema = z.object({
  title: text(200, "Título"),
  instructions: z.string().trim().max(1500),
  questions: z.array(quizQuestionSchema).min(1, "El quiz necesita al menos una pregunta").max(40),
});
export type QuizContent = z.infer<typeof quizContentSchema>;

export const activitySchema = z.object({
  id: z.string().min(1).max(40),
  title: text(200, "Título de la actividad"),
  instructions: text(2500, "Instrucciones"),
  durationMinutes: z.number().int().min(1).max(180),
  expectedOutcome: z.string().trim().max(800),
  cognitiveLevel: z.enum(LEVELS),
  dbaCodes: z.array(z.string()).max(6),
});
export type Activity = z.infer<typeof activitySchema>;

export const workshopContentSchema = z.object({
  title: text(200, "Título"),
  purpose: z.string().trim().max(1000),
  studentInstructions: z.string().trim().max(1500),
  materials: z.array(z.string().trim().min(1).max(200)).max(20),
  moments: z
    .array(z.object({ name: text(80, "Momento"), activities: z.array(activitySchema).max(12) }))
    .min(1)
    .max(6),
  teacherGuidance: z.array(z.string().trim().min(1).max(600)).max(10),
  /** Contenido de las secciones de texto del formato del docente (SPEC-0010). */
  sectionTexts: z
    .array(z.object({ title: text(120, "Sección"), content: z.string().trim().max(4000) }))
    .max(10)
    .default([]),
});
export type WorkshopContent = z.infer<typeof workshopContentSchema>;

// --- Contenido del examen (SPEC-0011) ---------------------------------------------------------

const sumPoints = (values: number[]) => roundPoints(values.reduce((a, b) => a + b, 0));

export const examQuestionSchema = z
  .object({
    id: z.string().min(1).max(40),
    type: z.enum(EXAM_QUESTION_TYPES),
    /** En emparejamiento, la instrucción ("Relaciona cada concepto con…"). */
    stem: text(1000, "Enunciado"),
    options: z.array(z.string().trim().min(1, "Opción vacía").max(300)).max(6),
    /** Respuesta correcta; en la abierta, la respuesta esperada. Vacía en emparejamiento. */
    answer: z.string().trim().max(1500),
    explanation: z.string().trim().max(1000),
    pairs: z
      .array(z.object({ left: text(300, "Columna A"), right: text(300, "Columna B") }))
      .max(EXAM_LIMITS.pairs.max)
      .default([]),
    /** Respuestas sobrantes de la columna B (RN-04). */
    distractors: z
      .array(z.string().trim().min(1, "Distractor vacío").max(300))
      .max(EXAM_LIMITS.distractors)
      .default([]),
    criteria: z
      .array(z.object({ description: text(300, "Criterio"), points: pointsSchema }))
      .max(EXAM_LIMITS.criteria.max)
      .default([]),
    points: pointsSchema,
    /** Tema que evalúa (RN-07): uno de los temas del examen. */
    topicId: z.string().min(1).max(40),
    cognitiveLevel: z.enum(LEVELS),
    dbaCodes: z.array(z.string()).max(6),
  })
  .superRefine((q, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (q.type === "MULTIPLE_CHOICE") {
      if (q.options.length < 2) issue("options", "Mínimo 2 opciones");
      if (new Set(q.options).size !== q.options.length) issue("options", "Hay opciones repetidas");
      if (!q.options.includes(q.answer)) issue("answer", "Marca la opción correcta");
    }
    if (q.type === "TRUE_FALSE" && !["Verdadero", "Falso"].includes(q.answer)) {
      issue("answer", "Elige Verdadero o Falso");
    }
    if ((q.type === "SHORT_ANSWER" || q.type === "OPEN") && !q.answer) {
      issue("answer", "Escribe la respuesta esperada");
    }
    if (q.type === "MATCHING") {
      const { min, max } = EXAM_LIMITS.pairs;
      if (q.pairs.length < min || q.pairs.length > max) {
        issue("pairs", `El emparejamiento necesita entre ${min} y ${max} pares`);
      }
      const norm = (t: string) => t.trim().toLocaleLowerCase("es");
      const lefts = q.pairs.map((p) => norm(p.left));
      const rights = [...q.pairs.map((p) => p.right), ...q.distractors].map(norm);
      if (new Set(lefts).size !== lefts.length) {
        issue("pairs", "Hay elementos repetidos en la columna A");
      }
      if (new Set(rights).size !== rights.length) {
        issue("pairs", "Hay elementos repetidos en la columna B");
      }
    }
    if (q.type === "OPEN") {
      const { min, max } = EXAM_LIMITS.criteria;
      if (q.criteria.length < min || q.criteria.length > max) {
        issue("criteria", `La pregunta abierta necesita entre ${min} y ${max} criterios`);
      } else {
        // RN-05: los criterios suman los puntos de la pregunta.
        const sum = sumPoints(q.criteria.map((c) => c.points));
        if (Math.abs(sum - q.points) > 0.05) {
          issue(
            "criteria",
            `Los criterios suman ${sum} y la pregunta vale ${q.points}: ajusta la diferencia de ${roundPoints(q.points - sum)}`,
          );
        }
      }
    }
  });
export type ExamQuestion = z.infer<typeof examQuestionSchema>;

export const examSectionSchema = z
  .object({
    id: z.string().min(1).max(40),
    questionType: z.enum(EXAM_QUESTION_TYPES),
    title: text(120, "Título de la sección"),
    instructions: z.string().trim().max(600),
    questions: z
      .array(examQuestionSchema)
      .min(1, "Cada sección necesita al menos una pregunta")
      .max(20),
  })
  .superRefine((s, ctx) => {
    if (s.questions.some((q) => q.type !== s.questionType)) {
      ctx.addIssue({
        code: "custom",
        path: ["questions"],
        message: `La sección "${s.title}" solo admite preguntas de ${EXAM_QUESTION_TYPE_LABELS[s.questionType].toLowerCase()}`,
      });
    }
  });
export type ExamSection = z.infer<typeof examSectionSchema>;

export const examContentSchema = z.object({
  title: text(200, "Título"),
  instructions: z.string().trim().max(1500),
  durationMinutes: z.number().int().min(1).max(EXAM_LIMITS.duration.max),
  /** Puntaje pedido al configurar; el real es la suma de las preguntas (RN-06). */
  targetPoints: z.number().int().min(1).max(100),
  topics: z
    .array(z.object({ id: z.string().min(1).max(40), title: z.string().max(200) }))
    .min(1)
    .max(EXAM_LIMITS.topics.max),
  sections: z
    .array(examSectionSchema)
    .min(1, "El examen necesita al menos una sección")
    .max(EXAM_LIMITS.sections.max),
});
export type ExamContent = z.infer<typeof examContentSchema>;

export const examTotalPoints = (content: Pick<ExamContent, "sections">) =>
  sumPoints(content.sections.flatMap((s) => s.questions.map((q) => q.points)));

/** RN-14: escala de notas de la clave. No cambia el contenido ni su versión. */
export const gradingScaleSchema = z
  .object({
    passingGrade: z
      .number({ error: "Escribe la nota mínima" })
      .min(1, "La nota mínima va de 1,0 a 5,0")
      .max(5, "La nota mínima va de 1,0 a 5,0")
      .refine((v) => Math.abs(Math.round(v * 10) - v * 10) < 1e-6, "Usa máximo un decimal"),
    /** Puntaje con el que se aprueba; si falta, la escala es lineal de 0 al total. */
    passingPoints: z.number().positive("Debe ser mayor que 0").nullable().default(null),
  })
  .refine((s) => s.passingPoints === null || s.passingGrade > 1, {
    path: ["passingGrade"],
    message: "Con un puntaje de aprobación, la nota mínima debe ser mayor que 1,0",
  });
export type GradingScale = z.output<typeof gradingScaleSchema>;
export const DEFAULT_GRADING_SCALE: GradingScale = { passingGrade: 3, passingPoints: null };

/** Nota (1,0–5,0) para un puntaje: lineal, o en dos tramos si hay puntaje de aprobación. */
export function gradeFor(points: number, total: number, scale: GradingScale): number {
  if (total <= 0) return 1;
  const p = Math.min(Math.max(points, 0), total);
  const pass = scale.passingPoints;
  let grade: number;
  if (pass && pass > 0 && pass < total) {
    grade =
      p <= pass
        ? 1 + ((scale.passingGrade - 1) * p) / pass
        : scale.passingGrade + ((5 - scale.passingGrade) * (p - pass)) / (total - pass);
  } else {
    grade = 1 + (4 * p) / total;
  }
  return Math.round(grade * 10) / 10;
}

/** Puntaje mínimo para aprobar según la escala (para marcarlo en la tabla de la clave). */
export function passingPointsFor(total: number, scale: GradingScale): number {
  if (scale.passingPoints && scale.passingPoints < total) return scale.passingPoints;
  return roundPoints(((scale.passingGrade - 1) * total) / 4);
}

// --- Evaluación docente y preferencias (CA-0008-08, RN-07) ------------------------------------

export const PREFERENCE_SCOPES = ["COURSE", "ALL"] as const;
export type PreferenceScope = (typeof PREFERENCE_SCOPES)[number];
export const PREFERENCE_SCOPE_LABELS: Record<PreferenceScope, string> = {
  COURSE: "Solo este curso",
  ALL: "Todos mis cursos",
};

export const preferenceSchema = z.object({
  text: z.string().trim().min(5, "Mínimo 5 caracteres").max(300, "Máximo 300 caracteres"),
  scope: z.enum(PREFERENCE_SCOPES),
});
export type PreferenceInput = z.infer<typeof preferenceSchema>;

export const resourceRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullable(),
});

export const itemFeedbackSchema = z.object({
  itemKey: z.string().min(1).max(40),
  rating: z.enum(["UP", "DOWN"]),
  comment: z.string().trim().max(500).nullable(),
});

export const regenerateSchema = z.object({
  itemKey: z.string().min(1).max(40),
  instruction: z
    .string()
    .trim()
    .min(3, "Escribe qué quieres cambiar")
    .max(300, "Máximo 300 caracteres"),
});
