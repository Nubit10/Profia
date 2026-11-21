import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import { exportResource } from "@/modules/documents";
import {
  DEFAULT_GRADING_BANDS,
  acceptInvitation,
  createIndependentSpace,
  createInvitation,
  getGradingBands,
  registerSchool,
  updateGradingBands,
  type GradingBands,
} from "@/modules/institutions";
import { gradingBandsSchema } from "@/modules/institutions/client";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import {
  createResource,
  getQuotaStatus,
  getResource,
  saveResourceContent,
  setResourceStatus,
  type GenerationDeps,
} from "@/modules/resources";
import type { Blueprint, LessonPlanContent } from "@/modules/resources/client";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase, validSchool } from "../support/factories";

// SPEC-0024: plan de aula (recurso LESSON_PLAN) y escala de valoración del espacio.

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const DBA1 = "MEN-DBA-MAT-V2-G6-01";

const moment = (what: string, n: number) =>
  `${what} de la sesión ${n}: los estudiantes trabajan con fracciones en situaciones del barrio.`;

const session = (n: number) => ({
  number: n,
  title: `Fracciones en la tienda ${n}`,
  start: moment("Inicio", n),
  startMinutes: 10,
  development: moment("Desarrollo", n),
  developmentMinutes: 35,
  closure: moment("Cierre", n),
  closureMinutes: 10,
  resources: ["Tablero", "Fichas de fracciones"],
  // Un código que no estaba en el contexto se descarta (defensa en profundidad).
  dbaCodes: [DBA1, "MEN-DBA-INVENTADO"],
});

const rubricRow = (i: number) => ({
  criterion: `Criterio ${i}: representa fracciones`,
  superior: `Representa y compara fracciones con varias estrategias (${i}).`,
  high: `Representa y compara fracciones con una estrategia (${i}).`,
  basic: `Representa fracciones con ayuda del material concreto (${i}).`,
  low: `Aún no representa fracciones aunque cuente con apoyo (${i}).`,
});

const body = {
  plan: {
    title: "Plan de aula: fracciones",
    purpose: "Que el grupo comprenda las fracciones como parte de un todo.",
    sessions: [1, 2, 3].map(session),
    evaluation: {
      evidence: "Resuelve problemas de reparto con fracciones y explica su proceso.",
      instruments: ["Lista de chequeo", "Taller escrito"],
    },
    rubric: [1, 2, 3].map(rubricRow),
    diversity: "Material concreto y trabajo en parejas para quien lo necesite.",
  },
  meta: {
    provider: "groq",
    model: "qwen/qwen3.8-27b",
    promptVersion: "lesson_plan.v1",
    attempts: 1,
    latencyMs: 2100,
    tokens: 3100,
    qualityWarnings: [],
  },
};

const blueprint = (topicId: string): Blueprint => ({
  type: "LESSON_PLAN",
  topicId,
  objectiveIds: [],
  sessions: 3,
  minutesPerSession: 55,
  difficulty: "INTERMEDIATE",
  notes: null,
  excludedPreferenceIds: [],
});

function engine(response: unknown = body) {
  const fetcher = vi.fn(async () => Response.json(response));
  const tasks: Promise<void>[] = [];
  const deps: GenerationDeps = {
    fetcher: fetcher as unknown as typeof fetch,
    schedule: (task) => {
      tasks.push(task());
    },
  };
  return { fetcher, deps, done: () => Promise.all(tasks) };
}

async function topicFor(ctx: TenantContext) {
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
    title: "Números racionales",
    description: null,
  });
  return createTopic(ctx, {
    unitId: unit.id,
    title: "Fracciones",
    description: null,
    plannedSessions: 3,
  });
}

async function independentTeacher() {
  const user = await createUser("ProfIA");
  const { institutionId } = await createIndependentSpace(user);
  return ctxFor(user, institutionId);
}

/** Colegio con su administrador y un docente invitado. */
async function school() {
  const admin = await createUser("Rectora");
  const { institutionId } = await registerSchool(admin, validSchool);
  const adminCtx = await ctxFor(admin, institutionId);
  const teacher = await createUser("Docente");
  const { token } = await createInvitation(adminCtx, { email: teacher.email, roles: ["TEACHER"] });
  await acceptInvitation(teacher, token);
  return { adminCtx, teacherCtx: await ctxFor(teacher, institutionId) };
}

const tenScale: GradingBands = {
  min: 1,
  max: 10,
  bands: {
    LOW: { from: 1, to: 5 },
    BASIC: { from: 6, to: 7 },
    HIGH: { from: 8, to: 9 },
    SUPERIOR: { from: 10, to: 10 },
  },
};

async function docxText(file: { body: Buffer }) {
  const zip = await JSZip.loadAsync(file.body);
  return zip.file("word/document.xml")!.async("string");
}

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("plan de aula (SPEC-0024)", () => {
  it("CA-0024-01: genera en segundo plano un borrador de 3 sesiones con rúbrica y gasta 1 del cupo", async () => {
    const ctx = await independentTeacher();
    const topic = await topicFor(ctx);
    const run = engine();
    const before = (await getQuotaStatus(ctx)).used;
    const { id } = await createResource(ctx, blueprint(topic.id), run.deps);
    expect((await getResource(ctx, id)).status).toBe("GENERATING");
    await run.done();

    const [url, init] = run.fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain("/v1/generation/lesson-plan");
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ sessions: 3, minutesPerSession: 55 });
    // RN-06: solo datos del tema; nada de estudiantes ni de la escala.
    expect(Object.keys(sent).sort()).toEqual(
      [
        "dba",
        "difficulty",
        "grade",
        "minutesPerSession",
        "notes",
        "objectives",
        "preferences",
        "sessions",
        "subject",
        "topic",
      ].sort(),
    );

    const resource = await getResource(ctx, id);
    expect(resource.status).toBe("DRAFT");
    expect(resource.type).toBe("LESSON_PLAN");
    const content = resource.data!.content as LessonPlanContent;
    expect(content.sessions.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(content.sessions[0]!.dbaCodes).toEqual([DBA1]);
    expect(content.rubric).toHaveLength(3);
    expect(content.evaluation.instruments).toEqual(["Lista de chequeo", "Taller escrito"]);
    expect(resource.gradingBands).toEqual(DEFAULT_GRADING_BANDS);
    expect((await getQuotaStatus(ctx)).used).toBe(before + 1);
    const log = await db.generationLog.findFirst({ where: { entityId: id } });
    expect(log).toMatchObject({
      task: "lesson_plan",
      status: "OK",
      promptVersion: "lesson_plan.v1",
    });
  });

  it("CA-0024-02: si el AI Engine responde 502 el plan queda fallido y no gasta cupo", async () => {
    const ctx = await independentTeacher();
    const topic = await topicFor(ctx);
    const fetcher = vi.fn(async () => new Response("{}", { status: 502 }));
    const tasks: Promise<void>[] = [];
    const { id } = await createResource(ctx, blueprint(topic.id), {
      fetcher: fetcher as unknown as typeof fetch,
      schedule: (task) => {
        tasks.push(task());
      },
    });
    await Promise.all(tasks);
    const resource = await getResource(ctx, id);
    expect(resource).toMatchObject({ status: "FAILED", failureReason: "invalid" });
    expect((await getQuotaStatus(ctx)).used).toBe(0);
  });

  it("CA-0024-03: la escala predeterminada es la nacional; la de 1 a 10 del colegio llega al plan del docente", async () => {
    const { adminCtx, teacherCtx } = await school();
    expect(await getGradingBands(teacherCtx)).toEqual(DEFAULT_GRADING_BANDS);
    expect(DEFAULT_GRADING_BANDS.bands).toEqual({
      LOW: { from: 1, to: 2.9 },
      BASIC: { from: 3, to: 3.9 },
      HIGH: { from: 4, to: 4.5 },
      SUPERIOR: { from: 4.6, to: 5 },
    });

    const topic = await topicFor(teacherCtx);
    const run = engine();
    const { id } = await createResource(teacherCtx, blueprint(topic.id), run.deps);
    await run.done();

    await updateGradingBands(adminCtx, tenScale);
    expect((await getResource(teacherCtx, id)).gradingBands).toEqual(tenScale);
  });

  it("CA-0024-04: rangos con hueco, cruzados o fuera se rechazan; el docente de un colegio no puede; otro colegio no la cambia", () => {
    const withBand = (band: keyof GradingBands["bands"], from: number, to: number) => ({
      ...DEFAULT_GRADING_BANDS,
      bands: { ...DEFAULT_GRADING_BANDS.bands, [band]: { from, to } },
    });
    const message = "Los rangos deben ir seguidos, de Bajo a Superior, sin huecos";
    // Hueco: Básico empieza en 3,2.
    expect(
      gradingBandsSchema.safeParse(withBand("BASIC", 3.2, 3.9)).error?.issues[0]?.message,
    ).toBe(message);
    // Cruce: Alto empieza antes de que termine Básico.
    expect(gradingBandsSchema.safeParse(withBand("HIGH", 3.5, 4.5)).success).toBe(false);
    // Fuera: Superior pasa de la nota máxima.
    expect(gradingBandsSchema.safeParse(withBand("SUPERIOR", 4.6, 5.5)).success).toBe(false);
    // Decimales en la escala de 10.
    expect(
      gradingBandsSchema.safeParse({
        ...tenScale,
        bands: { ...tenScale.bands, LOW: { from: 1, to: 5.5 } },
      }).success,
    ).toBe(false);
    expect(gradingBandsSchema.safeParse({ ...DEFAULT_GRADING_BANDS, max: 7 }).success).toBe(false);
    expect(gradingBandsSchema.safeParse(tenScale).success).toBe(true);
  });

  it("CA-0024-04: permisos y acceso cruzado de la escala", async () => {
    const { adminCtx, teacherCtx } = await school();
    await expect(updateGradingBands(teacherCtx, tenScale)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await getGradingBands(adminCtx)).toEqual(DEFAULT_GRADING_BANDS);

    // El docente independiente es el dueño de su espacio: sí la cambia.
    const independent = await independentTeacher();
    await updateGradingBands(independent, tenScale);
    expect(await getGradingBands(independent)).toEqual(tenScale);

    // El administrador de otro colegio solo cambia la de su espacio.
    const other = await school();
    await updateGradingBands(other.adminCtx, tenScale);
    expect(await getGradingBands(adminCtx)).toEqual(DEFAULT_GRADING_BANDS);
    expect(await getGradingBands(other.teacherCtx)).toEqual(tenScale);
    const audit = await db.auditLog.findFirst({
      where: {
        action: "institution.grading_bands_updated",
        institutionId: other.adminCtx.institutionId,
      },
    });
    expect(audit).not.toBeNull();
  });

  it("CA-0024-05: editar la sesión 2 y un descriptor crea versión nueva; la de la IA queda intacta", async () => {
    const ctx = await independentTeacher();
    const topic = await topicFor(ctx);
    const run = engine();
    const { id } = await createResource(ctx, blueprint(topic.id), run.deps);
    await run.done();
    const content = (await getResource(ctx, id)).data!.content as LessonPlanContent;
    const development = "Desarrollo editado por la docente: juego de la tienda con monedas.";
    const edited: LessonPlanContent = {
      ...content,
      sessions: content.sessions.map((s) => (s.number === 2 ? { ...s, development } : s)),
      rubric: content.rubric.map((r, i) =>
        i === 0 ? { ...r, low: "Todavía no reconoce la unidad que se reparte." } : r,
      ),
    };
    expect(await saveResourceContent(ctx, id, 1, edited)).toEqual({ version: 2 });

    const latest = (await getResource(ctx, id)).data!.content as LessonPlanContent;
    expect(latest.sessions[1]!.development).toBe(development);
    expect(latest.rubric[0]!.low).toBe("Todavía no reconoce la unidad que se reparte.");
    const versions = await db.resourceVersion.findMany({
      where: { resourceId: id },
      orderBy: { number: "asc" },
    });
    expect(versions.map((v) => v.source)).toEqual(["AI", "TEACHER"]);
    const ai = versions[0]!.content as LessonPlanContent;
    expect(ai.sessions[1]!.development).toBe(moment("Desarrollo", 2));

    // RN-03: dos desempeños iguales no se guardan.
    const repeated = {
      ...latest,
      rubric: latest.rubric.map((r, i) => (i === 0 ? { ...r, high: r.superior } : r)),
    };
    await expect(saveResourceContent(ctx, id, 2, repeated)).rejects.toMatchObject({
      code: "INVALID",
    });
  });

  it("CA-0024-06: Word y PDF con sesiones en orden, rúbrica con la escala del espacio y marca de borrador", async () => {
    const ctx = await independentTeacher();
    const topic = await topicFor(ctx);
    const run = engine();
    const { id } = await createResource(ctx, blueprint(topic.id), run.deps);
    await run.done();

    const draft = await docxText(
      await exportResource(ctx, id, { doc: "student", format: "docx", variant: "A" }),
    );
    const positions = [1, 2, 3].map((n) =>
      draft.indexOf(`Sesión ${n}. Fracciones en la tienda ${n}`),
    );
    expect(positions.every((p) => p > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(draft).toContain("Superior (4,6 – 5,0)");
    expect(draft).toContain("Bajo (1,0 – 2,9)");
    expect(draft).toMatch(/BORRADOR/i);
    // El plan no tiene clave.
    await expect(
      exportResource(ctx, id, { doc: "key", format: "docx", variant: "A" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await updateGradingBands(ctx, tenScale);
    await setResourceStatus(ctx, id, "READY");
    const ready = await exportResource(ctx, id, { doc: "student", format: "docx", variant: "A" });
    const xml = await docxText(ready);
    expect(xml).toContain("Superior (10 – 10)");
    expect(xml).toContain("Básico (6 – 7)");
    expect(xml).not.toMatch(/BORRADOR/i);
    expect(ready.filename).toMatch(/^Plan de aula - Fracciones/);

    const pdf = await exportResource(ctx, id, { doc: "student", format: "pdf", variant: "A" });
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
  });
});
