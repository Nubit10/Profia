import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import { exportResource } from "@/modules/documents";
import { createIndependentSpace } from "@/modules/institutions";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import {
  createResource,
  getResource,
  saveResourceContent,
  type GenerationDeps,
} from "@/modules/resources";
import type { Blueprint, QuizContent } from "@/modules/resources/client";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0022: verificación de las respuestas de Matemáticas, del AI Engine al editor.

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const DBA1 = "MEN-DBA-MAT-V2-G6-01";

const question = (i: number, answerCheck?: object) => ({
  type: "MULTIPLE_CHOICE" as const,
  stem: `¿Cuánto es ${i} + 5?`,
  options: [String(i + 5), String(i + 6), String(i + 3), String(i + 8)],
  answer: String(i + 5),
  explanation: "Se cuenta hacia la derecha en la recta.",
  cognitiveLevel: "APPLY" as const,
  dbaCodes: [DBA1],
  ...(answerCheck && { answerCheck }),
});

const body = {
  quiz: {
    title: "Quiz de sumas",
    instructions: "Responde cada pregunta.",
    questions: [
      question(1, { status: "VERIFIED", note: "El cálculo da 6." }),
      question(2, { status: "CORRECTED", note: "Se cambió la respuesta: el cálculo da 7." }),
      question(3, { status: "REVIEW", note: "El cálculo da 8 y la respuesta es otra." }),
      { ...question(4), answerCheck: null },
    ],
  },
  meta: {
    provider: "groq",
    model: "qwen/qwen3.8-27b",
    promptVersion: "quiz.v1+math_check.v1",
    attempts: 1,
    latencyMs: 2100,
    tokens: 2300,
    qualityWarnings: ["Pregunta 2: respuesta corregida según el cálculo"],
    qualityRulesVersion: "quality.v1",
  },
};

async function teacherWithQuiz() {
  const user = await createUser("ProfIA");
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
  const subject = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
  const course = await createCourse(ctx, {
    subjectId: subject.id,
    grade: "G6",
    groupName: "601",
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, course.id);
  const unit = await createUnit(ctx, {
    courseId: course.id,
    periodNumber: 1,
    title: "Números enteros",
    description: null,
  });
  const topic = await createTopic(ctx, {
    unitId: unit.id,
    title: "La recta numérica",
    description: null,
    plannedSessions: 4,
  });
  const fetcher = vi.fn(async () => Response.json(body));
  const tasks: Promise<void>[] = [];
  const deps: GenerationDeps = {
    fetcher: fetcher as unknown as typeof fetch,
    schedule: (task) => {
      tasks.push(task());
    },
  };
  const blueprint: Blueprint = {
    type: "QUIZ",
    topicId: topic.id,
    objectiveIds: [],
    durationMinutes: 30,
    difficulty: "BASIC",
    itemCount: 4,
    questionTypes: ["MULTIPLE_CHOICE"],
    cognitiveDistribution: { APPLY: 100 },
    notes: null,
    excludedPreferenceIds: [],
  };
  const { id } = await createResource(ctx, blueprint, deps);
  await Promise.all(tasks);
  return { ctx, id };
}

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("verificación de respuestas de Matemáticas (SPEC-0022)", () => {
  it("CA-0022-10: las marcas se guardan, se quitan al editar y no salen en el Word", async () => {
    const { ctx, id } = await teacherWithQuiz();
    const content = (await getResource(ctx, id)).data!.content as QuizContent;
    expect(content.questions.map((q) => q.answerCheck?.status)).toEqual([
      "VERIFIED",
      "CORRECTED",
      "REVIEW",
      undefined,
    ]);
    const log = await db.generationLog.findFirstOrThrow({ where: { entityId: id } });
    expect(log).toMatchObject({ promptVersion: "quiz.v1+math_check.v1", qualityWarnings: 1 });

    // El docente corrige la 3 (la marca se va), deja las demás y no puede inventar una marca.
    const edited: QuizContent = {
      ...content,
      questions: content.questions.map((q, i) =>
        i === 2
          ? { ...q, answer: q.options[1]!, answerCheck: q.answerCheck }
          : i === 3
            ? { ...q, answerCheck: { status: "VERIFIED", note: "Falso" } }
            : q,
      ),
    };
    await saveResourceContent(ctx, id, 1, edited);
    const saved = (await getResource(ctx, id)).data!.content as QuizContent;
    expect(saved.questions.map((q) => q.answerCheck?.status)).toEqual([
      "VERIFIED",
      "CORRECTED",
      undefined,
      undefined,
    ]);

    const key = await exportResource(ctx, id, { doc: "key", format: "docx", variant: "A" });
    const zip = await JSZip.loadAsync(key.body);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Se cuenta hacia la derecha en la recta.");
    for (const mark of ["verificada", "corregida", "Revisa esta respuesta", "El cálculo da"]) {
      expect(xml).not.toContain(mark);
    }
  });
});
