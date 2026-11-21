import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import { previewResource } from "@/modules/documents";
import { createIndependentSpace } from "@/modules/institutions";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import {
  DAILY_LIMIT,
  createResource,
  decideAdjustment,
  getQuotaStatus,
  getResource,
  regenerateItem,
  requestAdjustment,
  saveResourceContent,
  setResourceStatus,
  type GenerationDeps,
} from "@/modules/resources";
import {
  adjustedBlueprint,
  availableAdjustments,
  type Blueprint,
  type QuizContent,
} from "@/modules/resources/client";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0027: ajustes rápidos con botones (propuesta del recurso completo y fichas por ítem).

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

const bodyOf = (fetcher: ReturnType<typeof engine>, i = 0) =>
  JSON.parse(String((fetcher.mock.calls[i] as unknown as [URL, RequestInit])[1].body));

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

async function quizReady(n = 4) {
  const teacher = await teacherWithTopic();
  const fetcher = engine({ "/v1/generation/quiz": ok(quizBody(n)) });
  const d = deps(fetcher as unknown as typeof fetch);
  const { id } = await createResource(teacher.ctx, quizBlueprint(teacher.topic.id), d);
  await d.done();
  return { ...teacher, resourceId: id };
}

/** El AI Engine devuelve la versión ajustada: preguntas con otro enunciado. */
const adjustedBody = (n: number) => {
  const body = quizBody(n);
  body.quiz.title = "Quiz de enteros (más fácil)";
  body.quiz.questions = body.quiz.questions.map((q, i) => ({
    ...q,
    stem: `Más fácil ${i + 1}: ¿qué número es menor, −3 o 2?`,
  }));
  return { ...body, meta: { ...body.meta, promptVersion: "quiz.v1+math_check.v1+adjust.v1" } };
};

async function adjust(
  ctx: Parameters<typeof requestAdjustment>[0],
  resourceId: string,
  response: () => Response = ok(adjustedBody(4)),
  code: Parameters<typeof requestAdjustment>[2] = "EASIER",
) {
  const fetcher = engine({ "/v1/generation/quiz": response });
  // La generación corre solo al llamar `done()`: así se ve el estado "ajustando".
  const tasks: (() => Promise<void>)[] = [];
  const d: GenerationDeps = {
    fetcher: fetcher as unknown as typeof fetch,
    schedule: (task) => {
      tasks.push(task);
    },
  };
  const { id } = await requestAdjustment(ctx, resourceId, code, d);
  return { id, fetcher, done: () => Promise.all(tasks.map((t) => t())) };
}

describe("ajustes rápidos con botones (SPEC-0027)", () => {
  it("CA-0027-01/09: el ajuste se pide en segundo plano, con código y versión actual, y cuesta 1", async () => {
    const { ctx, resourceId } = await quizReady();
    const before = await getQuotaStatus(ctx);
    const { id, fetcher, done } = await adjust(ctx, resourceId);

    // Mientras se ajusta, la versión actual sigue visible.
    const during = await getResource(ctx, resourceId);
    expect(during.adjustment).toMatchObject({ id, status: "GENERATING", code: "EASIER" });
    expect(during.version).toBe(1);
    expect(during.data).not.toBeNull();
    expect((await getQuotaStatus(ctx)).used).toBe(before.used + 1);

    await done();
    const sent = bodyOf(fetcher);
    expect(sent.adjust.code).toBe("EASIER");
    expect(sent.adjust.current.questions).toHaveLength(4);
    expect(sent.adjust.current.questions[0].id).toBeUndefined();
    // Más fácil baja un nivel de dificultad (BASIC ya es el mínimo) y no lleva texto del docente.
    expect(sent.difficulty).toBe("BASIC");
    expect(sent.instruction).toBeUndefined();

    const after = await getResource(ctx, resourceId);
    expect(after.adjustment?.status).toBe("PROPOSED");
    expect(after.version).toBe(1);
    const log = await db.generationLog.findFirst({
      where: { entityId: resourceId, promptVersion: { contains: "adjust.v1" } },
    });
    expect(log).not.toBeNull();
  });

  it("CA-0027-02: «Quedarme con esta» crea la versión siguiente con origen IA y conserva la anterior", async () => {
    const { ctx, resourceId } = await quizReady();
    await setResourceStatus(ctx, resourceId, "READY");
    const { id, done } = await adjust(ctx, resourceId);
    await done();
    const { version } = await decideAdjustment(ctx, id, true);
    expect(version).toBe(2);
    const resource = await getResource(ctx, resourceId);
    expect(resource.version).toBe(2);
    // RN-07: contenido nuevo sin revisar vuelve a borrador.
    expect(resource.status).toBe("DRAFT");
    expect((resource.data!.content as QuizContent).questions[0]!.stem).toMatch(/^Más fácil 1/);
    expect(resource.adjustment).toBeNull();
    const versions = await db.resourceVersion.findMany({
      where: { resourceId },
      orderBy: { number: "asc" },
    });
    expect(versions.map((v) => v.source)).toEqual(["AI", "AI"]);
    await expect(decideAdjustment(ctx, id, true)).rejects.toThrow(/ya fue decidido/);
  });

  it("CA-0027-03: «Volver a la anterior» no crea versión", async () => {
    const { ctx, resourceId } = await quizReady();
    const { id, done } = await adjust(ctx, resourceId);
    await done();
    const { version } = await decideAdjustment(ctx, id, false);
    expect(version).toBe(1);
    const resource = await getResource(ctx, resourceId);
    expect(resource.version).toBe(1);
    expect((resource.data!.content as QuizContent).questions[0]!.stem).toMatch(/^Pregunta 1/);
    expect(resource.adjustment).toBeNull();
  });

  it("CA-0027-06: si la IA falla, el recurso queda igual y el cupo no cambia", async () => {
    const { ctx, resourceId } = await quizReady();
    const before = await getQuotaStatus(ctx);
    const { id, done } = await adjust(ctx, resourceId, () => new Response("x", { status: 502 }));
    await done();
    const resource = await getResource(ctx, resourceId);
    expect(resource.adjustment).toMatchObject({ id, status: "FAILED" });
    expect(resource.version).toBe(1);
    expect((await getQuotaStatus(ctx)).used).toBe(before.used);
    // "Entendido" cierra el aviso.
    await decideAdjustment(ctx, id, false);
    expect((await getResource(ctx, resourceId)).adjustment).toBeNull();
  });

  it("CA-0027-07: sin cupo no se llama al AI Engine", async () => {
    const { ctx, resourceId } = await quizReady();
    const resource = await db.resource.findUniqueOrThrow({ where: { id: resourceId } });
    await db.resourceAdjustment.createMany({
      data: Array.from({ length: DAILY_LIMIT - 1 }, () => ({
        institutionId: ctx.institutionId,
        resourceId,
        membershipId: ctx.membershipId,
        code: "HARDER",
        fromVersion: resource.currentVersion,
        status: "DISCARDED" as const,
      })),
    });
    const fetcher = engine({});
    await expect(
      requestAdjustment(ctx, resourceId, "EASIER", deps(fetcher as unknown as typeof fetch)),
    ).rejects.toThrow(/límite/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("CA-0027-12: un ajuste a la vez por recurso", async () => {
    const { ctx, resourceId } = await quizReady();
    const first = await adjust(ctx, resourceId);
    await expect(adjust(ctx, resourceId)).rejects.toThrow(/Ya estamos ajustando/);
    await first.done();
  });

  it("RN-04/RN-05: pedir otro ajuste descarta la propuesta anterior; editar después se avisa", async () => {
    const { ctx, resourceId } = await quizReady();
    const first = await adjust(ctx, resourceId);
    await first.done();
    const current = await getResource(ctx, resourceId);
    const content = current.data!.content as QuizContent;
    await saveResourceContent(ctx, resourceId, 1, { ...content, title: "Editado a mano" });
    const resource = await getResource(ctx, resourceId);
    expect(resource.adjustment?.fromVersion).toBe(1);
    expect(resource.version).toBe(2);

    const second = await adjust(ctx, resourceId, ok(adjustedBody(4)), "HARDER");
    await second.done();
    const old = await db.resourceAdjustment.findUniqueOrThrow({ where: { id: first.id } });
    expect(old.status).toBe("DISCARDED");
  });

  it("CA-0027-04: examen sin «Más corto» ni «Agregar»; quiz con «Agregar 2» pide 2 más", async () => {
    const { ctx, resourceId } = await quizReady();
    const resource = await getResource(ctx, resourceId);
    expect(availableAdjustments(resource.data!)).toEqual([
      "EASIER",
      "HARDER",
      "SHORTER",
      "EVERYDAY_EXAMPLES",
      "ADD_ITEMS",
    ]);
    const add = adjustedBlueprint(resource.blueprint, resource.data!, "ADD_ITEMS") as Extract<
      Blueprint,
      { type: "QUIZ" }
    >;
    expect(add.itemCount).toBe(6);
    const shorter = adjustedBlueprint(resource.blueprint, resource.data!, "SHORTER") as Extract<
      Blueprint,
      { type: "QUIZ" }
    >;
    expect(shorter.itemCount).toBe(3);
    const exam = {
      type: "EXAM" as const,
      content: { title: "E", durationMinutes: 60, instructions: "", sections: [] },
    };
    expect(availableAdjustments(exam as never)).toEqual(["EASIER", "HARDER", "EVERYDAY_EXAMPLES"]);
  });

  it("la propuesta se ve como el documento que se imprime, sin guardarla", async () => {
    const { ctx, resourceId } = await quizReady();
    const { done } = await adjust(ctx, resourceId);
    await done();
    const resource = await getResource(ctx, resourceId);
    const model = await previewResource(ctx, resourceId, {
      content: resource.adjustment!.proposal!.content,
    });
    const stems = model.blocks.filter((b) => b.kind === "question").map((b) => b.stem);
    expect(stems[0]).toMatch(/^Más fácil 1/);
    expect(model.logo).toBeNull();
    expect((await getResource(ctx, resourceId)).version).toBe(1);
  });

  it("CA-0027-08: la ficha «Otra pregunta» propone sin texto escrito", async () => {
    const { ctx, resourceId } = await quizReady();
    const resource = await getResource(ctx, resourceId);
    const itemKey = (resource.data!.content as QuizContent).questions[0]!.id;
    const fetcher = engine({
      "/v1/generation/item": ok({
        item: { ...question(9), stem: "Otra: ¿cuál es mayor, −1 o −4?", answer: "−3" },
        meta: { ...META, promptVersion: "item_regenerate.v1+adjust.v1" },
      }),
    });
    const result = await regenerateItem(
      ctx,
      resourceId,
      itemKey,
      { adjustment: "ANOTHER" },
      fetcher as unknown as typeof fetch,
    );
    expect(result.status).toBe("ok");
    const sent = bodyOf(fetcher);
    expect(sent).toMatchObject({ adjust: "ANOTHER", instruction: null });
    const row = await db.itemRegeneration.findFirstOrThrow({ where: { resourceId } });
    expect(row.instruction).toBe("Otra pregunta");
  });

  it("CA-0027-10: otro docente no puede pedir ni decidir ajustes ajenos", async () => {
    const { ctx, resourceId } = await quizReady();
    const { id, done } = await adjust(ctx, resourceId);
    await done();
    const other = await createUser("Otra");
    const { institutionId } = await createIndependentSpace(other);
    const otherCtx = await ctxFor(other, institutionId);
    await expect(
      requestAdjustment(
        otherCtx,
        resourceId,
        "EASIER",
        deps(engine({}) as unknown as typeof fetch),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(decideAdjustment(otherCtx, id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getResource(ctx, resourceId)).version).toBe(1);
  });
});
