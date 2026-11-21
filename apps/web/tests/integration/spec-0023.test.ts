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
  getResourceFormContext,
  saveResourceContent,
  type GenerationDeps,
} from "@/modules/resources";
import type { Blueprint, QuizContent } from "@/modules/resources/client";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0023: preguntas tipo Saber con situación, competencia y figura, del motor a la descarga.

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const DBA1 = "MEN-DBA-MAT-V2-G6-01";
const CONTEXT =
  "En una tienda de Sincelejo anotan cada día cuántas arepas venden durante la semana.";

const question = (i: number) => ({
  type: "MULTIPLE_CHOICE" as const,
  stem: `¿Qué día vendieron más arepas? (${i})`,
  options: ["Lunes", "Martes", "Miércoles", "Jueves"],
  answer: "Miércoles",
  explanation: "Es la barra más alta.",
  cognitiveLevel: "APPLY" as const,
  dbaCodes: [DBA1],
  context: CONTEXT,
  competency: i % 2 ? "Formulación y ejecución" : "Interpretación y representación",
  figure:
    i === 0
      ? {
          kind: "BAR_CHART",
          title: "Arepas vendidas",
          categories: ["Lunes", "Martes", "Miércoles", "Jueves"],
          values: [12, 8, 15, 10],
          unit: "arepas",
        }
      : null,
});

const body = {
  quiz: {
    title: "Quiz tipo Saber",
    instructions: "Lee cada situación y responde.",
    questions: [0, 1, 2, 3].map(question),
  },
  meta: {
    provider: "groq",
    model: "qwen/qwen3.8-27b",
    promptVersion: "quiz.v1+math_check.v1+saber.v1",
    attempts: 1,
    latencyMs: 2100,
    tokens: 2300,
    qualityWarnings: [],
    qualityRulesVersion: "quality.v1",
  },
};

async function teacherWithTopic(ctx: TenantContext, subjectName: string) {
  const subject = (await listSubjects(ctx)).find((s) => s.name === subjectName)!;
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
    title: "Unidad 1",
    description: null,
  });
  return createTopic(ctx, {
    unitId: unit.id,
    title: "Datos de la tienda",
    description: null,
    plannedSessions: 4,
  });
}

const blueprint = (topicId: string, saber: boolean): Blueprint => ({
  type: "QUIZ",
  topicId,
  objectiveIds: [],
  durationMinutes: 30,
  difficulty: "BASIC",
  itemCount: 4,
  questionTypes: ["MULTIPLE_CHOICE"],
  cognitiveDistribution: { APPLY: 100 },
  notes: null,
  excludedPreferenceIds: [],
  saber,
});

function engine() {
  const fetcher = vi.fn(async () => Response.json(body));
  const tasks: Promise<void>[] = [];
  const deps: GenerationDeps = {
    fetcher: fetcher as unknown as typeof fetch,
    schedule: (task) => {
      tasks.push(task());
    },
  };
  return { fetcher, deps, done: () => Promise.all(tasks) };
}

async function teacher() {
  const user = await createUser("ProfIA");
  const { institutionId } = await createIndependentSpace(user);
  return ctxFor(user, institutionId);
}

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("preguntas tipo Saber (SPEC-0023)", () => {
  it("CA-0023-01/07: el pedido lleva saber, se guarda y se recuerda la elección", async () => {
    const ctx = await teacher();
    const topic = await teacherWithTopic(ctx, "Matemáticas");
    expect(await getResourceFormContext(ctx, topic.id)).toMatchObject({
      saberAvailable: true,
      lastSaber: false,
    });
    const run = engine();
    const { id } = await createResource(ctx, blueprint(topic.id, true), run.deps);
    await run.done();
    const sent = JSON.parse(
      String((run.fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1].body),
    );
    expect(sent.saber).toBe(true);
    const content = (await getResource(ctx, id)).data!.content as QuizContent;
    expect(content.questions[0]).toMatchObject({
      context: CONTEXT,
      competency: "Interpretación y representación",
      figure: { kind: "BAR_CHART", values: [12, 8, 15, 10] },
    });
    expect(content.questions[1]!.figure).toBeUndefined();
    expect((await getResourceFormContext(ctx, topic.id)).lastSaber).toBe(true);
  });

  it("CA-0023-04: el estilo Saber no aplica en Ciencias Naturales", async () => {
    const ctx = await teacher();
    const topic = await teacherWithTopic(ctx, "Ciencias Naturales y Educación Ambiental");
    expect((await getResourceFormContext(ctx, topic.id)).saberAvailable).toBe(false);
    const run = engine();
    await expect(createResource(ctx, blueprint(topic.id, true), run.deps)).rejects.toMatchObject({
      code: "INVALID",
      field: "saber",
    });
    expect(run.fetcher).not.toHaveBeenCalled();
  });

  it("CA-0023-06/08: Word con situación e imagen, clave con competencia, PDF y quitar la figura", async () => {
    const ctx = await teacher();
    const topic = await teacherWithTopic(ctx, "Matemáticas");
    const run = engine();
    const { id } = await createResource(ctx, blueprint(topic.id, true), run.deps);
    await run.done();

    const sheet = await exportResource(ctx, id, { doc: "student", format: "docx", variant: "A" });
    const zip = await JSZip.loadAsync(sheet.body);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain(CONTEXT);
    expect(xml.indexOf(CONTEXT)).toBeLessThan(xml.indexOf("¿Qué día vendieron más arepas? (0)"));
    const images = Object.keys(zip.files).filter((f) => /^word\/media\/.+\.png$/.test(f));
    expect(images).toHaveLength(1);
    const png = await zip.file(images[0]!)!.async("nodebuffer");
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(xml).toContain("Gráfica de barras «Arepas vendidas»");

    const key = await exportResource(ctx, id, { doc: "key", format: "docx", variant: "B" });
    const keyXml = await (
      await JSZip.loadAsync(key.body)
    )
      .file("word/document.xml")!
      .async("string");
    expect(keyXml).toContain("Competencia: Interpretación y representación.");

    const pdf = await exportResource(ctx, id, { doc: "student", format: "pdf", variant: "A" });
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");

    // El docente quita la figura: se guarda sin ella en una versión nueva.
    const content = (await getResource(ctx, id)).data!.content as QuizContent;
    const first = { ...content.questions[0]! };
    delete first.figure;
    await saveResourceContent(ctx, id, 1, {
      ...content,
      questions: [first, ...content.questions.slice(1)],
    });
    const saved = (await getResource(ctx, id)).data!.content as QuizContent;
    expect(saved.questions[0]!.figure).toBeUndefined();
    expect(saved.questions[0]!.context).toBe(CONTEXT);
  });
});
