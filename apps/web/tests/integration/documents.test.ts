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
  setResourceStatus,
} from "@/modules/resources";
import type { QuizContent } from "@/modules/resources/client";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");

const quizBody = {
  quiz: {
    title: "Quiz de enteros",
    instructions: "Responde cada pregunta.",
    questions: Array.from({ length: 4 }, (_, i) => ({
      type: "MULTIPLE_CHOICE",
      stem: `Pregunta original ${i + 1}: ¿cuál es el menor?`,
      options: ["−3", "0", "2", "5"],
      answer: "−3",
      explanation: "Está más a la izquierda.",
      cognitiveLevel: "REMEMBER",
      dbaCodes: ["MEN-DBA-MAT-V2-G6-01"],
    })),
  },
  meta: {
    provider: "groq",
    model: "qwen/qwen3.8-27b",
    promptVersion: "quiz.v1",
    attempts: 1,
    latencyMs: 900,
    tokens: 2000,
  },
};

async function teacherWithQuiz() {
  const user = await createUser("Profe");
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
  const math = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
  const course = await createCourse(ctx, {
    subjectId: math.id,
    grade: "G6",
    groupName: "601",
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, course.id);
  const unit = await createUnit(ctx, {
    courseId: course.id,
    periodNumber: 2,
    title: "Números enteros",
    description: null,
  });
  const topic = await createTopic(ctx, {
    unitId: unit.id,
    title: "La recta numérica",
    description: null,
    plannedSessions: null,
  });
  const tasks: Promise<void>[] = [];
  const { id } = await createResource(
    ctx,
    {
      type: "QUIZ",
      topicId: topic.id,
      objectiveIds: [],
      durationMinutes: 30,
      difficulty: "BASIC",
      itemCount: 4,
      questionTypes: ["MULTIPLE_CHOICE"],
      cognitiveDistribution: { REMEMBER: 100 },
      notes: null,
      excludedPreferenceIds: [],
    },
    {
      fetcher: vi.fn(async () => Response.json(quizBody)) as unknown as typeof fetch,
      schedule: (task) => {
        tasks.push(task());
      },
    },
  );
  await Promise.all(tasks);
  return { user, ctx, course, resourceId: id };
}

/** Cuerpo y pies de página del DOCX (el pie con la versión vive en word/footer*.xml). */
async function docxText(body: Buffer) {
  const zip = await JSZip.loadAsync(body);
  const parts = Object.keys(zip.files).filter((f) => /^word\/(document|footer\d*)\.xml$/.test(f));
  return (await Promise.all(parts.map((f) => zip.file(f)!.async("string")))).join("\n");
}

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("exportar a Word y PDF (SPEC-0009)", () => {
  it("CA-0009-01/05/07: hoja del estudiante con encabezado, marca de borrador y auditoría", async () => {
    const { ctx, resourceId } = await teacherWithQuiz();
    const file = await exportResource(ctx, resourceId, {
      doc: "student",
      format: "docx",
      variant: "A",
    });
    expect(file.filename).toBe("Quiz - La recta numérica - 6°601.docx");
    expect(file.contentType).toContain("wordprocessingml");
    const xml = await docxText(file.body);
    for (const expected of [
      "Docente independiente",
      ctx.userName,
      "Matemáticas",
      "6° 601",
      "Periodo 2",
      "La recta numérica",
      "Nombre:",
      "Pregunta original 1",
      "BORRADOR",
    ]) {
      expect(xml).toContain(expected);
    }
    expect(xml).not.toContain("Está más a la izquierda."); // sin justificaciones (RN-02)

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "resource.exported" } });
    expect(audit).toMatchObject({ entityId: resourceId });
    expect(audit.metadata).toMatchObject({
      version: 1,
      doc: "student",
      format: "docx",
      variant: "A",
    });

    // Un recurso listo sale sin marca.
    await setResourceStatus(ctx, resourceId, "READY");
    const ready = await exportResource(ctx, resourceId, {
      doc: "key",
      format: "docx",
      variant: "A",
    });
    expect(ready.filename).toBe("Clave - Quiz - La recta numérica - 6°601.docx");
    const keyXml = await docxText(ready.body);
    expect(keyXml).not.toContain("BORRADOR");
    expect(keyXml).toContain("Está más a la izquierda.");
  });

  it("CA-0009-04: la versión 1 sigue disponible después de editar", async () => {
    const { ctx, resourceId } = await teacherWithQuiz();
    const content = (await getResource(ctx, resourceId)).data!.content as QuizContent;
    await saveResourceContent(ctx, resourceId, 1, {
      ...content,
      questions: content.questions.map((q) => ({ ...q, stem: `${q.stem} (editada)` })),
    });
    const current = await docxText(
      (await exportResource(ctx, resourceId, { doc: "student", format: "docx", variant: "A" }))
        .body,
    );
    const original = await docxText(
      (
        await exportResource(ctx, resourceId, {
          doc: "student",
          format: "docx",
          variant: "A",
          version: 1,
        })
      ).body,
    );
    expect(current).toContain("(editada)");
    expect(current).toContain("Versión 2 del recurso");
    expect(original).not.toContain("(editada)");
    expect(original).toContain("Versión 1 del recurso");
    await expect(
      exportResource(ctx, resourceId, { doc: "student", format: "pdf", variant: "A", version: 9 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("CA-0009-08/10: PDF de la versión B con nombre propio", async () => {
    const { ctx, resourceId } = await teacherWithQuiz();
    const file = await exportResource(ctx, resourceId, {
      doc: "student",
      format: "pdf",
      variant: "B",
    });
    expect(file.filename).toBe("Quiz - La recta numérica - 6°601 - Versión B.pdf");
    expect(file.body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("CA-0009-06: un recurso ajeno responde NOT_FOUND y uno generándose CONFLICT", async () => {
    const a = await teacherWithQuiz();
    const b = await teacherWithQuiz();
    await expect(
      exportResource(b.ctx, a.resourceId, { doc: "student", format: "pdf", variant: "A" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await db.resource.update({ where: { id: a.resourceId }, data: { status: "GENERATING" } });
    await expect(
      exportResource(a.ctx, a.resourceId, { doc: "student", format: "pdf", variant: "A" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.auditLog.count({ where: { action: "resource.exported" } })).toBe(0);
  });
});
