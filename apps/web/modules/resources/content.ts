import "server-only";
import { randomUUID } from "node:crypto";
import type {
  EngineActivity,
  EngineExam,
  EngineExamQuestion,
  EngineQuestion,
  EngineQuiz,
  EngineWorkshop,
} from "@/modules/generation";
import {
  EXAM_QUESTION_TYPE_LABELS,
  roundPoints,
  type Activity,
  type ExamContent,
  type ExamQuestion,
  type QuizContent,
  type QuizQuestion,
  type WorkshopContent,
} from "./schemas";
import type { ResourceContent } from "./types";

// Contenido de un recurso: lo que llega del AI Engine se guarda con un id estable por pregunta o
// actividad, para que la evaluación por ítem y la regeneración sigan apuntando al mismo ítem
// aunque el docente reordene o edite (CA-0008-07, CA-0008-08).

export const newItemId = (prefix: "q" | "a" | "s") => `${prefix}-${randomUUID().slice(0, 8)}`;

/** Defensa en profundidad (RN-03): solo códigos de DBA que estaban en el contexto. */
const onlyAllowed = (codes: string[], allowed: Set<string>) =>
  [...new Set(codes)].filter((c) => allowed.has(c));

export const toQuestion = (q: EngineQuestion, allowed: Set<string>): QuizQuestion => ({
  id: newItemId("q"),
  ...q,
  dbaCodes: onlyAllowed(q.dbaCodes, allowed),
});

export const toActivity = (a: EngineActivity, allowed: Set<string>): Activity => ({
  id: newItemId("a"),
  ...a,
  dbaCodes: onlyAllowed(a.dbaCodes, allowed),
});

export function quizFromEngine(quiz: EngineQuiz["quiz"], allowed: Set<string>): QuizContent {
  return {
    title: quiz.title,
    instructions: quiz.instructions,
    questions: quiz.questions.map((q) => toQuestion(q, allowed)),
  };
}

export function workshopFromEngine(
  workshop: EngineWorkshop["workshop"],
  allowed: Set<string>,
): WorkshopContent {
  return {
    ...workshop,
    sectionTexts: workshop.sectionTexts ?? [],
    moments: workshop.moments.map((m) => ({
      name: m.name,
      activities: m.activities.map((a) => toActivity(a, allowed)),
    })),
  };
}

// --- Examen (SPEC-0011) -----------------------------------------------------------------------

/** Clave con la que cada tema viaja al AI Engine (RN-08: nunca el id de la base). */
export const topicKey = (index: number) => `T${index + 1}`;

/** Instrucciones de cada sección cuando el docente no escribió las suyas. */
const SECTION_INSTRUCTIONS: Record<ExamQuestion["type"], string> = {
  MULTIPLE_CHOICE: "Marca la opción correcta. Solo una respuesta es válida.",
  TRUE_FALSE: "Marca si cada afirmación es verdadera o falsa.",
  SHORT_ANSWER: "Responde en el espacio indicado con una respuesta breve.",
  MATCHING: "Escribe en el paréntesis la letra de la columna B que corresponde a cada elemento.",
  OPEN: "Desarrolla tu respuesta en el espacio indicado. Explica tu procedimiento.",
};
export const EXAM_INSTRUCTIONS =
  "Lee con atención cada sección. Responde en el espacio indicado y revisa tus respuestas antes de entregar.";

export function toExamQuestion(
  q: EngineExamQuestion,
  points: number,
  topicIds: string[],
  allowed: Set<string>,
  id = newItemId("q"),
): ExamQuestion {
  const index = Number(q.topic.replace(/^T/, "")) - 1;
  return {
    id,
    type: q.type,
    stem: q.stem,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    pairs: q.pairs,
    distractors: q.distractors,
    criteria: q.criteria.map((c) => ({
      description: c.description,
      points: roundPoints(c.points),
    })),
    points: roundPoints(points),
    // El AI Engine ya valida la clave; si no corresponde, queda en el tema principal.
    topicId: topicIds[index] ?? topicIds[0]!,
    cognitiveLevel: q.cognitiveLevel,
    dbaCodes: onlyAllowed(q.dbaCodes, allowed),
  };
}

export function examFromEngine(
  exam: EngineExam["exam"],
  meta: {
    title: string;
    durationMinutes: number;
    targetPoints: number;
    topics: { id: string; title: string }[];
    instructions: (string | null)[];
  },
  allowed: Set<string>,
): ExamContent {
  const topicIds = meta.topics.map((t) => t.id);
  return {
    title: meta.title,
    instructions: EXAM_INSTRUCTIONS,
    durationMinutes: meta.durationMinutes,
    targetPoints: meta.targetPoints,
    topics: meta.topics,
    sections: exam.sections.map((s, i) => ({
      id: newItemId("s"),
      questionType: s.questionType,
      title: EXAM_QUESTION_TYPE_LABELS[s.questionType],
      instructions: meta.instructions[i] ?? SECTION_INSTRUCTIONS[s.questionType],
      questions: s.questions.map((q) => toExamQuestion(q, s.pointsPerQuestion, topicIds, allowed)),
    })),
  };
}

/** La pregunta como la recibe el AI Engine: sin id ni puntos, con la clave del tema. */
export function engineExamQuestion(q: ExamQuestion, topicIds: string[]): EngineExamQuestion {
  const index = Math.max(0, topicIds.indexOf(q.topicId));
  return {
    type: q.type,
    stem: q.stem,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    pairs: q.pairs,
    distractors: q.distractors,
    criteria: q.criteria,
    topic: topicKey(index),
    cognitiveLevel: q.cognitiveLevel,
    dbaCodes: q.dbaCodes,
  };
}

const examQuestions = (content: ExamContent) => content.sections.flatMap((s) => s.questions);

// --- Operaciones comunes ----------------------------------------------------------------------

/** Códigos de DBA fuera del contexto se quitan también de lo que edita el docente. */
export function sanitizeContent(data: ResourceContent, allowed: Set<string>): ResourceContent {
  if (data.type === "QUIZ") {
    return {
      type: "QUIZ",
      content: {
        ...data.content,
        questions: data.content.questions.map((q) => ({
          ...q,
          options:
            q.type === "MULTIPLE_CHOICE"
              ? q.options
              : q.type === "TRUE_FALSE"
                ? ["Verdadero", "Falso"]
                : [],
          dbaCodes: onlyAllowed(q.dbaCodes, allowed),
        })),
      },
    };
  }
  if (data.type === "EXAM") {
    const topicIds = new Set(data.content.topics.map((t) => t.id));
    return {
      type: "EXAM",
      content: {
        ...data.content,
        sections: data.content.sections.map((s) => ({
          ...s,
          questions: s.questions.map((q) => ({
            ...q,
            options:
              q.type === "MULTIPLE_CHOICE"
                ? q.options
                : q.type === "TRUE_FALSE"
                  ? ["Verdadero", "Falso"]
                  : [],
            pairs: q.type === "MATCHING" ? q.pairs : [],
            distractors: q.type === "MATCHING" ? q.distractors : [],
            criteria: q.type === "OPEN" ? q.criteria : [],
            answer: q.type === "MATCHING" ? "" : q.answer,
            // RN-07: cada pregunta evalúa uno de los temas del examen.
            topicId: topicIds.has(q.topicId) ? q.topicId : data.content.topics[0]!.id,
            dbaCodes: onlyAllowed(q.dbaCodes, allowed),
          })),
        })),
      },
    };
  }
  return {
    type: "WORKSHOP",
    content: {
      ...data.content,
      moments: data.content.moments.map((m) => ({
        ...m,
        activities: m.activities.map((a) => ({ ...a, dbaCodes: onlyAllowed(a.dbaCodes, allowed) })),
      })),
    },
  };
}

export function itemKeys(data: ResourceContent): string[] {
  if (data.type === "QUIZ") return data.content.questions.map((q) => q.id);
  if (data.type === "EXAM") return examQuestions(data.content).map((q) => q.id);
  return data.content.moments.flatMap((m) => m.activities.map((a) => a.id));
}

export type FoundItem =
  | { kind: "QUIZ_QUESTION"; item: QuizQuestion; others: string[] }
  | { kind: "WORKSHOP_ACTIVITY"; item: Activity; moment: string; others: string[] }
  | { kind: "EXAM_QUESTION"; item: ExamQuestion; others: string[] };

export function findItem(data: ResourceContent, key: string): FoundItem | null {
  if (data.type === "QUIZ") {
    const item = data.content.questions.find((q) => q.id === key);
    if (!item) return null;
    const others = data.content.questions.filter((q) => q.id !== key).map((q) => q.stem);
    return { kind: "QUIZ_QUESTION", item, others };
  }
  if (data.type === "EXAM") {
    const all = examQuestions(data.content);
    const item = all.find((q) => q.id === key);
    if (!item) return null;
    return {
      kind: "EXAM_QUESTION",
      item,
      others: all.filter((q) => q.id !== key).map((q) => q.stem),
    };
  }
  for (const m of data.content.moments) {
    const item = m.activities.find((a) => a.id === key);
    if (item) {
      const others = data.content.moments
        .flatMap((x) => x.activities)
        .filter((a) => a.id !== key)
        .map((a) => a.title);
      return { kind: "WORKSHOP_ACTIVITY", item, moment: m.name, others };
    }
  }
  return null;
}

/** Reemplaza un ítem conservando su id y su posición. */
export function replaceItem(
  data: ResourceContent,
  key: string,
  next: QuizQuestion | Activity | ExamQuestion,
): ResourceContent {
  if (data.type === "QUIZ") {
    return {
      type: "QUIZ",
      content: {
        ...data.content,
        questions: data.content.questions.map((q) =>
          q.id === key ? ({ ...(next as QuizQuestion), id: key } satisfies QuizQuestion) : q,
        ),
      },
    };
  }
  if (data.type === "EXAM") {
    return {
      type: "EXAM",
      content: {
        ...data.content,
        sections: data.content.sections.map((s) => ({
          ...s,
          questions: s.questions.map((q) =>
            q.id === key ? ({ ...(next as ExamQuestion), id: key } satisfies ExamQuestion) : q,
          ),
        })),
      },
    };
  }
  return {
    type: "WORKSHOP",
    content: {
      ...data.content,
      moments: data.content.moments.map((m) => ({
        ...m,
        activities: m.activities.map((a) =>
          a.id === key ? ({ ...(next as Activity), id: key } satisfies Activity) : a,
        ),
      })),
    },
  };
}

/** Quita el id para enviar el ítem al AI Engine (el contrato no lo admite). */
export function engineItem(found: FoundItem): EngineQuestion | EngineActivity {
  const rest: Partial<typeof found.item> = { ...found.item };
  delete rest.id;
  return rest as EngineQuestion | EngineActivity;
}
