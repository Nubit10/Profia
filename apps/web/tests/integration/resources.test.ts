import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import { createIndependentSpace } from "@/modules/institutions";
import { createObjective, createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import {
  DAILY_LIMIT,
  addPreference,
  createResource,
  decideRegeneration,
  duplicateResource,
  getResource,
  getResourceFormContext,
  listCourseResources,
  promptQualityMetrics,
  rateItem,
  rateResource,
  regenerateItem,
  retryResource,
  saveResourceContent,
  setResourceStatus,
  updatePreference,
  type GenerationDeps,
} from "@/modules/resources";
import type { Blueprint, QuizContent } from "@/modules/resources/client";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

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

const activity = (i: number) => ({
  title: `Actividad ${i}`,
  instructions: "Dibuja una recta numérica y ubica los números dados.",
  durationMinutes: 15,
  expectedOutcome: "Recta con los números ubicados.",
  cognitiveLevel: "APPLY" as const,
  dbaCodes: [DBA1],
});

const workshopBody = {
  workshop: {
    title: "Taller de la recta",
    purpose: "Comparar números enteros.",
    studentInstructions: "Trabaja en parejas.",
    materials: ["Cuaderno"],
    moments: [
      { name: "Inicio", activities: [activity(1)] },
      { name: "Desarrollo", activities: [activity(2), activity(3)] },
      { name: "Cierre", activities: [activity(4)] },
    ],
    teacherGuidance: ["Revisa que ubiquen el cero."],
  },
  meta: { ...META, promptVersion: "workshop.v1" },
};

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

const bodyOf = (fetcher: ReturnType<typeof engine>, i = 0) =>
  JSON.parse(String((fetcher.mock.calls[i] as unknown as [URL, RequestInit])[1].body));

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("talleres y quices con IA (SPEC-0008)", () => {
  it("CA-0008-01/04: el quiz se crea en 'generando', termina en borrador y queda en la biblioteca", async () => {
    const { ctx, course, topic } = await teacherWithTopic();
    const objective = await createObjective(ctx, {
      topicId: topic.id,
      statement: "Compara números enteros usando la recta numérica.",
      links: [{ code: DBA1, evidenceIndexes: [] }],
    });
    const fetcher = engine({ "/v1/generation/quiz": ok(quizBody(4)) });
    const run = deps(fetcher as unknown as typeof fetch);

    const { id } = await createResource(ctx, quizBlueprint(topic.id, [objective.id]), run);
    // La acción responde antes de que termine la IA (RN-05).
    expect((await listCourseResources(ctx, course.id))[0]).toMatchObject({ id });
    await run.done();

    const resource = await getResource(ctx, id);
    expect(resource).toMatchObject({ status: "DRAFT", version: 1, model: "qwen/qwen3.8-27b" });
    expect(resource.promptVersion).toBe("quiz.v1");
    const content = resource.data!.content as QuizContent;
    expect(content.questions).toHaveLength(4);
    expect(new Set(content.questions.map((q) => q.id)).size).toBe(4);

    // Solo los DBA de los objetivos elegidos viajan al AI Engine (menos tokens, más foco).
    const body = bodyOf(fetcher);
    expect(body.dba.map((d: { code: string }) => d.code)).toEqual([DBA1]);
    expect(body.objectives).toEqual(["Compara números enteros usando la recta numérica."]);

    const log = await db.generationLog.findFirstOrThrow({ where: { entityId: id } });
    expect(log).toMatchObject({ task: "quiz", status: "OK", tokens: 2300 });
    // RN-01: nada queda "listo" sin acción del docente.
    expect(resource.status).not.toBe("READY");
  });

  it("CA-0008-02: el taller se guarda con sus momentos y actividades", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const run = deps(
      engine({ "/v1/generation/workshop": ok(workshopBody) }) as unknown as typeof fetch,
    );
    const { id } = await createResource(
      ctx,
      {
        type: "WORKSHOP",
        topicId: topic.id,
        objectiveIds: [],
        durationMinutes: 60,
        difficulty: "INTERMEDIATE",
        itemCount: 4,
        structure: "START_DEVELOPMENT_CLOSE",
        cognitiveDistribution: { APPLY: 100 },
        notes: "Trabajarán en parejas",
        excludedPreferenceIds: [],
      },
      run,
    );
    await run.done();
    const resource = await getResource(ctx, id);
    expect(resource.data?.type).toBe("WORKSHOP");
    if (resource.data?.type !== "WORKSHOP") return;
    expect(resource.data.content.moments.map((m) => m.name)).toEqual([
      "Inicio",
      "Desarrollo",
      "Cierre",
    ]);
  });

  it("CA-0008-05: la petición no lleva nombre, correo ni institución; las notas van sin contacto", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const fetcher = engine({ "/v1/generation/quiz": ok(quizBody(4)) });
    const run = deps(fetcher as unknown as typeof fetch);
    await createResource(
      ctx,
      { ...quizBlueprint(topic.id), notes: "Escríbanme a profe@colegio.co o al 300 123 4567" },
      run,
    );
    await run.done();
    const raw = String((fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1].body);
    for (const personal of [ctx.userName, ctx.userEmail, ctx.institutionName, ctx.institutionId]) {
      expect(raw).not.toContain(personal);
    }
    expect(raw).not.toContain("profe@colegio.co");
    expect(raw).not.toContain("300 123 4567");
    expect(Object.keys(bodyOf(fetcher)).sort()).toEqual([
      "cognitiveDistribution",
      "dba",
      "difficulty",
      "durationMinutes",
      "grade",
      "itemCount",
      "notes",
      "objectives",
      "preferences",
      "questionTypes",
      "subject",
      "topic",
    ]);
  });

  it("CA-0008-04: si la IA falla queda 'fallido' y se puede reintentar", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const down = deps(
      engine({
        "/v1/generation/quiz": () => new Response(null, { status: 503 }),
      }) as unknown as typeof fetch,
    );
    const { id } = await createResource(ctx, quizBlueprint(topic.id), down);
    await down.done();
    expect(await getResource(ctx, id)).toMatchObject({
      status: "FAILED",
      failureReason: "unavailable",
    });

    const invalid = deps(
      engine({
        "/v1/generation/quiz": () => new Response(null, { status: 502 }),
      }) as unknown as typeof fetch,
    );
    await retryResource(ctx, id, invalid);
    await invalid.done();
    expect(await getResource(ctx, id)).toMatchObject({
      status: "FAILED",
      failureReason: "invalid",
    });

    const up = deps(engine({ "/v1/generation/quiz": ok(quizBody(4)) }) as unknown as typeof fetch);
    await retryResource(ctx, id, up);
    await up.done();
    expect(await getResource(ctx, id)).toMatchObject({ status: "DRAFT", failureReason: null });
  });

  it("una generación interrumpida (reinicio del servidor) pasa a fallida al abrir la biblioteca", async () => {
    const { ctx, course, topic } = await teacherWithTopic();
    const { id } = await createResource(ctx, quizBlueprint(topic.id), {
      schedule: () => undefined,
    });
    await db.resource.update({
      where: { id },
      data: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    const [listed] = await listCourseResources(ctx, course.id);
    expect(listed).toMatchObject({ id, status: "FAILED" });
    expect((await getResource(ctx, id)).failureReason).toBe("interrupted");
  });

  it("CA-0008-06: editar crea una versión nueva y conserva la original", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const run = deps(engine({ "/v1/generation/quiz": ok(quizBody(4)) }) as unknown as typeof fetch);
    const { id } = await createResource(ctx, quizBlueprint(topic.id), run);
    await run.done();
    const original = (await getResource(ctx, id)).data!.content as QuizContent;

    const edited: QuizContent = {
      ...original,
      questions: original.questions.map((q, i) =>
        i === 0 ? { ...q, stem: "¿Qué número es menor que −2?", dbaCodes: [DBA1, "INVENTADO"] } : q,
      ),
    };
    expect(await saveResourceContent(ctx, id, 1, edited)).toEqual({ version: 2 });

    const resource = await getResource(ctx, id);
    const current = resource.data!.content as QuizContent;
    expect(current.questions[0]!.stem).toBe("¿Qué número es menor que −2?");
    // Defensa en profundidad: un código fuera del contexto no se guarda.
    expect(current.questions[0]!.dbaCodes).toEqual([DBA1]);
    const versions = await db.resourceVersion.findMany({
      where: { resourceId: id },
      orderBy: { number: "asc" },
    });
    expect(versions.map((v) => v.source)).toEqual(["AI", "TEACHER"]);
    expect((versions[0]!.content as QuizContent).questions[0]!.stem).toBe(
      original.questions[0]!.stem,
    );

    // Guardar sobre una versión vieja (otra pestaña) se rechaza.
    await expect(saveResourceContent(ctx, id, 1, edited)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    // Una opción correcta que no está entre las opciones no se acepta.
    const broken = { ...current, questions: [{ ...current.questions[0]!, answer: "99" }] };
    await expect(saveResourceContent(ctx, id, 2, broken)).rejects.toMatchObject({
      code: "INVALID",
    });

    await setResourceStatus(ctx, id, "READY");
    expect((await getResource(ctx, id)).status).toBe("READY");
    const copy = await duplicateResource(ctx, id);
    expect(await getResource(ctx, copy.id)).toMatchObject({ status: "DRAFT", version: 1 });
  });

  it("CA-0008-07: regenerar una pregunta propone, registra la indicación y reemplaza solo si se acepta", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const run = deps(engine({ "/v1/generation/quiz": ok(quizBody(4)) }) as unknown as typeof fetch);
    const { id } = await createResource(ctx, quizBlueprint(topic.id), run);
    await run.done();
    const key = ((await getResource(ctx, id)).data!.content as QuizContent).questions[1]!.id;

    const newQuestion = {
      ...question(9),
      stem: "¿Cuál es menor: −8 o −3?",
      options: ["−8", "−3"],
      answer: "−8",
    };
    const fetcher = engine({
      "/v1/generation/item": ok({
        item: newQuestion,
        meta: { ...META, promptVersion: "item_regenerate.v1" },
      }),
    });
    const result = await regenerateItem(
      ctx,
      id,
      key,
      "Hazla más difícil",
      fetcher as unknown as typeof fetch,
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const body = bodyOf(fetcher);
    expect(body).toMatchObject({ kind: "QUIZ_QUESTION", instruction: "Hazla más difícil" });
    expect(body.current).not.toHaveProperty("id");
    expect(body.otherItems).toHaveLength(3);
    // Todavía no cambia nada.
    expect((await getResource(ctx, id)).version).toBe(1);

    expect(await decideRegeneration(ctx, result.proposal.regenerationId, true)).toEqual({
      version: 2,
    });
    const questions = ((await getResource(ctx, id)).data!.content as QuizContent).questions;
    expect(questions[1]).toMatchObject({ id: key, stem: "¿Cuál es menor: −8 o −3?" });
    await expect(
      decideRegeneration(ctx, result.proposal.regenerationId, true),
    ).rejects.toMatchObject({
      code: "INVALID",
    });
    expect(await db.itemRegeneration.findFirstOrThrow()).toMatchObject({
      instruction: "Hazla más difícil",
      decision: "ACCEPTED",
    });
  });

  it("CA-0008-08: la evaluación queda ligada al modelo y la versión del prompt, y suma en las métricas", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const run = deps(engine({ "/v1/generation/quiz": ok(quizBody(4)) }) as unknown as typeof fetch);
    const { id } = await createResource(ctx, quizBlueprint(topic.id), run);
    await run.done();
    const [q1, q2] = ((await getResource(ctx, id)).data!.content as QuizContent).questions;

    await rateResource(ctx, id, 4, "Buen quiz, le faltó contexto");
    await rateItem(ctx, id, q1!.id, "UP", null);
    await rateItem(ctx, id, q2!.id, "DOWN", "Los distractores son obvios");
    await rateItem(ctx, id, q2!.id, "DOWN", "Los distractores son muy obvios"); // actualiza, no duplica

    const resource = await getResource(ctx, id);
    expect(resource).toMatchObject({
      rating: 4,
      promptVersion: "quiz.v1",
      model: "qwen/qwen3.8-27b",
    });
    expect(resource.itemFeedback[q2!.id]).toEqual({
      rating: "DOWN",
      comment: "Los distractores son muy obvios",
    });
    await expect(rateItem(ctx, id, "no-existe", "UP", null)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const metrics = await promptQualityMetrics();
    expect(metrics).toContainEqual(
      expect.objectContaining({
        promptVersion: "quiz.v1",
        model: "qwen/qwen3.8-27b",
        resources: 1,
        averageRating: 4,
        itemsRated: 2,
        downRate: 0.5,
        averageTokens: 2300,
      }),
    );
  });

  it("CA-0008-09: las preferencias van según su alcance y se pueden desactivar o excluir", async () => {
    const { ctx, course, topic } = await teacherWithTopic();
    const math = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
    const other = await createCourse(ctx, {
      subjectId: math.id,
      grade: "G6",
      groupName: "602",
      academicYear: "2026",
    });
    await getCoursePlanning(ctx, other.id);
    const otherUnit = await createUnit(ctx, {
      courseId: other.id,
      periodNumber: 1,
      title: "U",
      description: null,
    });
    const otherTopic = await createTopic(ctx, {
      unitId: otherUnit.id,
      title: "Fracciones",
      description: null,
      plannedSessions: null,
    });

    const local = await addPreference(ctx, course.id, {
      text: "Usa ejemplos con dinero",
      scope: "COURSE",
    });
    await addPreference(ctx, course.id, { text: "Preguntas más cortas", scope: "ALL" });

    const fetcher = engine({ "/v1/generation/quiz": ok(quizBody(4)) });
    const run = deps(fetcher as unknown as typeof fetch);
    await createResource(ctx, quizBlueprint(topic.id), run);
    await createResource(ctx, quizBlueprint(otherTopic.id), run);
    await run.done();
    expect(bodyOf(fetcher, 0).preferences.sort()).toEqual([
      "Preguntas más cortas",
      "Usa ejemplos con dinero",
    ]);
    expect(bodyOf(fetcher, 1).preferences).toEqual(["Preguntas más cortas"]);

    // El docente las ve en el formulario, puede excluir una en esta generación o desactivarla.
    const form = await getResourceFormContext(ctx, topic.id);
    expect(form.preferences.map((p) => p.scope).sort()).toEqual(["ALL", "COURSE"]);
    const run2 = deps(fetcher as unknown as typeof fetch);
    await createResource(
      ctx,
      { ...quizBlueprint(topic.id), excludedPreferenceIds: [local.id] },
      run2,
    );
    await run2.done();
    expect(bodyOf(fetcher, 2).preferences).toEqual(["Preguntas más cortas"]);

    await updatePreference(ctx, local.id, { scope: "ALL" });
    const run3 = deps(fetcher as unknown as typeof fetch);
    await createResource(ctx, quizBlueprint(otherTopic.id), run3);
    await run3.done();
    expect(bodyOf(fetcher, 3).preferences).toHaveLength(2);
  });

  it("CA-0008-10: con 3 en curso o el cupo diario agotado no se llama a la IA", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const fetcher = engine({ "/v1/generation/quiz": ok(quizBody(4)) });
    const pending = { fetcher: fetcher as unknown as typeof fetch, schedule: () => undefined };
    for (let i = 0; i < 3; i++) await createResource(ctx, quizBlueprint(topic.id), pending);
    await expect(createResource(ctx, quizBlueprint(topic.id), pending)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });

    // Simula el resto del cupo del día ya usado (las fallidas no cuentan).
    await db.resource.updateMany({ data: { status: "DRAFT" } });
    for (let i = 0; i < DAILY_LIMIT - 3; i++) {
      await db.resource.create({
        data: {
          institutionId: ctx.institutionId,
          membershipId: ctx.membershipId,
          courseId: (await db.resource.findFirstOrThrow()).courseId,
          topicId: topic.id,
          type: "QUIZ",
          status: "DRAFT",
          title: "Quiz",
          blueprint: {},
          context: { topic: { title: "x" } },
          generationId: "log",
        },
      });
    }
    await expect(createResource(ctx, quizBlueprint(topic.id), pending)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: expect.stringContaining("Podrás generar otro desde las"),
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect((await getResourceFormContext(ctx, topic.id)).quota).toMatchObject({
      used: DAILY_LIMIT,
      limit: DAILY_LIMIT,
    });
  });

  it("CA-0008-11: recursos, versiones y evaluaciones ajenos responden NOT_FOUND", async () => {
    const a = await teacherWithTopic();
    const b = await teacherWithTopic();
    const run = deps(engine({ "/v1/generation/quiz": ok(quizBody(4)) }) as unknown as typeof fetch);
    const { id } = await createResource(a.ctx, quizBlueprint(a.topic.id), run);
    await run.done();
    const key = ((await getResource(a.ctx, id)).data!.content as QuizContent).questions[0]!.id;

    const fetcher = vi.fn();
    const notFound = { code: "NOT_FOUND" };
    await expect(
      createResource(b.ctx, quizBlueprint(a.topic.id), { fetcher, schedule: () => undefined }),
    ).rejects.toMatchObject(notFound);
    await expect(getResource(b.ctx, id)).rejects.toMatchObject(notFound);
    await expect(saveResourceContent(b.ctx, id, 1, {})).rejects.toMatchObject(notFound);
    await expect(rateResource(b.ctx, id, 5, null)).rejects.toMatchObject(notFound);
    await expect(rateItem(b.ctx, id, key, "UP", null)).rejects.toMatchObject(notFound);
    await expect(regenerateItem(b.ctx, id, key, "otra", fetcher)).rejects.toMatchObject(notFound);
    await expect(setResourceStatus(b.ctx, id, "READY")).rejects.toMatchObject(notFound);
    await expect(duplicateResource(b.ctx, id)).rejects.toMatchObject(notFound);
    await expect(listCourseResources(b.ctx, a.course.id)).rejects.toMatchObject(notFound);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("CA-0008-12: un tema sin DBA (Religión) se genera sin citas", async () => {
    const { ctx, topic } = await teacherWithTopic("Educación Religiosa");
    const fetcher = engine({ "/v1/generation/quiz": ok(quizBody(4, [])) });
    const run = deps(fetcher as unknown as typeof fetch);
    const { id } = await createResource(ctx, quizBlueprint(topic.id), run);
    await run.done();
    expect(bodyOf(fetcher).dba).toEqual([]);
    expect((await getResourceFormContext(ctx, topic.id)).hasDba).toBe(false);
    expect((await getResource(ctx, id)).status).toBe("DRAFT");
  });
});
