import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import {
  PROPOSALS_PER_MINUTE,
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
  acceptPlanningProposal,
  createObjective,
  createTopic,
  createUnit,
  getCoursePlanning,
} from "@/modules/planning";
import { getQuotaStatus } from "@/modules/resources";
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
