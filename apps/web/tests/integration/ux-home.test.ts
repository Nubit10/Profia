import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { createIndependentSpace } from "@/modules/institutions";
import {
  createQuickTopic,
  createTopic,
  createUnit,
  getCoursePlanning,
  listTopicOutline,
  setItemArchived,
} from "@/modules/planning";
import { DAILY_LIMIT, getQuotaStatus, getTeacherHome, listMyResources } from "@/modules/resources";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0012: Inicio con siguiente paso (RN-02), cupo del menú (RN-12), "Mis recursos" (RN-13) y
// tema rápido del asistente. Todo calculado en el servidor y filtrado por espacio y docente.

async function teacher(name = "Profe") {
  const user = await createUser(name);
  const { institutionId } = await createIndependentSpace(user);
  return ctxFor(user, institutionId);
}

async function course(ctx: TenantContext, group: string, subjectName = "Matemáticas") {
  const subject = (await listSubjects(ctx)).find((s) => s.name === subjectName)!;
  const created = await createCourse(ctx, {
    subjectId: subject.id,
    grade: "G6",
    groupName: group,
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, created.id);
  return created;
}

async function topic(ctx: TenantContext, courseId: string, title = "La recta numérica") {
  const unit = await createUnit(ctx, {
    courseId,
    periodNumber: 1,
    title: "Números enteros",
    description: null,
  });
  return createTopic(ctx, { unitId: unit.id, title, description: null, plannedSessions: null });
}

/** Recurso guardado tal como lo deja la generación (generationId marca "con IA"). */
async function resource(
  ctx: TenantContext,
  courseId: string,
  topicId: string,
  opts: { type?: "QUIZ" | "WORKSHOP"; status?: "DRAFT" | "FAILED" | "READY"; title?: string } = {},
) {
  return db.resource.create({
    data: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      courseId,
      topicId,
      type: opts.type ?? "QUIZ",
      status: opts.status ?? "DRAFT",
      title: opts.title ?? "Quiz: La recta numérica",
      blueprint: {},
      context: { topic: { id: topicId, title: "La recta numérica", description: null } },
      generationId: "log",
    },
    select: { id: true },
  });
}

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

describe("Inicio: siguiente paso (SPEC-0012 RN-02)", () => {
  it("CA-0012-03: sin cursos, el siguiente paso es crear el primer curso", async () => {
    const ctx = await teacher();
    const home = await getTeacherHome(ctx);
    expect(home.nextStep).toEqual({ kind: "CREATE_COURSE" });
    expect(home.courses).toEqual([]);
    expect(home.recent).toEqual([]);
  });

  it("CA-0012-03: con un curso sin temas, el siguiente paso es planear ese curso", async () => {
    const ctx = await teacher();
    const c = await course(ctx, "601");
    const home = await getTeacherHome(ctx);
    expect(home.nextStep).toMatchObject({ kind: "PLAN", courseId: c.id });
    expect(home.courses[0]).toMatchObject({ id: c.id, topicCount: 0 });
  });

  it("CA-0012-04: con curso y tema pero sin recursos, propone el primer taller con ese tema", async () => {
    const ctx = await teacher();
    const c = await course(ctx, "601");
    const t = await topic(ctx, c.id);
    const home = await getTeacherHome(ctx);
    expect(home.nextStep).toMatchObject({
      kind: "FIRST_WORKSHOP",
      courseId: c.id,
      topicId: t.id,
      topicTitle: "La recta numérica",
    });
    expect(home.courses[0]!.topicCount).toBe(1);
  });

  it("CA-0012-05: con recursos, muestra los recientes y el siguiente paso abre el último", async () => {
    const ctx = await teacher();
    const c = await course(ctx, "601");
    const t = await topic(ctx, c.id);
    await resource(ctx, c.id, t.id, { title: "Quiz viejo" });
    const last = await resource(ctx, c.id, t.id, { type: "WORKSHOP", title: "Taller nuevo" });
    const home = await getTeacherHome(ctx);
    expect(home.nextStep).toMatchObject({ kind: "OPEN_LAST", resource: { id: last.id } });
    expect(home.recent.map((r) => r.title)).toEqual(["Taller nuevo", "Quiz viejo"]);
    expect(home.recent[0]).toMatchObject({ courseId: c.id, courseTitle: "Matemáticas · 6° · 601" });
  });

  it("acceso cruzado: los cursos y recursos de otro espacio no cuentan para el siguiente paso", async () => {
    const owner = await teacher("Dueña");
    const c = await course(owner, "601");
    const t = await topic(owner, c.id);
    await resource(owner, c.id, t.id);

    const other = await teacher("Otra");
    const home = await getTeacherHome(other);
    expect(home.nextStep).toEqual({ kind: "CREATE_COURSE" });
    expect(home.recent).toEqual([]);
    expect(await listTopicOutline(other)).toEqual([]);
  });
});

describe("cupo del menú (SPEC-0012 RN-12)", () => {
  it("CA-0012-21: cuenta las generaciones de 24 horas sin las fallidas", async () => {
    const ctx = await teacher();
    const c = await course(ctx, "601");
    const t = await topic(ctx, c.id);
    for (let i = 0; i < 7; i++) await resource(ctx, c.id, t.id);
    await resource(ctx, c.id, t.id, { status: "FAILED" });

    expect(await getQuotaStatus(ctx)).toEqual({ used: 7, limit: DAILY_LIMIT, freesAt: null });
  });

  it("CA-0012-21: con el cupo agotado, indica cuándo se renueva", async () => {
    const ctx = await teacher();
    const c = await course(ctx, "601");
    const t = await topic(ctx, c.id);
    for (let i = 0; i < DAILY_LIMIT; i++) await resource(ctx, c.id, t.id);

    const quota = await getQuotaStatus(ctx);
    expect(quota.used).toBe(DAILY_LIMIT);
    expect(quota.freesAt).toBeInstanceOf(Date);
    expect(quota.freesAt!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("Mis recursos (SPEC-0012 RN-13)", () => {
  it("CA-0012-27: reúne los recursos de todos los cursos y filtra por curso y tipo", async () => {
    const ctx = await teacher();
    const a = await course(ctx, "601");
    const b = await course(ctx, "602");
    const ta = await topic(ctx, a.id);
    const tb = await topic(ctx, b.id);
    await resource(ctx, a.id, ta.id, { type: "QUIZ", title: "Quiz A" });
    await resource(ctx, b.id, tb.id, { type: "WORKSHOP", title: "Taller B" });

    const all = await listMyResources(ctx);
    expect(all.map((r) => r.title).sort()).toEqual(["Quiz A", "Taller B"]);
    expect((await listMyResources(ctx, { courseId: b.id })).map((r) => r.title)).toEqual([
      "Taller B",
    ]);
    expect((await listMyResources(ctx, { type: "QUIZ" })).map((r) => r.title)).toEqual(["Quiz A"]);
  });

  it("CA-0012-27: acceso cruzado: no ve recursos de otro docente ni de otro espacio", async () => {
    const owner = await teacher("Dueña");
    const c = await course(owner, "601");
    const t = await topic(owner, c.id);
    await resource(owner, c.id, t.id);

    const other = await teacher("Otra");
    expect(await listMyResources(other)).toEqual([]);
    // Aunque pida el curso ajeno por id, el filtro no abre la puerta.
    expect(await listMyResources(other, { courseId: c.id })).toEqual([]);
  });
});

describe("tema rápido del asistente (SPEC-0012 §7)", () => {
  it("crea 'Unidad 1' en el periodo 1 cuando el curso no tiene unidades", async () => {
    const ctx = await teacher();
    const c = await course(ctx, "601");
    const { topicId } = await createQuickTopic(ctx, { courseId: c.id, title: "Fracciones" });

    const outline = await listTopicOutline(ctx);
    expect(outline).toEqual([
      {
        courseId: c.id,
        units: [
          expect.objectContaining({
            title: "Unidad 1",
            periodNumber: 1,
            topics: [{ id: topicId, title: "Fracciones", objectiveCount: 0 }],
          }),
        ],
      },
    ]);
  });

  it("usa la primera unidad activa si ya existe y no muestra temas archivados", async () => {
    const ctx = await teacher();
    const c = await course(ctx, "601");
    const old = await topic(ctx, c.id, "Tema viejo");
    await setItemArchived(ctx, "topic", old.id, true);
    await createQuickTopic(ctx, { courseId: c.id, title: "Tema nuevo" });

    const [entry] = await listTopicOutline(ctx);
    expect(entry!.units).toHaveLength(1);
    expect(entry!.units[0]!.title).toBe("Números enteros");
    expect(entry!.units[0]!.topics.map((t) => t.title)).toEqual(["Tema nuevo"]);
  });

  it("acceso cruzado: no puede crear temas en el curso de otro docente", async () => {
    const owner = await teacher("Dueña");
    const c = await course(owner, "601");
    const other = await teacher("Otra");
    await expect(
      createQuickTopic(other, { courseId: c.id, title: "Intruso" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
