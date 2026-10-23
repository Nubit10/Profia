import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import {
  acceptSuggestion,
  discardSuggestion,
  rateSuggestion,
  suggestObjectives,
} from "@/modules/generation";
import { createIndependentSpace } from "@/modules/institutions";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const META = {
  provider: "groq",
  model: "qwen/qwen3.8-27b",
  promptVersion: "objective_suggestions.v1",
  attempts: 1,
  latencyMs: 900,
};

const engine = (suggestions: { statement: string; dbaCodes: string[] }[], status = 200) =>
  vi.fn(async () => Response.json({ suggestions, meta: META }, { status }));

async function teacherWithTopic() {
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

const SUGGESTIONS = [
  {
    statement: "Compara números enteros usando la recta numérica.",
    dbaCodes: ["MEN-DBA-MAT-V2-G6-01"],
  },
  {
    statement: "Resuelve problemas con cantidades positivas y negativas.",
    dbaCodes: ["MEN-DBA-MAT-V2-G6-02"],
  },
];

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("sugerir objetivos con IA (SPEC-0007)", () => {
  it("CA-0007-05: envía solo contexto pedagógico, sin datos personales", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const fetcher = engine(SUGGESTIONS);
    await suggestObjectives(ctx, topic.id, 2, fetcher);

    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://ai-engine.test:8100/v1/generation/objective-suggestions");
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual([
      "count",
      "dba",
      "existingObjectives",
      "grade",
      "subject",
      "topic",
    ]);
    expect(body).toMatchObject({
      subject: "Matemáticas",
      grade: "6°",
      topic: { title: "La recta numérica" },
      count: 2,
    });
    expect(body.dba.length).toBeGreaterThan(5);
    const raw = String(init.body);
    for (const personal of [ctx.userName, ctx.userEmail, ctx.institutionName, ctx.institutionId]) {
      expect(raw).not.toContain(personal);
    }
  });

  it("guarda la generación con modelo y prompt, y devuelve sugerencias pendientes", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const result = await suggestObjectives(ctx, topic.id, 2, engine(SUGGESTIONS));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.suggestions.map((s) => s.dba[0]!.number)).toEqual([1, 2]);

    const log = await db.generationLog.findUniqueOrThrow({
      where: { id: result.generationId },
      include: { suggestions: true },
    });
    expect(log).toMatchObject({
      status: "OK",
      model: "qwen/qwen3.8-27b",
      promptVersion: "objective_suggestions.v1",
    });
    expect(log.suggestions.every((s) => s.decision === "PENDING")).toBe(true);
    // RN-01: ninguna sugerencia se vuelve objetivo sin acción del docente.
    expect(await db.objective.count()).toBe(0);
  });

  it("CA-0007-04: descarta códigos de DBA que no estaban en el contexto (defensa en profundidad)", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const result = await suggestObjectives(
      ctx,
      topic.id,
      1,
      engine([
        {
          statement: "Compara números enteros en contexto.",
          dbaCodes: ["MEN-DBA-MAT-V2-G6-01", "INVENTADO"],
        },
      ]),
    );
    expect(result.status === "ok" && result.suggestions[0]!.dba.map((d) => d.code)).toEqual([
      "MEN-DBA-MAT-V2-G6-01",
    ]);
  });

  it("CA-0007-06: aceptar crea el objetivo vinculado; editar guarda el texto final; descartar no crea nada", async () => {
    const { ctx, topic, course } = await teacherWithTopic();
    const result = await suggestObjectives(ctx, topic.id, 2, engine(SUGGESTIONS));
    if (result.status !== "ok") throw new Error("esperaba ok");
    const [first, second] = result.suggestions;

    await acceptSuggestion(
      ctx,
      first!.id,
      "Compara y ordena números enteros en la recta numérica.",
    );
    await discardSuggestion(ctx, second!.id);

    const objectives = (await getCoursePlanning(ctx, course.id)).units[0]!.topics[0]!.objectives;
    expect(objectives).toHaveLength(1);
    expect(objectives[0]).toMatchObject({
      statement: "Compara y ordena números enteros en la recta numérica.",
    });
    expect(objectives[0]!.links.map((l) => l.code)).toEqual(["MEN-DBA-MAT-V2-G6-01"]);

    const stored = await db.generationSuggestion.findMany({ orderBy: { position: "asc" } });
    expect(stored.map((s) => s.decision)).toEqual(["EDITED", "DISCARDED"]);
    expect(stored[0]!.objectiveId).toBe(objectives[0]!.id);

    // Una sugerencia decidida no se puede aceptar de nuevo (doble clic).
    await expect(acceptSuggestion(ctx, first!.id)).rejects.toMatchObject({ code: "INVALID" });
    expect(await db.objective.count()).toBe(1);
  });

  it("CA-0007-07: la calificación queda ligada al modelo y la versión del prompt", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const result = await suggestObjectives(ctx, topic.id, 2, engine(SUGGESTIONS));
    if (result.status !== "ok") throw new Error("esperaba ok");
    await rateSuggestion(ctx, result.suggestions[0]!.id, "DOWN", "Muy general para 6°");

    const rated = await db.generationSuggestion.findUniqueOrThrow({
      where: { id: result.suggestions[0]!.id },
      include: { generation: true },
    });
    expect(rated).toMatchObject({ rating: "DOWN", comment: "Muy general para 6°" });
    expect(rated.generation).toMatchObject({
      model: "qwen/qwen3.8-27b",
      promptVersion: "objective_suggestions.v1",
    });
  });

  it.each([
    [
      "AI Engine caído",
      vi.fn(async () => Promise.reject(new TypeError("fetch failed"))),
      "unavailable",
    ],
    ["LLM no disponible (503)", engine([], 503), "unavailable"],
    ["salida inválida (502)", engine([], 502), "invalid"],
  ])("CA-0007-08: %s → respuesta controlada y registro", async (_, fetcher, status) => {
    const { ctx, topic } = await teacherWithTopic();
    const result = await suggestObjectives(ctx, topic.id, 3, fetcher as unknown as typeof fetch);
    expect(result).toEqual({ status });
    expect(await db.generationLog.findFirstOrThrow()).toMatchObject({
      status: status === "invalid" ? "INVALID" : "UNAVAILABLE",
    });
  });

  it("CA-0007-10: un tema o una sugerencia ajenos responden NOT_FOUND sin llamar a la IA", async () => {
    const a = await teacherWithTopic();
    const b = await teacherWithTopic();
    const fetcher = engine(SUGGESTIONS);
    await expect(suggestObjectives(b.ctx, a.topic.id, 2, fetcher)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(fetcher).not.toHaveBeenCalled();

    const result = await suggestObjectives(a.ctx, a.topic.id, 2, engine(SUGGESTIONS));
    if (result.status !== "ok") throw new Error("esperaba ok");
    await expect(acceptSuggestion(b.ctx, result.suggestions[0]!.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(rateSuggestion(b.ctx, result.suggestions[0]!.id, "UP")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
