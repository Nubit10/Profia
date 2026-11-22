import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import {
  proposeObjectivesBatch,
  proposePlanning,
  type EnginePlanningRequest,
} from "@/modules/generation";
import { createIndependentSpace } from "@/modules/institutions";
import {
  acceptObjectivesBatch,
  acceptPlanningProposal,
  canProposeTopics,
  createObjective,
  createTopic,
  createUnit,
  getCoursePlanning,
} from "@/modules/planning";
import { createResource, type GenerationDeps } from "@/modules/resources";
import type { Blueprint } from "@/modules/resources/client";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0039: Lucía planea y genera con Estándares y Orientaciones del MEN cuando el área no tiene
// DBA, y el docente puede vincular Estándares a un objetivo (también en áreas con DBA).

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const META = { provider: "groq", model: "qwen/qwen3.8-27b", attempts: 1, latencyMs: 900 };
type SentRef = { code: string; kind?: string };

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

async function teacher() {
  const user = await createUser("Docente");
  const { institutionId } = await createIndependentSpace(user);
  return ctxFor(user, institutionId);
}

async function courseOf(ctx: TenantContext, subjectName: string, grade: string) {
  const subject = (await listSubjects(ctx)).find((s) => s.name === subjectName)!;
  const course = await createCourse(ctx, {
    subjectId: subject.id,
    grade: grade as "G6",
    groupName: "A",
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, course.id); // crea los periodos
  return course;
}

/** Motor de planeación de prueba: un tema por código que debe cubrir. */
function planningEngine() {
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as EnginePlanningRequest;
    const periods = body.periods.map((p) => ({
      number: p.number,
      units: [
        {
          title: `Unidad del periodo ${p.number}`,
          topics: (p.mustCover.length ? p.mustCover : p.dbaCodes).slice(0, 4).map((code, i) => ({
            title: `Tema ${i + 1} del periodo ${p.number}`,
            description: "Se trabaja en clase.",
            dbaCodes: [code],
          })),
        },
      ],
    }));
    return Response.json({
      periods,
      meta: { ...META, promptVersion: "planning.v1+referentes.v1", tokens: 900, droppedCodes: 0 },
    });
  });
}

const sentRefs = (fetcher: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse(String((fetcher.mock.calls[call] as unknown as [URL, RequestInit])[1].body))
    .dba as SentRef[];

describe("SPEC-0039 — Estándares y Orientaciones al planear y generar", () => {
  it("CA-0039-01: en Ética de 6°, Lucía propone el periodo con los Estándares Ciudadanos y se agregan", async () => {
    const ctx = await teacher();
    const course = await courseOf(ctx, "Ética y Valores Humanos", "G6");
    expect(await canProposeTopics(ctx, course.id)).toBe(true);
    const fetcher = planningEngine();
    const proposal = await proposePlanning(
      ctx,
      { scope: "PERIOD", courseId: course.id, periodNumber: 1, size: "DEFAULT" },
      fetcher,
    );
    const sent = sentRefs(fetcher);
    expect(sent.length).toBe(36);
    expect(sent.every((r) => r.code.startsWith("MEN-EBC-CIU-V1-G6A7-"))).toBe(true);
    expect(sent.every((r) => r.kind === "STANDARD")).toBe(true);
    if (proposal.status !== "ok") throw new Error(proposal.status);

    await acceptPlanningProposal(ctx, {
      courseId: course.id,
      units: proposal.periods.flatMap((p) =>
        p.units.map((u) => ({
          kind: "NEW" as const,
          periodNumber: p.number,
          title: u.title,
          topics: u.topics.map((t) => ({
            title: t.title,
            description: t.description,
            dbaCodes: t.dba.map((d) => d.code),
          })),
        })),
      ),
    });
    const planning = await getCoursePlanning(ctx, course.id);
    // Los Estándares cuentan en la cobertura como los DBA en otras áreas.
    expect(planning.coverage.total).toBe(36);
    expect(planning.coverage.covered.length).toBeGreaterThan(0);
    expect(planning.units[0]!.topics[0]!.dbaCodes[0]).toMatch(/^MEN-EBC-CIU-V1-G6A7-/);
  });

  it("CA-0039-02: en Tecnología de 8°, Lucía usa las Orientaciones del MEN", async () => {
    const ctx = await teacher();
    const course = await courseOf(ctx, "Tecnología e Informática", "G8");
    const fetcher = planningEngine();
    await proposePlanning(
      ctx,
      { scope: "PERIOD", courseId: course.id, periodNumber: 1, size: "DEFAULT" },
      fetcher,
    );
    const sent = sentRefs(fetcher);
    expect(sent.length).toBe(40);
    expect(sent.every((r) => r.code.startsWith("MEN-ORI-TEC-V1-G8A9-"))).toBe(true);
    expect(sent.every((r) => r.kind === "ORIENTATION")).toBe(true);
  });

  it("CA-0039-03: en un área con DBA siguen yendo solo los DBA, sin `kind`", async () => {
    const ctx = await teacher();
    const course = await courseOf(ctx, "Matemáticas", "G6");
    const fetcher = planningEngine();
    await proposePlanning(
      ctx,
      { scope: "PERIOD", courseId: course.id, periodNumber: 1, size: "DEFAULT" },
      fetcher,
    );
    const sent = sentRefs(fetcher);
    expect(sent.every((r) => r.code.startsWith("MEN-DBA-MAT-V2-G6-") && !("kind" in r))).toBe(true);
    // Una asignatura sin área ni referentes sigue sin propuesta.
    const religion = await courseOf(ctx, "Educación Religiosa", "G6");
    expect(await canProposeTopics(ctx, religion.id)).toBe(false);
  });

  it("CA-0039-04: un Estándar vinculado a un objetivo de Matemáticas viaja a Lucía con su tipo", async () => {
    const ctx = await teacher();
    const course = await courseOf(ctx, "Matemáticas", "G6");
    const unit = await createUnit(ctx, {
      courseId: course.id,
      periodNumber: 1,
      title: "Números",
      description: null,
    });
    const topic = await createTopic(ctx, {
      unitId: unit.id,
      title: "Fracciones",
      description: null,
      plannedSessions: 2,
    });
    const STD = "MEN-EBC-MAT-V1-G6A7-01";
    const objective = await createObjective(ctx, {
      topicId: topic.id,
      statement: "Resuelve problemas con fracciones en contextos cotidianos.",
      links: [
        { code: "MEN-DBA-MAT-V2-G6-01", evidenceIndexes: [] },
        { code: STD, evidenceIndexes: [] },
      ],
    });
    const planning = await getCoursePlanning(ctx, course.id);
    expect(planning.units[0]!.topics[0]!.objectives[0]!.links.map((l) => l.code)).toEqual([
      "MEN-DBA-MAT-V2-G6-01",
      STD,
    ]);

    const fetcher = vi.fn(async () =>
      Response.json({
        quiz: {
          title: "Quiz de fracciones",
          instructions: "Responde.",
          questions: Array.from({ length: 4 }, (_, i) => ({
            type: "MULTIPLE_CHOICE",
            stem: `Pregunta ${i + 1}: ¿cuál fracción es mayor?`,
            options: ["1/2", "1/3", "1/4", "1/5"],
            answer: "1/2",
            explanation: "Tiene el denominador menor.",
            cognitiveLevel: "REMEMBER",
            dbaCodes: [STD],
          })),
        },
        meta: { ...META, promptVersion: "quiz.v1+referentes.v1", tokens: 1000 },
      }),
    );
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
      objectiveIds: [objective.id],
      durationMinutes: 30,
      difficulty: "BASIC",
      itemCount: 4,
      questionTypes: ["MULTIPLE_CHOICE"],
      cognitiveDistribution: { REMEMBER: 100 },
      notes: null,
      excludedPreferenceIds: [],
    };
    await createResource(ctx, blueprint, deps);
    await Promise.all(tasks);
    expect(sentRefs(fetcher)).toEqual([
      expect.objectContaining({ code: "MEN-DBA-MAT-V2-G6-01" }),
      expect.objectContaining({ code: STD, kind: "STANDARD" }),
    ]);
    expect(sentRefs(fetcher)[0]).not.toHaveProperty("kind");
  });

  it("CA-0039-05: en Educación Física, los objetivos en bloque se proponen con las Orientaciones", async () => {
    const ctx = await teacher();
    const course = await courseOf(ctx, "Educación Física, Recreación y Deportes", "G10");
    const unit = await createUnit(ctx, {
      courseId: course.id,
      periodNumber: 1,
      title: "Condición física",
      description: null,
    });
    await createTopic(ctx, {
      unitId: unit.id,
      title: "Resistencia",
      description: null,
      plannedSessions: 2,
    });
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { count: number; dba: SentRef[] };
      return Response.json({
        suggestions: Array.from({ length: body.count }, (_, i) => ({
          statement: `Mejora su resistencia con ejercicios por intervalos (${i + 1}).`,
          dbaCodes: [body.dba[0]!.code],
        })),
        meta: { ...META, promptVersion: "objective_suggestions.v1+referentes.v1" },
      });
    });
    const proposal = await proposeObjectivesBatch(
      ctx,
      { scope: "UNIT", unitId: unit.id },
      fetcher as unknown as typeof fetch,
    );
    const sent = sentRefs(fetcher);
    expect(sent).toHaveLength(30);
    expect(sent.every((r) => r.kind === "ORIENTATION")).toBe(true);
    if (proposal.status !== "ok") throw new Error(proposal.status);
    await acceptObjectivesBatch(ctx, {
      courseId: course.id,
      objectives: proposal.topics.flatMap((t) =>
        t.suggestions.map((s) => ({
          topicId: t.topicId,
          statement: s.statement,
          dbaCodes: s.dba.map((d) => d.code),
        })),
      ),
    });
    const planning = await getCoursePlanning(ctx, course.id);
    const links = planning.units[0]!.topics[0]!.objectives.flatMap((o) => o.links);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.code.startsWith("MEN-ORI-EFI-V1-G10A11-"))).toBe(true);
  });
});
