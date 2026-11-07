import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { getLimiter } from "@/lib/rate-limit";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import {
  PROPOSALS_PER_DAY,
  PROPOSALS_PER_MINUTE,
  proposeObjectivesBatch,
  proposePlanning,
  type EnginePlanningRequest,
} from "@/modules/generation";
import {
  acceptInvitation,
  createIndependentSpace,
  createInvitation,
  registerSchool,
} from "@/modules/institutions";
import {
  acceptObjectivesBatch,
  acceptPlanningProposal,
  createObjective,
  createTopic,
  createUnit,
  getCoursePlanning,
  listCoursePlans,
  setItemArchived,
} from "@/modules/planning";
import {
  DAILY_LIMIT,
  createResourceQuick,
  getQuotaStatus,
  groupByPlan,
  listCourseResources,
  listMyResources,
} from "@/modules/resources";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase, validSchool } from "../support/factories";

// SPEC-0014 parte 1: proponer la planeación con IA y agregarla (RN-01 a RN-05, RN-08).

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const INVENTED = "MEN-DBA-INVENTADO-99";

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

/** Motor de prueba que cumple el contrato: reparte `mustCover` y agrega un código inventado. */
function engine(opts: { invent?: boolean; status?: number } = {}) {
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (opts.status) return new Response("{}", { status: opts.status });
    const body = JSON.parse(String(init?.body)) as EnginePlanningRequest;
    const periods = body.periods.map((p) => {
      const units = Array.from({ length: body.unitsMin }, (_, u) => ({
        title: body.unit ? body.unit.title : `Unidad ${u + 1} del periodo ${p.number}`,
        topics: Array.from({ length: Math.max(body.topicsMin, 2) }, (_, t) => ({
          title: `Tema ${u + 1}.${t + 1} del periodo ${p.number}`,
          description: "Se trabaja en clase.",
          dbaCodes: [] as string[],
        })),
      }));
      const slots = units.flatMap((u) => u.topics);
      p.mustCover.forEach((code, i) => slots[i % slots.length]!.dbaCodes.push(code));
      slots.forEach((t, i) => {
        if (t.dbaCodes.length === 0 && p.dbaCodes.length)
          t.dbaCodes.push(p.dbaCodes[i % p.dbaCodes.length]!);
      });
      if (opts.invent) slots[0]!.dbaCodes = [INVENTED];
      return { number: p.number, units };
    });
    return Response.json({
      periods,
      meta: {
        provider: "groq",
        model: "qwen/qwen3.8-27b",
        promptVersion: "planning.v1",
        attempts: 1,
        latencyMs: 900,
        tokens: 1500,
        droppedCodes: 0,
      },
    });
  });
}

const bodyOf = (fetcher: ReturnType<typeof engine>, call = 0) =>
  JSON.parse(
    String((fetcher.mock.calls[call] as unknown as [URL, RequestInit])[1].body),
  ) as EnginePlanningRequest;

async function teacher(name = "Profe") {
  const user = await createUser(name);
  const { institutionId } = await createIndependentSpace(user);
  return ctxFor(user, institutionId);
}

async function mathCourse(ctx: TenantContext, subjectName = "Matemáticas") {
  const subject = (await listSubjects(ctx)).find((s) => s.name === subjectName)!;
  const course = await createCourse(ctx, {
    subjectId: subject.id,
    grade: "G6",
    groupName: "601",
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, course.id); // crea los 4 periodos por defecto
  return course;
}

/** Acepta todo lo propuesto, tal cual. */
async function acceptAll(
  ctx: TenantContext,
  proposal: Awaited<ReturnType<typeof proposePlanning>>,
) {
  if (proposal.status !== "ok") throw new Error(proposal.status);
  return acceptPlanningProposal(ctx, {
    courseId: proposal.courseId,
    units: proposal.periods.flatMap((p) =>
      p.units.map((u) => {
        const topics = u.topics.map((t) => ({
          title: t.title,
          description: t.description,
          dbaCodes: t.dba.map((d) => d.code),
        }));
        return u.unitId
          ? { kind: "EXISTING" as const, unitId: u.unitId, topics }
          : { kind: "NEW" as const, periodNumber: p.number, title: u.title, topics };
      }),
    ),
  });
}

describe("proponer la planeación con IA (SPEC-0014)", () => {
  it("CA-0014-02: solo DBA del curso y del periodo, con el texto de la base; el inventado se descarta", async () => {
    const ctx = await teacher();
    const course = await mathCourse(ctx);
    const fetcher = engine({ invent: true });
    const result = await proposePlanning(
      ctx,
      { scope: "PERIOD", courseId: course.id, periodNumber: 1, size: "DEFAULT" },
      fetcher,
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const topics = result.periods[0]!.units.flatMap((u) => u.topics);
    expect(topics[0]!.dba).toEqual([]); // "Sin DBA"
    const catalog = await db.curriculumItem.findMany({
      where: { code: { startsWith: "MEN-DBA-MAT-V2-G6-" } },
      select: { code: true, statement: true },
    });
    const statements = new Map(catalog.map((c) => [c.code, c.statement]));
    for (const d of topics.flatMap((t) => t.dba)) {
      expect(d.statement).toBe(statements.get(d.code));
    }
    // El periodo 1 recibe su bloque de DBA (3 de 12) para cubrir, y nada personal.
    const body = bodyOf(fetcher);
    expect(body.periods[0]!.mustCover).toEqual([
      "MEN-DBA-MAT-V2-G6-01",
      "MEN-DBA-MAT-V2-G6-02",
      "MEN-DBA-MAT-V2-G6-03",
    ]);
    const raw = JSON.stringify(body);
    for (const personal of [ctx.userName, ctx.userEmail, ctx.institutionName, ctx.institutionId]) {
      expect(raw).not.toContain(personal);
    }
  });

  it("CA-0014-19: queda en generation_logs con modelo, prompt y DBA descartados; nada se crea antes de aceptar", async () => {
    const ctx = await teacher();
    const course = await mathCourse(ctx);
    const result = await proposePlanning(
      ctx,
      { scope: "PERIOD", courseId: course.id, periodNumber: 1, size: "DEFAULT" },
      engine({ invent: true }),
    );
    if (result.status !== "ok") throw new Error(result.status);
    const log = await db.generationLog.findUniqueOrThrow({ where: { id: result.generationId } });
    expect(log).toMatchObject({
      task: "planning",
      status: "OK",
      model: "qwen/qwen3.8-27b",
      promptVersion: "planning.v1",
      attempts: 1,
      tokens: 1500,
      discardedCodes: 1,
    });
    expect(await db.unit.count({ where: { courseId: course.id } })).toBe(0);
    expect(await db.topic.count({ where: { institutionId: ctx.institutionId } })).toBe(0);
  });

  it("CA-0014-01/03: aceptar guarda exactamente lo que quedó en la revisión", async () => {
    const ctx = await teacher();
    const course = await mathCourse(ctx);
    const proposal = await proposePlanning(
      ctx,
      { scope: "PERIOD", courseId: course.id, periodNumber: 1, size: "DEFAULT" },
      engine(),
    );
    if (proposal.status !== "ok") throw new Error(proposal.status);
    const [first, second] = proposal.periods[0]!.units;
    const added = await acceptPlanningProposal(ctx, {
      courseId: course.id,
      units: [
        {
          kind: "NEW",
          periodNumber: 1,
          title: "Números enteros",
          topics: [
            {
              title: "La recta numérica",
              description: null,
              dbaCodes: first!.topics[0]!.dba.map((d) => d.code),
            },
            // Un código ajeno al curso que llegue del navegador se descarta (RN-01).
            { title: first!.topics[1]!.title, description: null, dbaCodes: [INVENTED] },
          ],
        },
        {
          kind: "NEW",
          periodNumber: 1,
          title: second!.title,
          topics: second!.topics.map((t) => ({
            title: t.title,
            description: t.description,
            dbaCodes: [],
          })),
        },
      ],
    });
    expect(added).toEqual({ units: 2, topics: 4, skipped: 0 });
    const planning = await getCoursePlanning(ctx, course.id);
    expect(planning.units.map((u) => [u.periodNumber, u.title])).toEqual([
      [1, "Números enteros"],
      [1, second!.title],
    ]);
    expect(planning.units[0]!.topics[0]).toMatchObject({
      title: "La recta numérica",
      dbaCodes: first!.topics[0]!.dba.map((d) => d.code),
    });
    expect(planning.units[0]!.topics[1]!.dbaCodes).toEqual([]);
    const audit = await db.auditLog.findFirst({
      where: { action: "planning.ai_proposal_accepted", entityId: course.id },
    });
    expect(audit?.metadata).toMatchObject({ units: 2, topics: 4, skipped: 0 });
  });

  it("CA-0014-04: lo existente no cambia y no se repite ningún título (ni con dos pestañas)", async () => {
    const ctx = await teacher();
    const course = await mathCourse(ctx);
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
      plannedSessions: 3,
    });
    await createObjective(ctx, {
      topicId: topic.id,
      statement: "Ubica enteros en la recta.",
      links: [],
    });
    const before = await getCoursePlanning(ctx, course.id);

    const fetcher = engine();
    const proposal = await proposePlanning(
      ctx,
      { scope: "PERIOD", courseId: course.id, periodNumber: 1, size: "DEFAULT" },
      fetcher,
    );
    expect(bodyOf(fetcher).periods[0]!.existing).toEqual([
      { title: "Números enteros", topics: ["La recta numérica"] },
    ]);
    await acceptAll(ctx, proposal);
    // Segunda pestaña: la misma propuesta otra vez, más un tema que ya existe.
    const again = await acceptAll(ctx, proposal);
    expect(again).toMatchObject({ units: 0, topics: 0 });
    const dup = await acceptPlanningProposal(ctx, {
      courseId: course.id,
      units: [
        {
          kind: "NEW",
          periodNumber: 1,
          title: "números  ENTEROS",
          topics: [{ title: "La recta numérica", description: null, dbaCodes: [] }],
        },
      ],
    });
    expect(dup).toEqual({ units: 0, topics: 0, skipped: 1 });

    const after = await getCoursePlanning(ctx, course.id);
    expect(after.units[0]).toEqual(before.units[0]);
    const titles = after.units.flatMap((u) => [u.title, ...u.topics.map((t) => t.title)]);
    expect(new Set(titles.map((t) => t.toLowerCase())).size).toBe(titles.length);
  });

  it("CA-0014-05: el año completo deja temas en cada periodo y la cobertura llega a 12 de 12", async () => {
    const ctx = await teacher();
    const course = await mathCourse(ctx);
    const fetcher = engine();
    const proposal = await proposePlanning(
      ctx,
      { scope: "YEAR", courseId: course.id, size: "DEFAULT" },
      fetcher,
    );
    const body = bodyOf(fetcher);
    expect(body.periods.map((p) => p.mustCover.length)).toEqual([3, 3, 3, 3]);
    expect(new Set(body.periods.flatMap((p) => p.mustCover)).size).toBe(12);
    await acceptAll(ctx, proposal);
    const planning = await getCoursePlanning(ctx, course.id);
    for (const number of [1, 2, 3, 4]) {
      const topics = planning.units
        .filter((u) => u.periodNumber === number)
        .flatMap((u) => u.topics);
      expect(topics.length).toBeGreaterThan(0);
    }
    expect(planning.coverage).toMatchObject({ total: 12, pending: [] });
    expect(planning.coverage.covered).toHaveLength(12);
  });

  it("CA-0014-06: temas para una unidad existente, agregados en esa unidad", async () => {
    const ctx = await teacher();
    const course = await mathCourse(ctx);
    const unit = await createUnit(ctx, {
      courseId: course.id,
      periodNumber: 2,
      title: "Geometría",
      description: null,
    });
    const fetcher = engine();
    const proposal = await proposePlanning(
      ctx,
      { scope: "UNIT", unitId: unit.id, size: "DEFAULT" },
      fetcher,
    );
    const body = bodyOf(fetcher);
    expect(body.unit).toMatchObject({ title: "Geometría", topics: [] });
    expect(body.periods.map((p) => p.number)).toEqual([2]);
    expect(body.periods[0]!.mustCover).toEqual([]);
    if (proposal.status !== "ok") throw new Error(proposal.status);
    expect(proposal.periods[0]!.units[0]!.unitId).toBe(unit.id);
    await acceptAll(ctx, proposal);
    const planning = await getCoursePlanning(ctx, course.id);
    expect(planning.units).toHaveLength(1);
    expect(planning.units[0]!.topics.length).toBeGreaterThanOrEqual(2);
  });

  it("CA-0014-07: motor apagado o salida inválida degradan; asignatura sin DBA no propone", async () => {
    const ctx = await teacher();
    const course = await mathCourse(ctx);
    const input = {
      scope: "PERIOD" as const,
      courseId: course.id,
      periodNumber: 1,
      size: "DEFAULT" as const,
    };
    expect(await proposePlanning(ctx, input, engine({ status: 503 }))).toEqual({
      status: "unavailable",
    });
    expect(await proposePlanning(ctx, input, engine({ status: 502 }))).toEqual({
      status: "invalid",
    });
    const logs = await db.generationLog.findMany({
      where: { task: "planning" },
      select: { status: true },
    });
    expect(logs.map((l) => l.status).sort()).toEqual(["INVALID", "UNAVAILABLE"]);

    const pe = await mathCourse(ctx, "Ciencias Naturales y Educación Ambiental");
    const fetcher = engine();
    await expect(
      proposePlanning(ctx, { ...input, courseId: pe.id }, fetcher),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("CA-0014-20: otro docente del colegio recibe 'no encontrado' al proponer o aceptar", async () => {
    const admin = await createUser("Rector");
    const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
    const adminCtx = await ctxFor(admin, institutionId);
    const other = await createUser("Otra");
    const { token } = await createInvitation(adminCtx, { email: other.email, roles: ["TEACHER"] });
    await acceptInvitation(other, token);
    const otherCtx = await ctxFor(other, institutionId);

    const course = await mathCourse(adminCtx);
    const unit = await createUnit(adminCtx, {
      courseId: course.id,
      periodNumber: 1,
      title: "Números enteros",
      description: null,
    });
    const fetcher = engine();
    const notFound = { code: "NOT_FOUND" };
    await expect(
      proposePlanning(otherCtx, { scope: "YEAR", courseId: course.id, size: "DEFAULT" }, fetcher),
    ).rejects.toMatchObject(notFound);
    await expect(
      proposePlanning(otherCtx, { scope: "UNIT", unitId: unit.id, size: "DEFAULT" }, fetcher),
    ).rejects.toMatchObject(notFound);
    await expect(
      acceptPlanningProposal(otherCtx, {
        courseId: course.id,
        units: [
          {
            kind: "EXISTING",
            unitId: unit.id,
            topics: [{ title: "Intruso", description: null, dbaCodes: [] }],
          },
        ],
      }),
    ).rejects.toMatchObject(notFound);
    // Una unidad de otro curso no se puede completar desde un curso propio.
    const own = await mathCourse(otherCtx);
    await expect(
      acceptPlanningProposal(otherCtx, {
        courseId: own.id,
        units: [
          {
            kind: "EXISTING",
            unitId: unit.id,
            topics: [{ title: "Intruso", description: null, dbaCodes: [] }],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db.topic.count({ where: { title: "Intruso" } })).toBe(0);
  });

  it("CA-0014-21: el límite por minuto avisa la hora y no toca el cupo de recursos", async () => {
    const ctx = await teacher();
    const course = await mathCourse(ctx);
    const quotaBefore = await getQuotaStatus(ctx);
    const input = {
      scope: "PERIOD" as const,
      courseId: course.id,
      periodNumber: 1,
      size: "LESS" as const,
    };
    for (let i = 0; i < PROPOSALS_PER_MINUTE; i++) {
      expect((await proposePlanning(ctx, input, engine())).status).toBe("ok");
    }
    await expect(proposePlanning(ctx, input, engine())).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: expect.stringMatching(/Puedes pedir otra desde las \d{1,2}:\d{2}/),
    });
    expect(await getQuotaStatus(ctx)).toEqual(quotaBefore);
  });
});

describe("límite diario de propuestas (SPEC-0014 T9)", () => {
  it("CA-0014-21: 20 propuestas al día entre planeación y objetivos; la 21 avisa la hora", async () => {
    const ctx = await teacher();
    const { unit } = await unitWithTopics(ctx, ["La recta numérica"], ["MEN-DBA-MAT-V2-G6-02"]);
    const quotaBefore = await getQuotaStatus(ctx);
    // Como si ya hubiera pedido 19 hoy, en minutos distintos (sin tocar el límite por minuto).
    const daily = getLimiter("ai-planning-day", PROPOSALS_PER_DAY, 24 * 60 * 60 * 1000);
    for (let i = 0; i < PROPOSALS_PER_DAY - 1; i++) await daily.consume(ctx.membershipId);

    // La 20 pasa; es de objetivos en bloque: comparte el límite con la planeación (RN-08).
    const batch = await proposeObjectivesBatch(
      ctx,
      { scope: "UNIT", unitId: unit.id },
      objectivesEngine(),
    );
    expect(batch.status).toBe("ok");

    const fetcher = engine();
    await expect(
      proposePlanning(ctx, { scope: "UNIT", unitId: unit.id, size: "LESS" }, fetcher),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: expect.stringMatching(/Puedes pedir otra desde las \d{1,2}:\d{2}/),
    });
    await expect(
      proposeObjectivesBatch(ctx, { scope: "UNIT", unitId: unit.id }, objectivesEngine()),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    // No se llamó a la IA y el cupo de recursos no cambió.
    expect(fetcher).not.toHaveBeenCalled();
    expect(await getQuotaStatus(ctx)).toEqual(quotaBefore);
  });
});

// --- Parte 2: objetivos en bloque (T5) y recurso con un toque (T6) -----------------------------

/** Motor de objetivos (contrato SPEC-0007): responde `count` objetivos con el primer DBA dado. */
function objectivesEngine(opts: { failFirst?: boolean } = {}) {
  let calls = 0;
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    if (opts.failFirst && calls === 1) return new Response("{}", { status: 503 });
    const body = JSON.parse(String(init?.body)) as {
      topic: { title: string };
      count: number;
      dba: { code: string }[];
    };
    return Response.json({
      suggestions: Array.from({ length: body.count }, (_, i) => ({
        statement: `Explica ${body.topic.title.toLowerCase()} con ejemplos (${i + 1}).`,
        dbaCodes: [body.dba[0]!.code, INVENTED],
      })),
      meta: {
        provider: "groq",
        model: "qwen/qwen3.8-27b",
        promptVersion: "objective_suggestions.v1",
        attempts: 1,
        latencyMs: 500,
      },
    });
  });
}

async function unitWithTopics(ctx: TenantContext, titles: string[], dbaCodes: string[] = []) {
  const course = await mathCourse(ctx);
  const unit = await createUnit(ctx, {
    courseId: course.id,
    periodNumber: 1,
    title: "Números enteros",
    description: null,
  });
  const topics = [];
  for (const title of titles) {
    topics.push(
      await createTopic(ctx, { unitId: unit.id, title, description: null, plannedSessions: null }),
    );
  }
  if (dbaCodes.length) {
    await db.topic.updateMany({ where: { unitId: unit.id }, data: { dbaCodes } });
  }
  return { course, unit, topics };
}

describe("objetivos en bloque (SPEC-0014 T5)", () => {
  it("CA-0014-08: 3 temas sin objetivos quedan con 3 objetivos cada uno, ligados a sus DBA", async () => {
    const ctx = await teacher();
    const { course, unit } = await unitWithTopics(
      ctx,
      ["La recta numérica", "Orden de enteros", "Suma de enteros"],
      ["MEN-DBA-MAT-V2-G6-02"],
    );
    const fetcher = objectivesEngine();
    const proposal = await proposeObjectivesBatch(ctx, { scope: "UNIT", unitId: unit.id }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    // RN-06: cada tema manda solo sus DBA, y el código inventado se descarta.
    for (const call of fetcher.mock.calls) {
      const body = JSON.parse(String((call as unknown as [URL, RequestInit])[1].body));
      expect(body.dba.map((d: { code: string }) => d.code)).toEqual(["MEN-DBA-MAT-V2-G6-02"]);
      expect(body.count).toBe(3);
    }
    if (proposal.status !== "ok") throw new Error(proposal.status);
    expect(
      proposal.topics.flatMap((t) => t.suggestions.flatMap((s) => s.dba.map((d) => d.number))),
    ).toEqual(Array(9).fill(2));
    const log = await db.generationLog.findUniqueOrThrow({ where: { id: proposal.generationId } });
    expect(log).toMatchObject({
      task: "objectives_batch",
      status: "OK",
      attempts: 3,
      discardedCodes: 9,
    });
    expect(await db.objective.count({ where: { institutionId: ctx.institutionId } })).toBe(0);

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
    for (const topic of planning.units[0]!.topics) {
      expect(topic.objectives).toHaveLength(3);
      expect(topic.objectives.every((o) => o.links[0]?.number === 2)).toBe(true);
    }
  });

  it("CA-0014-09: solo se guardan los marcados, con el texto editado, y ningún tema pasa de 5", async () => {
    const ctx = await teacher();
    const { course, unit, topics } = await unitWithTopics(ctx, [
      "La recta numérica",
      "Valor absoluto",
    ]);
    for (let i = 0; i < 2; i++) {
      await createObjective(ctx, {
        topicId: topics[0]!.id,
        statement: `Objetivo previo ${i + 1}.`,
        links: [],
      });
    }
    for (let i = 0; i < 3; i++) {
      await createObjective(ctx, {
        topicId: topics[1]!.id,
        statement: `Objetivo listo ${i + 1}.`,
        links: [],
      });
    }
    const fetcher = objectivesEngine();
    const proposal = await proposeObjectivesBatch(ctx, { scope: "UNIT", unitId: unit.id }, fetcher);
    if (proposal.status !== "ok") throw new Error(proposal.status);
    // El tema con 3 objetivos no se toca; el de 2 recibe 1 (hasta llegar a 3).
    expect(proposal.skipped).toBe(1);
    expect(proposal.topics.map((t) => [t.title, t.existing, t.suggestions.length])).toEqual([
      ["La recta numérica", 2, 1],
    ]);

    await acceptObjectivesBatch(ctx, {
      courseId: course.id,
      objectives: [
        {
          topicId: topics[0]!.id,
          statement: "  Ubica enteros   en la recta. ",
          dbaCodes: [INVENTED],
        },
      ],
    });
    const planning = await getCoursePlanning(ctx, course.id);
    expect(planning.units[0]!.topics[0]!.objectives.map((o) => o.statement)).toEqual([
      "Objetivo previo 1.",
      "Objetivo previo 2.",
      "Ubica enteros en la recta.",
    ]);
    expect(planning.units[0]!.topics[0]!.objectives[2]!.links).toEqual([]);

    // 3 activos + 3 nuevos = 6: no se guarda ninguno.
    await expect(
      acceptObjectivesBatch(ctx, {
        courseId: course.id,
        objectives: [1, 2, 3].map((i) => ({
          topicId: topics[1]!.id,
          statement: `Otro objetivo ${i}.`,
          dbaCodes: [],
        })),
      }),
    ).rejects.toMatchObject({ code: "INVALID", message: expect.stringContaining("más de 5") });
    expect(await db.objective.count({ where: { topicId: topics[1]!.id } })).toBe(3);
  });

  it("un tema que falla no tumba la propuesta; si fallan todos, degrada", async () => {
    const ctx = await teacher();
    const { unit } = await unitWithTopics(ctx, ["La recta numérica", "Orden de enteros"]);
    const partial = await proposeObjectivesBatch(
      ctx,
      { scope: "UNIT", unitId: unit.id },
      objectivesEngine({ failFirst: true }),
    );
    expect(partial).toMatchObject({ status: "ok", failed: 1 });
    const down = vi.fn(async () => new Response("{}", { status: 503 }));
    expect(await proposeObjectivesBatch(ctx, { scope: "UNIT", unitId: unit.id }, down)).toEqual({
      status: "unavailable",
    });
  });

  it("CA-0014-20: otro docente no propone ni acepta objetivos en temas ajenos", async () => {
    const admin = await createUser("Rector");
    const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
    const adminCtx = await ctxFor(admin, institutionId);
    const other = await createUser("Otra");
    const { token } = await createInvitation(adminCtx, { email: other.email, roles: ["TEACHER"] });
    await acceptInvitation(other, token);
    const otherCtx = await ctxFor(other, institutionId);
    const { course, unit, topics } = await unitWithTopics(adminCtx, ["La recta numérica"]);
    const fetcher = objectivesEngine();
    await expect(
      proposeObjectivesBatch(otherCtx, { scope: "UNIT", unitId: unit.id }, fetcher),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      acceptObjectivesBatch(otherCtx, {
        courseId: course.id,
        objectives: [{ topicId: topics[0]!.id, statement: "Intruso escribe aquí.", dbaCodes: [] }],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Un tema ajeno desde un curso propio tampoco.
    const own = await mathCourse(otherCtx);
    await expect(
      acceptObjectivesBatch(otherCtx, {
        courseId: own.id,
        objectives: [{ topicId: topics[0]!.id, statement: "Intruso escribe aquí.", dbaCodes: [] }],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db.objective.count()).toBe(0);
  });
});

describe("recurso con un toque (SPEC-0014 T6)", () => {
  const noRun = { schedule: () => undefined };

  it("CA-0014-10: el quiz se crea con los valores recomendados del grado y todos los objetivos", async () => {
    const ctx = await teacher();
    const { topics } = await unitWithTopics(ctx, ["La recta numérica"]);
    for (let i = 0; i < 2; i++) {
      await createObjective(ctx, {
        topicId: topics[0]!.id,
        statement: `Objetivo ${i + 1} del tema.`,
        links: [],
      });
    }
    const { id } = await createResourceQuick(ctx, { type: "QUIZ", topicId: topics[0]!.id }, noRun);
    const resource = await db.resource.findUniqueOrThrow({ where: { id } });
    expect(resource).toMatchObject({ status: "GENERATING", type: "QUIZ", topicId: topics[0]!.id });
    expect(resource.blueprint).toMatchObject({
      itemCount: 8,
      durationMinutes: 50,
      difficulty: "INTERMEDIATE",
      questionTypes: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"],
    });
    expect((resource.blueprint as { objectiveIds: string[] }).objectiveIds).toHaveLength(2);

    const workshop = await createResourceQuick(
      ctx,
      { type: "WORKSHOP", topicId: topics[0]!.id },
      noRun,
    );
    const saved = await db.resource.findUniqueOrThrow({ where: { id: workshop.id } });
    expect(saved.blueprint).toMatchObject({ itemCount: 4, structure: "START_DEVELOPMENT_CLOSE" });
  });

  it("CA-0014-11: el examen de la unidad usa todos sus temas; sin cupo se avisa sin generar", async () => {
    const ctx = await teacher();
    const { course, unit, topics } = await unitWithTopics(ctx, [
      "La recta numérica",
      "Orden de enteros",
    ]);
    const { id } = await createResourceQuick(
      ctx,
      { type: "EXAM", scope: { kind: "UNIT", unitId: unit.id } },
      noRun,
    );
    const exam = await db.resource.findUniqueOrThrow({
      where: { id },
      include: { topics: { orderBy: { position: "asc" } } },
    });
    expect(exam.title).toBe("Examen: Números enteros");
    expect(exam.topics.map((t) => t.topicId)).toEqual(topics.map((t) => t.id));

    // Con 1 de cupo, el examen (cuesta 2) se rechaza antes de llamar a la IA.
    await db.resource.updateMany({ where: { id }, data: { status: "DRAFT" } });
    for (let i = 0; i < DAILY_LIMIT - 3; i++) {
      await db.resource.create({
        data: {
          institutionId: ctx.institutionId,
          membershipId: ctx.membershipId,
          courseId: course.id,
          topicId: topics[0]!.id,
          type: "QUIZ",
          status: "DRAFT",
          title: "Quiz",
          blueprint: {},
          context: { topic: { title: "x" } },
          generationId: "log",
        },
      });
    }
    expect(await getQuotaStatus(ctx)).toMatchObject({ used: DAILY_LIMIT - 1 });
    const before = await db.resource.count();
    await expect(
      createResourceQuick(
        ctx,
        { type: "EXAM", scope: { kind: "PERIOD", courseId: course.id, periodNumber: 1 } },
        noRun,
      ),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: expect.stringContaining("te queda 1"),
    });
    expect(await db.resource.count()).toBe(before);
  });

  it("CA-0014-20: otro docente no crea con un toque sobre temas o unidades ajenos", async () => {
    const admin = await createUser("Rector");
    const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
    const adminCtx = await ctxFor(admin, institutionId);
    const other = await createUser("Otra");
    const { token } = await createInvitation(adminCtx, { email: other.email, roles: ["TEACHER"] });
    await acceptInvitation(other, token);
    const otherCtx = await ctxFor(other, institutionId);
    const { course, unit, topics } = await unitWithTopics(adminCtx, ["La recta numérica"]);
    const notFound = { code: "NOT_FOUND" };
    await expect(
      createResourceQuick(otherCtx, { type: "QUIZ", topicId: topics[0]!.id }, noRun),
    ).rejects.toMatchObject(notFound);
    await expect(
      createResourceQuick(
        otherCtx,
        { type: "EXAM", scope: { kind: "UNIT", unitId: unit.id } },
        noRun,
      ),
    ).rejects.toMatchObject(notFound);
    await expect(
      createResourceQuick(
        otherCtx,
        { type: "EXAM", scope: { kind: "PERIOD", courseId: course.id, periodNumber: 1 } },
        noRun,
      ),
    ).rejects.toMatchObject(notFound);
    expect(await db.resource.count()).toBe(0);
  });
});

describe("recursos por periodo y tema (SPEC-0014 T8)", () => {
  const noRun = { schedule: () => undefined };

  it("CA-0014-16/17: ubicados por la planeación actual; otro docente no ve planes ni recursos ajenos", async () => {
    const admin = await createUser("Rector");
    const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
    const ctx = await ctxFor(admin, institutionId);
    const { course, unit, topics } = await unitWithTopics(ctx, ["La recta numérica", "Opuestos"]);
    const subject = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
    const second = await createCourse(ctx, {
      subjectId: subject.id,
      grade: "G7",
      groupName: "701",
      academicYear: "2026",
    });
    await getCoursePlanning(ctx, second.id);
    const unit2 = await createUnit(ctx, {
      courseId: second.id,
      periodNumber: 2,
      title: "Geometría",
      description: null,
    });
    const angles = await createTopic(ctx, {
      unitId: unit2.id,
      title: "Ángulos",
      description: null,
      plannedSessions: null,
    });

    // Como si ya hubieran terminado (máximo 3 generándose a la vez).
    const make = async (input: Parameters<typeof createResourceQuick>[1]) => {
      const created = await createResourceQuick(ctx, input, noRun);
      await db.resource.updateMany({ where: { id: created.id }, data: { status: "DRAFT" } });
      return created;
    };
    const quiz = await make({ type: "QUIZ", topicId: topics[0]!.id });
    const exam = await make({ type: "EXAM", scope: { kind: "UNIT", unitId: unit.id } });
    const other = await make({ type: "WORKSHOP", topicId: angles.id });
    const old = await make({ type: "QUIZ", topicId: topics[1]!.id });
    await setItemArchived(ctx, "topic", topics[1]!.id, true);

    // El examen trae todos sus temas; el resto, su tema.
    const listed = await listCourseResources(ctx, course.id);
    expect(listed.find((r) => r.id === exam.id)!.topicIds).toEqual(topics.map((t) => t.id));
    expect(listed.find((r) => r.id === quiz.id)!.topicIds).toEqual([topics[0]!.id]);

    const [plan] = await listCoursePlans(ctx, [course.id]);
    const groups = groupByPlan(plan!, listed);
    const p1 = groups.periods.find((p) => p.number === 1)!;
    expect(p1.units[0]!.topics[0]!.resources.map((r) => r.id)).toEqual([quiz.id]);
    // CA-0014-16: el examen en "Exámenes" de su unidad; el del tema archivado, en "Temas archivados".
    expect(p1.units[0]!.exams.map((r) => r.id)).toEqual([exam.id]);
    expect(p1.archived.flatMap((a) => a.resources.map((r) => r.id))).toEqual([old.id]);

    // CA-0014-17: "Mis recursos" tiene los dos cursos, cada uno con su planeación.
    const mine = await listMyResources(ctx);
    expect(new Set(mine.map((r) => r.courseId))).toEqual(new Set([course.id, second.id]));
    const plans = await listCoursePlans(ctx, [second.id, course.id]);
    expect(plans.map((p) => p.courseId)).toEqual([second.id, course.id]);
    const secondGroups = groupByPlan(
      plans[0]!,
      mine.filter((r) => r.courseId === second.id),
    );
    expect(secondGroups.periods.map((p) => p.name)).toEqual(["Periodo 2"]);
    expect(secondGroups.periods[0]!.units[0]!.topics[0]!.resources.map((r) => r.id)).toEqual([
      other.id,
    ]);

    // Acceso cruzado: otra docente del mismo colegio no ve planes ni recursos ajenos.
    const teacher2 = await createUser("Otra");
    const { token } = await createInvitation(ctx, { email: teacher2.email, roles: ["TEACHER"] });
    await acceptInvitation(teacher2, token);
    const otherCtx = await ctxFor(teacher2, institutionId);
    expect(await listCoursePlans(otherCtx, [course.id, second.id])).toEqual([]);
    expect(await listMyResources(otherCtx)).toEqual([]);
    await expect(listCourseResources(otherCtx, course.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
