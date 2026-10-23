import "server-only";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";

// Cliente de los contratos de generación (docs/ai/contracts/): sugerencia de objetivos
// (SPEC-0007), quiz, taller y regeneración de un ítem (SPEC-0008).

/** En CPU (Ollama) una sugerencia tarda ~60 s; con Groq, pocos segundos. */
const TIMEOUT_MS = 90_000;

const responseSchema = z.object({
  suggestions: z.array(z.object({ statement: z.string(), dbaCodes: z.array(z.string()) })),
  meta: z.object({
    provider: z.string(),
    model: z.string(),
    promptVersion: z.string(),
    attempts: z.number(),
    latencyMs: z.number(),
  }),
});

export type EngineObjectiveRequest = {
  subject: string;
  grade: string;
  topic: { title: string; description: string | null };
  existingObjectives: string[];
  dba: { code: string; statement: string; evidences: string[] }[];
  count: number;
};

export type EngineResult =
  | { status: "ok"; data: z.infer<typeof responseSchema> }
  | { status: "unavailable" }
  | { status: "invalid" };

export async function requestObjectiveSuggestions(
  body: EngineObjectiveRequest,
  fetcher: typeof fetch = fetch,
): Promise<EngineResult> {
  const { AI_ENGINE_URL, AI_ENGINE_TOKEN } = getEnv();
  if (!AI_ENGINE_URL || !AI_ENGINE_TOKEN) {
    logger.warn("ai_engine.not_configured");
    return { status: "unavailable" };
  }
  try {
    const response = await fetcher(new URL("/v1/generation/objective-suggestions", AI_ENGINE_URL), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${AI_ENGINE_TOKEN}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 502) return { status: "invalid" };
    if (!response.ok) {
      if (response.status === 401) logger.error("ai_engine.unauthorized");
      return { status: "unavailable" };
    }
    return { status: "ok", data: responseSchema.parse(await response.json()) };
  } catch (error) {
    logger.warn("ai_engine.generation_unavailable", { error });
    return { status: "unavailable" };
  }
}

// --- SPEC-0008: quiz, taller y regeneración de un ítem ----------------------------------------

/** Con el plan gratuito de Groq, esperar cupo puede sumar ~40 s; con el modelo local, minutos. */
const RESOURCE_TIMEOUT_MS = 240_000;

const level = z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]);
const questionType = z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]);

const engineQuestion = z.object({
  type: questionType,
  stem: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  explanation: z.string(),
  cognitiveLevel: level,
  dbaCodes: z.array(z.string()),
});
const engineActivity = z.object({
  title: z.string(),
  instructions: z.string(),
  durationMinutes: z.number().int(),
  expectedOutcome: z.string(),
  cognitiveLevel: level,
  dbaCodes: z.array(z.string()),
});
const resourceMeta = responseSchema.shape.meta.extend({ tokens: z.number() });

const quizResponse = z.object({
  quiz: z.object({
    title: z.string(),
    instructions: z.string(),
    questions: z.array(engineQuestion),
  }),
  meta: resourceMeta,
});
const workshopResponse = z.object({
  workshop: z.object({
    title: z.string(),
    purpose: z.string(),
    studentInstructions: z.string(),
    materials: z.array(z.string()),
    moments: z.array(z.object({ name: z.string(), activities: z.array(engineActivity) })),
    teacherGuidance: z.array(z.string()),
    sectionTexts: z.array(z.object({ title: z.string(), content: z.string() })).default([]),
  }),
  meta: resourceMeta,
});
const itemResponse = z.object({
  item: z.union([engineQuestion, engineActivity]),
  meta: resourceMeta,
});

export type EngineQuestion = z.infer<typeof engineQuestion>;
export type EngineActivity = z.infer<typeof engineActivity>;
export type EngineQuiz = z.infer<typeof quizResponse>;
export type EngineWorkshop = z.infer<typeof workshopResponse>;
export type EngineItem = z.infer<typeof itemResponse>;
export type EngineResourceMeta = z.infer<typeof resourceMeta>;

/** Contexto común (RN-02): solo información pedagógica, nunca datos personales. */
export type EngineResourceContext = {
  subject: string;
  grade: string;
  topic: { title: string; description: string | null };
  objectives: string[];
  dba: { code: string; statement: string; evidences: string[] }[];
  difficulty: "BASIC" | "INTERMEDIATE" | "ADVANCED";
  notes: string | null;
  preferences: string[];
};

type Distribution = Partial<Record<z.infer<typeof level>, number>>;

export type EngineQuizRequest = EngineResourceContext & {
  durationMinutes: number;
  itemCount: number;
  questionTypes: z.infer<typeof questionType>[];
  cognitiveDistribution: Distribution;
};

export type EngineWorkshopRequest = EngineResourceContext & {
  durationMinutes: number;
  itemCount: number;
  structure: string;
  /** SPEC-0010: secciones del formato del docente (sin las fijas) cuando structure = CUSTOM. */
  customSections?: { title: string; kind: "ACTIVITIES" | "TEXT"; purpose: string }[];
  cognitiveDistribution: Distribution;
};

export type EngineItemRequest = EngineResourceContext & {
  kind: "QUIZ_QUESTION" | "WORKSHOP_ACTIVITY";
  current: EngineQuestion | EngineActivity;
  instruction: string;
  durationMinutes: number;
  questionTypes: z.infer<typeof questionType>[];
  moment: string | null;
  otherItems: string[];
};

export type EngineCall<T> =
  { status: "ok"; data: T } | { status: "unavailable" } | { status: "invalid" };

async function post<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  timeoutMs: number,
  fetcher: typeof fetch,
): Promise<EngineCall<T>> {
  const { AI_ENGINE_URL, AI_ENGINE_TOKEN } = getEnv();
  if (!AI_ENGINE_URL || !AI_ENGINE_TOKEN) {
    logger.warn("ai_engine.not_configured");
    return { status: "unavailable" };
  }
  try {
    const response = await fetcher(new URL(path, AI_ENGINE_URL), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${AI_ENGINE_TOKEN}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (response.status === 502) return { status: "invalid" };
    if (!response.ok) {
      if (response.status === 401) logger.error("ai_engine.unauthorized");
      if (response.status === 422) logger.error("ai_engine.contract_mismatch", { path });
      return { status: "unavailable" };
    }
    return { status: "ok", data: schema.parse(await response.json()) };
  } catch (error) {
    logger.warn("ai_engine.generation_unavailable", { path, error });
    return { status: "unavailable" };
  }
}

export const requestQuiz = (body: EngineQuizRequest, fetcher: typeof fetch = fetch) =>
  post("/v1/generation/quiz", body, quizResponse, RESOURCE_TIMEOUT_MS, fetcher);

export const requestWorkshop = (body: EngineWorkshopRequest, fetcher: typeof fetch = fetch) =>
  post("/v1/generation/workshop", body, workshopResponse, RESOURCE_TIMEOUT_MS, fetcher);

export const requestItem = (body: EngineItemRequest, fetcher: typeof fetch = fetch) =>
  post("/v1/generation/item", body, itemResponse, TIMEOUT_MS, fetcher);

// --- SPEC-0011: examen por secciones y regeneración de una pregunta del examen ---------------

/**
 * Varias llamadas seguidas (una por sección), cada una puede esperar el cupo por minuto.
 * Queda por debajo del `maxDuration` de 300 s del área de trabajo (Vercel): si se alarga, el examen
 * falla con su mensaje en vez de quedar cortado por la plataforma (benchmark: máx. 145 s).
 */
const EXAM_TIMEOUT_MS = 280_000;

const examQuestionType = z.enum([
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "MATCHING",
  "OPEN",
]);
const engineExamQuestion = z.object({
  type: examQuestionType,
  stem: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  explanation: z.string(),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })),
  distractors: z.array(z.string()),
  criteria: z.array(z.object({ description: z.string(), points: z.number() })),
  topic: z.string(),
  cognitiveLevel: level,
  dbaCodes: z.array(z.string()),
});
const examResponse = z.object({
  exam: z.object({
    sections: z.array(
      z.object({
        questionType: examQuestionType,
        pointsPerQuestion: z.number(),
        questions: z.array(engineExamQuestion),
      }),
    ),
  }),
  meta: resourceMeta.extend({
    calls: z.array(
      z.object({
        section: z.number(),
        provider: z.string(),
        model: z.string(),
        attempts: z.number(),
        latencyMs: z.number(),
        tokens: z.number(),
      }),
    ),
  }),
});
const examItemResponse = z.object({ item: engineExamQuestion, meta: resourceMeta });

export type EngineExamQuestion = z.infer<typeof engineExamQuestion>;
export type EngineExam = z.infer<typeof examResponse>;
export type EngineExamCall = EngineExam["meta"]["calls"][number];

/** RN-08: solo contexto pedagógico. Cada tema viaja con una clave (T1…), nunca con su id. */
export type EngineExamContext = {
  subject: string;
  grade: string;
  topics: { key: string; title: string; description: string | null }[];
  objectives: string[];
  dba: { code: string; statement: string; evidences: string[] }[];
  difficulty: "BASIC" | "INTERMEDIATE" | "ADVANCED";
  notes: string | null;
  preferences: string[];
};

export type EngineExamRequest = EngineExamContext & {
  durationMinutes: number;
  sections: {
    questionType: z.infer<typeof examQuestionType>;
    questionCount: number;
    pointsPerQuestion: number;
    instructions: string | null;
  }[];
  cognitiveDistribution: Distribution;
};

export type EngineExamItemRequest = EngineExamContext & {
  current: EngineExamQuestion;
  points: number;
  instruction: string;
  otherItems: string[];
};

export const requestExam = (body: EngineExamRequest, fetcher: typeof fetch = fetch) =>
  post("/v1/generation/exam", body, examResponse, EXAM_TIMEOUT_MS, fetcher);

export const requestExamItem = (body: EngineExamItemRequest, fetcher: typeof fetch = fetch) =>
  post("/v1/generation/exam/item", body, examItemResponse, TIMEOUT_MS, fetcher);

// --- SPEC-0010: análisis del formato propio del docente --------------------------------------

const fieldSource = z.enum([
  "INSTITUTION",
  "CAMPUS",
  "TEACHER",
  "SUBJECT",
  "GRADE",
  "GROUP",
  "GRADE_GROUP",
  "PERIOD",
  "TOPIC",
  "YEAR",
  "DATE",
  "TITLE",
  "BLANK",
]);
const formatResponse = z.object({
  header: z.array(z.object({ label: z.string(), source: fieldSource })),
  sections: z.array(
    z.object({
      title: z.string(),
      kind: z.enum(["ACTIVITIES", "TEXT", "FIXED"]),
      purpose: z.string(),
    }),
  ),
  meta: resourceMeta,
});
export type EngineFormatAnalysis = z.infer<typeof formatResponse>;

/** RN-02: solo etiquetas y títulos (y si la sección trae texto), nunca valores ni contenidos. */
export type EngineFormatRequest = {
  headerLabels: string[];
  sections: { title: string; hasBody: boolean }[];
};

export const requestFormatAnalysis = (body: EngineFormatRequest, fetcher: typeof fetch = fetch) =>
  post("/v1/formats/analyze", body, formatResponse, TIMEOUT_MS, fetcher);
