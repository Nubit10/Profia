import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import { createIndependentSpace } from "@/modules/institutions";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import {
  copyResourceToCourses,
  createResource,
  getQuotaStatus,
  getResource,
  listResourceCopyTargets,
  type GenerationDeps,
} from "@/modules/resources";
import type { Blueprint, QuizContent } from "@/modules/resources/client";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0028: usar el mismo recurso en mis otros grupos, sin gastar cupo.

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const DBA1 = "MEN-DBA-MAT-V2-G6-01";
const META = {
  provider: "groq",
  model: "qwen/qwen3.8-27b",
  attempts: 1,
  latencyMs: 2100,
  tokens: 2300,
};

const question = (i: number, codes = [DBA1]) => ({
  type: "MULTIPLE_CHOICE" as const,
  stem: `Pregunta ${i}: ¿cuál es el menor número entero?`,
  options: ["−3", "0", "2", "5"],
  answer: "−3",
  explanation: "Está más a la izquierda en la recta.",
  cognitiveLevel: "REMEMBER" as const,
  dbaCodes: codes,
});

const quizBody = (n: number, codes = [DBA1]) => ({
  quiz: {
    title: "Quiz de enteros",
    instructions: "Responde cada pregunta.",
    questions: Array.from({ length: n }, (_, i) => question(i + 1, codes)),
  },
  meta: { ...META, promptVersion: "quiz.v1" },
});

/** AI Engine simulado: responde según la ruta y guarda las peticiones. */
function engine(responses: Record<string, () => Response>) {
  return vi.fn(async (url: URL | string) => {
    const route = new URL(String(url)).pathname;
    const respond = responses[route];
    if (!respond) throw new Error(`ruta inesperada ${route}`);
    return respond();
  });
}
const ok = (body: unknown) => () => Response.json(body);

/** Planificador de prueba: corre la generación y permite esperarla (en producción, after()). */
function deps(fetcher: typeof fetch): GenerationDeps & { done: () => Promise<unknown> } {
  const tasks: Promise<void>[] = [];
  return {
    fetcher,
    schedule: (task) => {
      tasks.push(task());
    },
    done: () => Promise.all(tasks),
  };
}

async function teacherWithTopic(subjectName = "Matemáticas") {
  const user = await createUser("Profe");
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
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
    title: "Números enteros",
    description: null,
  });
  const topic = await createTopic(ctx, {
    unitId: unit.id,
    title: "La recta numérica",
    description: "Orden de enteros",
    plannedSessions: 4,
  });
  return { user, ctx, course, topic };
}

const quizBlueprint = (topicId: string, objectiveIds: string[] = []): Blueprint => ({
  type: "QUIZ",
  topicId,
  objectiveIds,
  durationMinutes: 30,
  difficulty: "BASIC",
  itemCount: 4,
  questionTypes: ["MULTIPLE_CHOICE"],
  cognitiveDistribution: { REMEMBER: 100 },
  notes: null,
  excludedPreferenceIds: [],
});

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

async function group(
  ctx: TenantContext,
  groupName: string,
  subjectName = "Matemáticas",
  grade = "G6",
) {
  const subject = (await listSubjects(ctx)).find((s) => s.name === subjectName)!;
  const course = await createCourse(ctx, {
    subjectId: subject.id,
    grade: grade as "G6",
    groupName,
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, course.id);
  return course;
}

async function quizIn601() {
  const teacher = await teacherWithTopic();
  const fetcher = engine({ "/v1/generation/quiz": ok(quizBody(4)) });
  const d = deps(fetcher as unknown as typeof fetch);
  const { id } = await createResource(teacher.ctx, quizBlueprint(teacher.topic.id), d);
  await d.done();
  return { ...teacher, resourceId: id };
}

describe("usar en mis otros grupos (SPEC-0028)", () => {
  it("CA-0028-01/02: copia en borrador, versión 1, mismo contenido, tema emparejado o creado, sin cupo", async () => {
    const { ctx, resourceId } = await quizIn601();
    const g602 = await group(ctx, "602");
    const g603 = await group(ctx, "603");
    // 602 ya tiene el tema, con otras mayúsculas y sin tilde.
    const unit = await createUnit(ctx, {
      courseId: g602.id,
      periodNumber: 1,
      title: "Otra unidad",
      description: null,
    });
    const existing = await createTopic(ctx, {
      unitId: unit.id,
      title: "LA RECTA NUMERICA",
      description: null,
      plannedSessions: null,
    });
    const before = await getQuotaStatus(ctx);

    const targets = await listResourceCopyTargets(ctx, resourceId);
    expect(targets.map((t) => t.label)).toEqual(["6° 602 · 2026", "6° 603 · 2026"]);
    const copies = await copyResourceToCourses(ctx, resourceId, [g602.id, g603.id]);
    expect(copies).toHaveLength(2);
    expect((await getQuotaStatus(ctx)).used).toBe(before.used);

    const original = await getResource(ctx, resourceId);
    const in602 = await getResource(ctx, copies[0]!.resourceId);
    expect(in602.courseId).toBe(g602.id);
    expect(in602.status).toBe("DRAFT");
    expect(in602.version).toBe(1);
    expect(in602.context.topic.id).toBe(existing.id);
    expect((in602.data!.content as QuizContent).questions).toEqual(
      (original.data!.content as QuizContent).questions,
    );
    expect(copies[0]!.createdTopic).toBe(false);

    const in603 = await getResource(ctx, copies[1]!.resourceId);
    expect(copies[1]!.createdTopic).toBe(true);
    const topic = await db.topic.findUniqueOrThrow({
      where: { id: in603.context.topic.id },
      include: { unit: true },
    });
    expect(topic.title).toBe("La recta numérica");
    expect(topic.unit.title).toBe("Números enteros");
    expect(topic.unit.courseId).toBe(g603.id);
  });

  it("CA-0028-04: otra asignatura o grado no se ofrece y el servidor la rechaza sin copiar nada", async () => {
    const { ctx, resourceId } = await quizIn601();
    const g602 = await group(ctx, "602");
    const other = await group(ctx, "701", "Matemáticas", "G7");
    const targets = await listResourceCopyTargets(ctx, resourceId);
    expect(targets.map((t) => t.id)).toEqual([g602.id]);
    await expect(copyResourceToCourses(ctx, resourceId, [g602.id, other.id])).rejects.toThrow(
      /misma asignatura y grado/,
    );
    expect(await db.resource.count({ where: { courseId: g602.id } })).toBe(0);
  });

  it("CA-0028-05: no se copia un recurso ajeno ni a un curso ajeno", async () => {
    const { ctx, resourceId } = await quizIn601();
    const other = await createUser("Otra");
    const { institutionId } = await createIndependentSpace(other);
    const otherCtx = await ctxFor(other, institutionId);
    const foreign = await group(otherCtx, "602");
    await expect(copyResourceToCourses(otherCtx, resourceId, [foreign.id])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(copyResourceToCourses(ctx, resourceId, [foreign.id])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(listResourceCopyTargets(otherCtx, resourceId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("CA-0028-03: un examen con dos temas se copia con sus dos temas emparejados", async () => {
    const { ctx, course, topic } = await teacherWithTopic();
    const unit = await db.topic.findUniqueOrThrow({ where: { id: topic.id } });
    const second = await createTopic(ctx, {
      unitId: unit.unitId,
      title: "Valor absoluto",
      description: null,
      plannedSessions: null,
    });
    const topics = [
      { id: topic.id, title: "La recta numérica", description: null },
      { id: second.id, title: "Valor absoluto", description: null },
    ];
    const membership = await db.membership.findFirstOrThrow({ where: { id: ctx.membershipId } });
    const exam = await db.resource.create({
      data: {
        institutionId: ctx.institutionId,
        membershipId: membership.id,
        courseId: course.id,
        topicId: topic.id,
        type: "EXAM",
        status: "READY",
        title: "Examen de enteros",
        blueprint: {
          type: "EXAM",
          scope: { kind: "TOPICS" },
          topicIds: [topic.id, second.id],
          objectiveIds: [],
        },
        context: {
          subject: "Matemáticas",
          grade: "6°",
          topic: topics[0],
          topics,
          objectives: [],
          dba: [],
        },
        currentVersion: 1,
        versions: {
          create: {
            number: 1,
            source: "AI",
            content: {
              title: "Examen de enteros",
              topics: topics.map(({ id, title }) => ({ id, title })),
              sections: [{ questions: [{ id: "q1", topicId: second.id }] }],
            },
          },
        },
        topics: {
          create: [
            { topicId: topic.id, position: 0 },
            { topicId: second.id, position: 1 },
          ],
        },
      },
    });
    const g602 = await group(ctx, "602");
    const [copy] = await copyResourceToCourses(ctx, exam.id, [g602.id]);
    const links = await db.resourceTopic.findMany({
      where: { resourceId: copy!.resourceId },
      orderBy: { position: "asc" },
      include: { topic: { include: { unit: true } } },
    });
    expect(links.map((l) => l.topic.title)).toEqual(["La recta numérica", "Valor absoluto"]);
    expect(links.every((l) => l.topic.unit.courseId === g602.id)).toBe(true);
    const version = await db.resourceVersion.findFirstOrThrow({
      where: { resourceId: copy!.resourceId },
    });
    const content = version.content as { sections: { questions: { topicId: string }[] }[] };
    expect(content.sections[0]!.questions[0]!.topicId).toBe(links[1]!.topicId);
    const status = await db.resource.findUniqueOrThrow({ where: { id: copy!.resourceId } });
    expect(status.status).toBe("DRAFT");
  });
});
