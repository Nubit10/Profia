import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import { createIndependentSpace } from "@/modules/institutions";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import {
  createResource,
  createResourceQuick,
  decideRegeneration,
  getResource,
  getResourceFormContext,
  regenerateItem,
  saveResourceContent,
  type GenerationDeps,
} from "@/modules/resources";
import type { Blueprint, WorkshopContent } from "@/modules/resources/client";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0016: talleres con enfoque DUA a elección del docente (ADR-0014).

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const DBA1 = "MEN-DBA-MAT-V2-G6-01";
const META = {
  provider: "groq",
  model: "qwen/qwen3.8-27b",
  attempts: 1,
  latencyMs: 900,
  tokens: 2000,
};
const UDL = {
  representation: ["Lectura corta con imágenes", "Explicación en voz alta"],
  expression: ["Escribir en el cuaderno", "Explicarlo en voz alta"],
  engagement: "Busca temperaturas bajo cero en las noticias y elige una.",
  supports: ["Ejemplo resuelto paso a paso"],
  challenge: "Inventa un problema para tu grupo.",
};
const activity = (i: number, udl = true) => ({
  title: `Actividad ${i}`,
  instructions: "Dibuja una recta numérica y ubica los números dados.",
  durationMinutes: 15,
  expectedOutcome: "Recta con los números ubicados.",
  cognitiveLevel: "APPLY" as const,
  dbaCodes: [DBA1],
  ...(udl && { udl: UDL }),
});
const workshopBody = (udl: boolean) => ({
  workshop: {
    title: "Taller de la recta",
    purpose: "Comparar números enteros.",
    studentInstructions: "Trabaja en parejas.",
    materials: ["Cuaderno"],
    moments: [
      { name: "Inicio", activities: [activity(1, udl)] },
      { name: "Desarrollo", activities: [activity(2, udl), activity(3, udl)] },
      { name: "Cierre", activities: [activity(4, udl)] },
    ],
    teacherGuidance: ["Revisa que ubiquen el cero."],
    udlGuide: udl
      ? {
          barriers: [
            { barrier: "Textos largos", support: "Leer en voz alta por partes" },
            { barrier: "Vocabulario nuevo", support: "Banco de palabras" },
          ],
          selfAssessment: ["Puedo ubicar enteros", "Puedo explicar un opuesto"],
        }
      : null,
  },
  meta: { ...META, promptVersion: udl ? "workshop.v1+udl.v1" : "workshop.v1" },
});

function engine(responses: Record<string, () => Response>) {
  return vi.fn(async (url: URL | string) => {
    const respond = responses[new URL(String(url)).pathname];
    if (!respond) throw new Error(`ruta inesperada ${String(url)}`);
    return respond();
  });
}
const ok = (body: unknown) => () => Response.json(body);
const bodyOf = (fetcher: ReturnType<typeof engine>, i = 0) =>
  JSON.parse(String((fetcher.mock.calls[i] as unknown as [URL, RequestInit])[1].body));

function deps(fetcher: typeof fetch): GenerationDeps & { done: () => Promise<unknown> } {
  const tasks: Promise<void>[] = [];
  return { fetcher, schedule: (task) => void tasks.push(task()), done: () => Promise.all(tasks) };
}

async function teacherWithTopic() {
  const user = await createUser("Profe");
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
    plannedSessions: null,
  });
  return { ctx, topic };
}

const blueprint = (topicId: string, udl?: boolean): Blueprint => ({
  type: "WORKSHOP",
  topicId,
  objectiveIds: [],
  durationMinutes: 60,
  difficulty: "INTERMEDIATE",
  itemCount: 4,
  structure: "START_DEVELOPMENT_CLOSE",
  cognitiveDistribution: { APPLY: 100 },
  notes: null,
  excludedPreferenceIds: [],
  ...(udl !== undefined && { udl }),
});

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("talleres con DUA (SPEC-0016)", () => {
  it("CA-0016-01/07: con DUA se pide al motor, se guarda con sus campos y queda la versión del prompt", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const fetcher = engine({ "/v1/generation/workshop": ok(workshopBody(true)) });
    const run = deps(fetcher as unknown as typeof fetch);
    const { id } = await createResource(ctx, blueprint(topic.id, true), run);
    await run.done();

    expect(bodyOf(fetcher)).toMatchObject({ udl: true });
    const resource = await getResource(ctx, id);
    const content = resource.data!.content as WorkshopContent;
    const activities = content.moments.flatMap((m) => m.activities);
    expect(activities.every((a) => a.udl?.expression.length === 2)).toBe(true);
    expect(content.udlGuide?.barriers).toHaveLength(2);
    expect(resource.promptVersion).toBe("workshop.v1+udl.v1");
  });

  it("CA-0016-02: sin DUA no se pide ni se guarda (y un blueprint viejo sin el campo sigue igual)", async () => {
    const { ctx, topic } = await teacherWithTopic();
    for (const udl of [false, undefined]) {
      const fetcher = engine({ "/v1/generation/workshop": ok(workshopBody(false)) });
      const run = deps(fetcher as unknown as typeof fetch);
      const { id } = await createResource(ctx, blueprint(topic.id, udl), run);
      await run.done();
      expect(bodyOf(fetcher)).not.toHaveProperty("udl");
      const content = (await getResource(ctx, id)).data!.content as WorkshopContent;
      expect(content.udlGuide).toBeUndefined();
      expect(content.moments[0]!.activities[0]!.udl).toBeUndefined();
    }
  });

  it("CA-0016-04: editar los campos DUA crea una versión; regenerar una actividad conserva el DUA", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const run = deps(
      engine({ "/v1/generation/workshop": ok(workshopBody(true)) }) as unknown as typeof fetch,
    );
    const { id } = await createResource(ctx, blueprint(topic.id, true), run);
    await run.done();
    const content = (await getResource(ctx, id)).data!.content as WorkshopContent;
    const first = content.moments[0]!.activities[0]!;
    const edited: WorkshopContent = {
      ...content,
      moments: content.moments.map((m, i) =>
        i === 0
          ? {
              ...m,
              activities: [
                { ...first, udl: { ...first.udl!, expression: ["Hacer una maqueta", "Cantarlo"] } },
              ],
            }
          : m,
      ),
      udlGuide: { ...content.udlGuide!, selfAssessment: ["Puedo explicar la recta"] },
    };
    expect(await saveResourceContent(ctx, id, 1, edited)).toEqual({ version: 2 });
    const saved = (await getResource(ctx, id)).data!.content as WorkshopContent;
    expect(saved.moments[0]!.activities[0]!.udl!.expression).toEqual([
      "Hacer una maqueta",
      "Cantarlo",
    ]);
    expect(saved.udlGuide!.selfAssessment).toEqual(["Puedo explicar la recta"]);

    const fetcher = engine({
      "/v1/generation/item": ok({
        item: { ...activity(9), title: "Actividad nueva" },
        meta: { ...META, promptVersion: "item_regenerate.v1+udl.v1" },
      }),
    });
    const result = await regenerateItem(
      ctx,
      id,
      first.id,
      "Más corta",
      fetcher as unknown as typeof fetch,
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // El motor recibe la actividad con su DUA: así sabe que debe conservarlo (RN-07).
    expect(bodyOf(fetcher).current.udl.expression).toEqual(["Hacer una maqueta", "Cantarlo"]);
    await decideRegeneration(ctx, result.proposal.regenerationId, true);
    const after = (await getResource(ctx, id)).data!.content as WorkshopContent;
    expect(after.moments[0]!.activities[0]).toMatchObject({ title: "Actividad nueva" });
    expect(after.moments[0]!.activities[0]!.udl).toBeDefined();
  });

  it("CA-0016-04: el guardado rechaza opciones DUA vacías", async () => {
    const { ctx, topic } = await teacherWithTopic();
    const run = deps(
      engine({ "/v1/generation/workshop": ok(workshopBody(true)) }) as unknown as typeof fetch,
    );
    const { id } = await createResource(ctx, blueprint(topic.id, true), run);
    await run.done();
    const content = (await getResource(ctx, id)).data!.content as WorkshopContent;
    const bad = structuredClone(content);
    bad.moments[0]!.activities[0]!.udl!.expression = ["  "];
    await expect(saveResourceContent(ctx, id, 1, bad)).rejects.toMatchObject({ code: "INVALID" });
  });

  it("CA-0016-06: el toque rápido y el asistente repiten la última elección del docente", async () => {
    const { ctx, topic } = await teacherWithTopic();
    expect((await getResourceFormContext(ctx, topic.id)).lastUdl).toBe(false);
    const noRun = { schedule: () => undefined };
    const plain = await createResourceQuick(ctx, { type: "WORKSHOP", topicId: topic.id }, noRun);
    expect(
      (await db.resource.findUniqueOrThrow({ where: { id: plain.id } })).blueprint as Blueprint,
    ).toMatchObject({ udl: false });

    await createResource(ctx, blueprint(topic.id, true), noRun);
    expect((await getResourceFormContext(ctx, topic.id)).lastUdl).toBe(true);
    const quick = await createResourceQuick(ctx, { type: "WORKSHOP", topicId: topic.id }, noRun);
    expect(
      (await db.resource.findUniqueOrThrow({ where: { id: quick.id } })).blueprint,
    ).toMatchObject({ udl: true });
  });
});
