import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import {
  acceptInvitation,
  createIndependentSpace,
  createInvitation,
  registerSchool,
} from "@/modules/institutions";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import {
  acceptPreferenceSuggestion,
  addPreference,
  createResource,
  declinePreferenceSuggestion,
  getResource,
  maybeProposePreferences,
  pendingPreferenceSuggestions,
  preferenceSuggestionMetrics,
  promptQualityMetrics,
  rateItem,
  rateResource,
  saveResourceContent,
  setResourceStatus,
  type GenerationDeps,
} from "@/modules/resources";
import { extractBenchmarkCases } from "@/modules/resources/benchmark-cases";
import type { Blueprint, QuizContent } from "@/modules/resources/client";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase, validSchool } from "../support/factories";

// SPEC-0021: mejora continua de la IA con lo que hace el docente.

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const DBA1 = "MEN-DBA-MAT-V2-G6-01";
const META = {
  provider: "groq",
  model: "qwen/qwen3.8-27b",
  attempts: 1,
  latencyMs: 2100,
  tokens: 2300,
};
const SALT = "sal-de-prueba-0123456789";

const quizBody = (n: number, warnings: string[] = []) => ({
  quiz: {
    title: "Quiz de enteros",
    instructions: "Responde cada pregunta.",
    questions: Array.from({ length: n }, (_, i) => ({
      type: "MULTIPLE_CHOICE" as const,
      stem: `Pregunta ${i + 1}: si en una mañana fría la temperatura baja de 0 a −3 grados, ¿cuál es la temperatura final del día?`,
      options: ["−3", "0", "2", "5"],
      answer: "−3",
      explanation: "Está más a la izquierda en la recta.",
      cognitiveLevel: "REMEMBER" as const,
      dbaCodes: [DBA1],
    })),
  },
  meta: {
    ...META,
    promptVersion: "quiz.v1",
    qualityWarnings: warnings,
    qualityRulesVersion: "quality.v1",
  },
});

const SUGGESTION = {
  text: "Escribe enunciados cortos y directos, de una sola oración.",
  reason: "Acortaste 6 enunciados en 3 quices.",
  conflictsWith: null,
};
const suggestionsBody = (suggestions: unknown[] = [SUGGESTION]) => ({
  suggestions,
  meta: { ...META, promptVersion: "preference_suggestions.v1" },
});

function engine(responses: Record<string, () => Response>) {
  return vi.fn(async (url: URL | string) => {
    const route = new URL(String(url)).pathname;
    const respond = responses[route];
    if (!respond) throw new Error(`ruta inesperada ${route}`);
    return respond();
  });
}
const ok = (body: unknown) => () => Response.json(body);

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

const quizBlueprint = (topicId: string): Blueprint => ({
  type: "QUIZ",
  topicId,
  objectiveIds: [],
  durationMinutes: 30,
  difficulty: "BASIC",
  itemCount: 4,
  questionTypes: ["MULTIPLE_CHOICE"],
  cognitiveDistribution: { REMEMBER: 100 },
  notes: null,
  excludedPreferenceIds: [],
});

async function courseWithTopic(ctx: TenantContext, groupName = "601") {
  const subject = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
  const course = await createCourse(ctx, {
    subjectId: subject.id,
    grade: "G6",
    groupName,
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
  return { course, topic };
}

async function teacher() {
  const user = await createUser("Profe");
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
  return { ctx, ...(await courseWithTopic(ctx)) };
}

async function quiz(ctx: TenantContext, topicId: string, warnings: string[] = []) {
  const run = deps(
    engine({ "/v1/generation/quiz": ok(quizBody(4, warnings)) }) as unknown as typeof fetch,
  );
  const { id } = await createResource(ctx, quizBlueprint(topicId), run);
  await run.done();
  return id;
}

/** El docente acorta los dos primeros enunciados: una señal de edición por ítem. */
async function shorten(ctx: TenantContext, id: string) {
  const content = (await getResource(ctx, id)).data!.content as QuizContent;
  await saveResourceContent(ctx, id, 1, {
    ...content,
    questions: content.questions.map((q, i) =>
      i < 2 ? { ...q, stem: `¿Cuánto es 0 − ${i + 3}?` } : q,
    ),
  });
  return content;
}

/** Tres quices con señales: ediciones en dos y un 👎 con comentario en el tercero. */
async function withSignals(ctx: TenantContext, topicId: string) {
  const ids = [await quiz(ctx, topicId), await quiz(ctx, topicId), await quiz(ctx, topicId)];
  await shorten(ctx, ids[0]!);
  await shorten(ctx, ids[1]!);
  const third = (await getResource(ctx, ids[2]!)).data!.content as QuizContent;
  await rateItem(
    ctx,
    ids[2]!,
    third.questions[0]!.id,
    "DOWN",
    "Muy largo para mis estudiantes, escríbeme a profe@colegio.edu.co",
  );
  return ids;
}

const bodyOf = (fetcher: ReturnType<typeof engine>, i = 0) =>
  JSON.parse(String((fetcher.mock.calls[i] as unknown as [URL, RequestInit])[1].body));

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("Parte A: preferencias propuestas (SPEC-0021)", () => {
  it("CA-0021-01: con señales en 3 recursos, al marcar uno listo se crea la propuesta; con 2, no", async () => {
    const { ctx, topic } = await teacher();
    const [a, b] = [await quiz(ctx, topic.id), await quiz(ctx, topic.id)];
    await shorten(ctx, a);
    await shorten(ctx, b);
    const fetcher = engine({ "/v1/generation/preference-suggestions": ok(suggestionsBody()) });
    const early = deps(fetcher as unknown as typeof fetch);
    await setResourceStatus(ctx, a, "READY", early);
    await early.done();
    expect(fetcher).not.toHaveBeenCalled();
    expect(await pendingPreferenceSuggestions(ctx)).toEqual([]);

    const c = await quiz(ctx, topic.id);
    const content = (await getResource(ctx, c)).data!.content as QuizContent;
    await rateItem(ctx, c, content.questions[0]!.id, "DOWN", "Muy largo");
    const run = deps(fetcher as unknown as typeof fetch);
    await setResourceStatus(ctx, b, "READY", run);
    await run.done();

    expect(fetcher).toHaveBeenCalledTimes(1);
    const pending = await pendingPreferenceSuggestions(ctx);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ text: SUGGESTION.text, reason: SUGGESTION.reason });
    // Todas las señales son de un curso: se sugiere ese curso.
    expect(pending[0]!.course).toMatchObject({ id: expect.any(String) });
    const log = await db.generationLog.findFirstOrThrow({ where: { task: "preferences" } });
    expect(log).toMatchObject({ status: "OK", promptVersion: "preference_suggestions.v1" });
  });

  it("CA-0021-02: no se propone otra antes de 7 días ni más de una llamada al día", async () => {
    const { ctx, topic } = await teacher();
    await withSignals(ctx, topic.id);
    const fetcher = engine({ "/v1/generation/preference-suggestions": ok(suggestionsBody()) });
    const f = fetcher as unknown as typeof fetch;
    expect(await maybeProposePreferences(ctx, { fetcher: f })).toBe(1);
    const [only] = await pendingPreferenceSuggestions(ctx);
    await declinePreferenceSuggestion(ctx, only!.id);

    // Más señales nuevas, pero la última propuesta tiene menos de 7 días.
    await withSignals(ctx, topic.id);
    const inThreeDays = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    expect(await maybeProposePreferences(ctx, { fetcher: f, now: inThreeDays })).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("CA-0021-03: aceptar con texto editado y solo este curso crea la preferencia que viaja al generar", async () => {
    const { ctx, course, topic } = await teacher();
    await withSignals(ctx, topic.id);
    const f = engine({
      "/v1/generation/preference-suggestions": ok(suggestionsBody()),
    }) as unknown as typeof fetch;
    await maybeProposePreferences(ctx, { fetcher: f });
    const [suggestion] = await pendingPreferenceSuggestions(ctx);
    const edited = "Escribe enunciados de una sola oración y sin relatos largos.";
    await acceptPreferenceSuggestion(ctx, {
      suggestionId: suggestion!.id,
      text: edited,
      scope: "COURSE",
      courseId: course.id,
      deactivateIds: [],
    });
    const preference = await db.teacherPreference.findFirstOrThrow({ where: { text: edited } });
    expect(preference).toMatchObject({ courseId: course.id, active: true });
    expect(await pendingPreferenceSuggestions(ctx)).toEqual([]);

    const fetcher = engine({ "/v1/generation/quiz": ok(quizBody(4)) });
    const run = deps(fetcher as unknown as typeof fetch);
    await createResource(ctx, quizBlueprint(topic.id), run);
    await run.done();
    expect(bodyOf(fetcher).preferences).toContain(edited);

    // Dos pestañas: la segunda decisión no duplica nada.
    await expect(declinePreferenceSuggestion(ctx, suggestion!.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      acceptPreferenceSuggestion(ctx, {
        suggestionId: suggestion!.id,
        text: edited,
        scope: "ALL",
        courseId: null,
        deactivateIds: [],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.teacherPreference.count({ where: { text: edited } })).toBe(1);
  });

  it("CA-0021-04: lo descartado no se vuelve a mostrar en 90 días", async () => {
    const { ctx, topic } = await teacher();
    await withSignals(ctx, topic.id);
    const fetcher = engine({ "/v1/generation/preference-suggestions": ok(suggestionsBody()) });
    const f = fetcher as unknown as typeof fetch;
    await maybeProposePreferences(ctx, { fetcher: f });
    const [first] = await pendingPreferenceSuggestions(ctx);
    await declinePreferenceSuggestion(ctx, first!.id);

    await withSignals(ctx, topic.id);
    const inTenDays = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    expect(await maybeProposePreferences(ctx, { fetcher: f, now: inTenDays })).toBe(0);
    // El AI Engine recibió lo descartado para no repetirlo, y la web lo filtra igual.
    expect(bodyOf(fetcher, 1).declined).toEqual([SUGGESTION.text]);
    expect(await pendingPreferenceSuggestions(ctx)).toEqual([]);
  });

  it("CA-0021-05: aceptar desactivando la preferencia que contradice", async () => {
    const { ctx, course, topic } = await teacher();
    const old = await addPreference(ctx, course.id, {
      text: "Usa enunciados con contexto largo y relatos.",
      scope: "ALL",
    });
    await withSignals(ctx, topic.id);
    const f = engine({
      "/v1/generation/preference-suggestions": ok(
        suggestionsBody([{ ...SUGGESTION, conflictsWith: 0 }]),
      ),
    }) as unknown as typeof fetch;
    await maybeProposePreferences(ctx, { fetcher: f });
    const [suggestion] = await pendingPreferenceSuggestions(ctx);
    expect(suggestion!.conflictsWith).toEqual({ id: old.id, text: expect.any(String) });
    await acceptPreferenceSuggestion(ctx, {
      suggestionId: suggestion!.id,
      text: SUGGESTION.text,
      scope: "ALL",
      courseId: null,
      deactivateIds: [old.id],
    });
    expect(await db.teacherPreference.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({
      active: false,
    });
  });

  it("CA-0021-06: al AI Engine van solo las claves del contrato, sin correos ni ids", async () => {
    const { ctx, topic } = await teacher();
    const ids = await withSignals(ctx, topic.id);
    const fetcher = engine({ "/v1/generation/preference-suggestions": ok(suggestionsBody()) });
    await maybeProposePreferences(ctx, { fetcher: fetcher as unknown as typeof fetch });
    const body = bodyOf(fetcher);
    expect(Object.keys(body).sort()).toEqual(["activePreferences", "declined", "signals"]);
    const allowed = ["kind", "resourceType", "subject", "grade", "before", "after", "comment"];
    for (const s of body.signals) {
      expect(Object.keys(s).every((k) => allowed.includes(k))).toBe(true);
    }
    const text = JSON.stringify(body);
    expect(text).not.toContain("profe@colegio.edu.co");
    for (const id of [...ids, ctx.membershipId, ctx.institutionId, ctx.userId]) {
      expect(text).not.toContain(id);
    }
    expect(body.signals.filter((s: { kind: string }) => s.kind === "EDIT")).toHaveLength(4);
    expect(body.signals[0]).toMatchObject({ kind: "ITEM_DOWN", subject: "Matemáticas" });
  });

  it("CA-0021-07: otro docente o el administrador del colegio no ven ni deciden la propuesta", async () => {
    const admin = await createUser("Rectora");
    const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
    const adminCtx = await ctxFor(admin, institutionId);
    const other = await createUser("Profe");
    const { token } = await createInvitation(adminCtx, { email: other.email, roles: ["TEACHER"] });
    await acceptInvitation(other, token);
    const ctx = await ctxFor(other, institutionId);
    const { topic } = await courseWithTopic(ctx);
    await withSignals(ctx, topic.id);
    const f = engine({
      "/v1/generation/preference-suggestions": ok(suggestionsBody()),
    }) as unknown as typeof fetch;
    await maybeProposePreferences(ctx, { fetcher: f });
    const [suggestion] = await pendingPreferenceSuggestions(ctx);

    expect(await pendingPreferenceSuggestions(adminCtx)).toEqual([]);
    await expect(declinePreferenceSuggestion(adminCtx, suggestion!.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      acceptPreferenceSuggestion(adminCtx, {
        suggestionId: suggestion!.id,
        text: SUGGESTION.text,
        scope: "ALL",
        courseId: null,
        deactivateIds: [],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await pendingPreferenceSuggestions(ctx)).toHaveLength(1);
  });

  it("CA-0021-08: con el AI Engine caído no se muestra nada ni se gasta el cupo", async () => {
    const { ctx, topic } = await teacher();
    await withSignals(ctx, topic.id);
    const before = await db.resource.count();
    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await maybeProposePreferences(ctx, { fetcher: down as unknown as typeof fetch })).toBe(
      0,
    );
    expect(await pendingPreferenceSuggestions(ctx)).toEqual([]);
    const log = await db.generationLog.findFirstOrThrow({ where: { task: "preferences" } });
    expect(log.status).toBe("UNAVAILABLE");
    // No es un recurso: no cuenta en el cupo diario de recursos.
    expect(await db.resource.count()).toBe(before);
  });
});

describe("Parte B y C: calidad, casos reales y métricas (SPEC-0021)", () => {
  it("CA-0021-15: los avisos de calidad quedan en generation_logs, solo el conteo", async () => {
    const { ctx, topic } = await teacher();
    const id = await quiz(ctx, topic.id, ["Pregunta 1: la pregunta tiene 70 palabras"]);
    const log = await db.generationLog.findFirstOrThrow({ where: { entityId: id } });
    expect(log).toMatchObject({ qualityWarnings: 1, qualityRulesVersion: "quality.v1" });
  });

  it("CA-0021-17: los casos reales salen anonimizados y sin datos de contacto", async () => {
    const { ctx, topic } = await teacher();
    const admin = await createUser("Rector");
    const school = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
    const schoolCtx = await ctxFor(admin, school.institutionId);
    const other = await courseWithTopic(schoolCtx);

    const a = await quiz(ctx, topic.id);
    const content = (await getResource(ctx, a)).data!.content as QuizContent;
    await rateItem(ctx, a, content.questions[1]!.id, "DOWN", "Confuso, llámame al 3001234567");
    const b = await quiz(schoolCtx, other.topic.id);
    await rateResource(schoolCtx, b, 1, "No sirve para mi grupo");
    await quiz(ctx, topic.id); // sin quejas: no sale

    const cases = await extractBenchmarkCases(SALT);
    expect(cases).toHaveLength(2);
    const text = JSON.stringify(cases);
    for (const id of [a, b, ctx.institutionId, school.institutionId, ctx.membershipId]) {
      expect(text).not.toContain(id);
    }
    expect(text).not.toContain("3001234567");
    const first = cases.find((c) => c.complaints[0]!.item)!;
    expect(first).toMatchObject({
      type: "QUIZ",
      subject: "Matemáticas",
      gradeLabel: "6°",
      topic: "La recta numérica",
      itemCount: 4,
    });
    expect(first.complaints[0]!.item).toContain("Pregunta 2");
    expect(first.id).toMatch(/^[0-9a-f]{16}$/);
    // Id estable con la misma sal; distinto con otra.
    expect((await extractBenchmarkCases(SALT)).map((c) => c.id)).toEqual(cases.map((c) => c.id));
    expect((await extractBenchmarkCases(`${SALT}-otra`))[0]!.id).not.toBe(cases[0]!.id);
    // El PIAR vive en otra tabla y nunca se consulta aquí.
    await expect(extractBenchmarkCases("corta")).rejects.toThrow();
  });

  it("CA-0021-19: métricas implícitas por versión de prompt y aceptación de propuestas", async () => {
    const { ctx, topic } = await teacher();
    const edited = await quiz(ctx, topic.id, ["Pregunta 1: aviso"]);
    const content = await shorten(ctx, edited);
    // Además borra una pregunta y agrega otra.
    const current = (await getResource(ctx, edited)).data!.content as QuizContent;
    await saveResourceContent(ctx, edited, 2, {
      ...current,
      questions: [
        ...current.questions.slice(0, 3),
        { ...content.questions[3]!, id: "q-nueva01", stem: "¿Cuál es mayor, −1 o −5?" },
      ],
    });
    const untouched = await quiz(ctx, topic.id);
    await setResourceStatus(ctx, untouched, "READY", { schedule: () => {} });
    const exported = await quiz(ctx, topic.id);
    await db.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        action: "resource.exported",
        entityType: "resource",
        entityId: exported,
      },
    });

    const [row] = (await promptQualityMetrics()).filter((r) => r.promptVersion === "quiz.v1");
    expect(row).toMatchObject({
      resources: 3,
      itemsDeleted: 1,
      itemsAdded: 1,
      readyUnedited: 1,
      exportedUnedited: 1,
      averageQualityWarnings: 0.33,
    });
    expect(row!.editedShare).toBeGreaterThan(0);
    expect(row!.editedShare).toBeLessThan(1);

    await withSignals(ctx, topic.id);
    const f = engine({
      "/v1/generation/preference-suggestions": ok(suggestionsBody()),
    }) as unknown as typeof fetch;
    await maybeProposePreferences(ctx, { fetcher: f });
    const [s] = await pendingPreferenceSuggestions(ctx);
    await acceptPreferenceSuggestion(ctx, {
      suggestionId: s!.id,
      text: SUGGESTION.text,
      scope: "ALL",
      courseId: null,
      deactivateIds: [],
    });
    expect(await preferenceSuggestionMetrics()).toEqual({
      proposed: 1,
      accepted: 1,
      declined: 0,
      pending: 0,
      acceptanceRate: 1,
    });
  });
});
