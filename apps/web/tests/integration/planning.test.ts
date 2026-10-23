import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCourse, createSubject, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import {
  acceptInvitation,
  createIndependentSpace,
  createInvitation,
  registerSchool,
} from "@/modules/institutions";
import {
  copyPlanning,
  createObjective,
  createTopic,
  createUnit,
  getCoursePlanning,
  moveItem,
  setCoursePeriods,
  setItemArchived,
  updateObjective,
  updateTopic,
} from "@/modules/planning";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase, validSchool } from "../support/factories";

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");

async function teacher(name = "Profe") {
  const user = await createUser(name);
  const { institutionId } = await createIndependentSpace(user);
  return { user, ctx: await ctxFor(user, institutionId), institutionId };
}

async function course(
  ctx: TenantContext,
  subjectName = "Matemáticas",
  grade = "G6",
  groupName = "601",
) {
  const subject = (await listSubjects(ctx)).find((s) => s.name === subjectName)!;
  return createCourse(ctx, {
    subjectId: subject.id,
    grade: grade as "G6",
    groupName,
    academicYear: "2026",
  });
}

/** Curso con unidad → tema → objetivo vinculado al DBA 1 de 6° (evidencias 0 y 2). */
async function plannedCourse(ctx: TenantContext) {
  const c = await course(ctx);
  await getCoursePlanning(ctx, c.id); // crea periodos por defecto
  const unit = await createUnit(ctx, {
    courseId: c.id,
    periodNumber: 1,
    title: "Números enteros",
    description: null,
  });
  const topic = await createTopic(ctx, {
    unitId: unit.id,
    title: "La recta numérica",
    description: null,
    plannedSessions: 4,
  });
  const objective = await createObjective(ctx, {
    topicId: topic.id,
    statement: "Ubica números enteros en la recta numérica.",
    links: [{ code: "MEN-DBA-MAT-V2-G6-01", evidenceIndexes: [2, 0, 0] }],
  });
  return { course: c, unit, topic, objective };
}

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("periodos del curso", () => {
  it("CA-0006-01: un curso sin periodos recibe 4 por defecto al abrir la planeación", async () => {
    const { ctx } = await teacher();
    const c = await course(ctx);
    const planning = await getCoursePlanning(ctx, c.id);
    expect(planning.periods.map((p) => p.name)).toEqual([
      "Periodo 1",
      "Periodo 2",
      "Periodo 3",
      "Periodo 4",
    ]);
    await getCoursePlanning(ctx, c.id);
    expect(await db.coursePeriod.count({ where: { courseId: c.id } })).toBe(4);
  });

  it("CA-0006-02: el profesor define 3 periodos con fechas en su curso; los demás no cambian", async () => {
    const { ctx } = await teacher();
    const a = await course(ctx, "Matemáticas", "G6", "601");
    const b = await course(ctx, "Matemáticas", "G6", "602");
    await getCoursePlanning(ctx, a.id);
    await getCoursePlanning(ctx, b.id);

    await setCoursePeriods(ctx, {
      courseId: a.id,
      periods: [
        { number: 1, name: "Primer trimestre", startDate: "2026-02-01", endDate: "2026-04-30" },
        { number: 2, name: "Segundo trimestre", startDate: "2026-05-01", endDate: "2026-08-15" },
        { number: 3, name: "Tercer trimestre", startDate: null, endDate: null },
      ],
    });
    const pa = await getCoursePlanning(ctx, a.id);
    expect(pa.periods.map((p) => p.name)).toEqual([
      "Primer trimestre",
      "Segundo trimestre",
      "Tercer trimestre",
    ]);
    expect(pa.periods[0]).toMatchObject({ startDate: "2026-02-01", endDate: "2026-04-30" });
    expect((await getCoursePlanning(ctx, b.id)).periods).toHaveLength(4);
  });

  it("CA-0006-02: quitar un periodo con unidades se rechaza", async () => {
    const { ctx } = await teacher();
    const c = await course(ctx);
    await getCoursePlanning(ctx, c.id);
    await createUnit(ctx, {
      courseId: c.id,
      periodNumber: 4,
      title: "Estadística",
      description: null,
    });
    await expect(
      setCoursePeriods(ctx, {
        courseId: c.id,
        periods: [1, 2, 3].map((n) => ({
          number: n,
          name: `P${n}`,
          startDate: null,
          endDate: null,
        })),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.coursePeriod.count({ where: { courseId: c.id } })).toBe(4);
  });
});

describe("estructura de la planeación", () => {
  it("CA-0006-03: unidad → tema → objetivo en orden, en su periodo y auditados", async () => {
    const { ctx } = await teacher();
    const { course: c, unit } = await plannedCourse(ctx);
    await createUnit(ctx, {
      courseId: c.id,
      periodNumber: 1,
      title: "Fracciones",
      description: null,
    });

    const planning = await getCoursePlanning(ctx, c.id);
    expect(planning.units.map((u) => u.title)).toEqual(["Números enteros", "Fracciones"]);
    expect(planning.units[0]).toMatchObject({ periodNumber: 1 });
    expect(planning.units[0]!.topics[0]).toMatchObject({
      title: "La recta numérica",
      plannedSessions: 4,
    });
    expect(planning.units[0]!.topics[0]!.objectives[0]!.statement).toContain("recta numérica");

    const actions = (await db.auditLog.findMany({ where: { entityId: unit.id } })).map(
      (a) => a.action,
    );
    expect(actions).toContain("unit.created");
  });

  it("una unidad en un periodo que no existe se rechaza", async () => {
    const { ctx } = await teacher();
    const c = await course(ctx);
    await getCoursePlanning(ctx, c.id);
    await expect(
      createUnit(ctx, { courseId: c.id, periodNumber: 6, title: "Fuera", description: null }),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("CA-0006-06: subir y bajar conserva el nuevo orden", async () => {
    const { ctx } = await teacher();
    const c = await course(ctx);
    await getCoursePlanning(ctx, c.id);
    const ids = [];
    for (const title of ["A", "B", "C"]) {
      ids.push(
        (
          await createUnit(ctx, {
            courseId: c.id,
            periodNumber: 1,
            title: `Unidad ${title}`,
            description: null,
          })
        ).id,
      );
    }
    await moveItem(ctx, "unit", ids[2]!, "up");
    await moveItem(ctx, "unit", ids[0]!, "up"); // ya está arriba: no hace nada
    const order = (await getCoursePlanning(ctx, c.id)).units.map((u) => u.title);
    expect(order).toEqual(["Unidad A", "Unidad C", "Unidad B"]);
  });

  it("CA-0006-09: archivar una unidad la oculta con su contenido y restaurarla la devuelve", async () => {
    const { ctx } = await teacher();
    const { course: c, unit } = await plannedCourse(ctx);
    await setItemArchived(ctx, "unit", unit.id, true);
    expect((await getCoursePlanning(ctx, c.id)).units).toEqual([]);
    expect((await getCoursePlanning(ctx, c.id, { includeArchived: true })).units).toHaveLength(1);

    await setItemArchived(ctx, "unit", unit.id, false);
    const restored = await getCoursePlanning(ctx, c.id);
    expect(restored.units[0]!.topics[0]!.objectives).toHaveLength(1);
  });
});

describe("vínculo curricular", () => {
  it("CA-0006-04: vincula DBA del curso con evidencias elegidas y su cita", async () => {
    const { ctx } = await teacher();
    const { course: c } = await plannedCourse(ctx);
    const link = (await getCoursePlanning(ctx, c.id)).units[0]!.topics[0]!.objectives[0]!.links[0]!;
    const item = await db.curriculumItem.findUniqueOrThrow({
      where: { code: "MEN-DBA-MAT-V2-G6-01" },
    });

    expect(link).toMatchObject({
      code: "MEN-DBA-MAT-V2-G6-01",
      evidenceIndexes: [0, 2],
      superseded: false,
    });
    expect(link.evidences).toEqual([item.evidences[0], item.evidences[2]]);
    expect(link.citation).toMatchObject({ version: "V.2", year: 2016, page: item.page });
  });

  it("CA-0006-04: un DBA de otro grado o área, o una evidencia ajena, se rechaza", async () => {
    const { ctx } = await teacher();
    const { topic } = await plannedCourse(ctx);
    for (const links of [
      [{ code: "MEN-DBA-MAT-V2-G7-01", evidenceIndexes: [] }],
      [{ code: "MEN-DBA-LEN-V2-G6-01", evidenceIndexes: [] }],
      [{ code: "MEN-DBA-MAT-V2-G6-01", evidenceIndexes: [42] }],
      [{ code: "NO-EXISTE", evidenceIndexes: [] }],
    ]) {
      await expect(
        createObjective(ctx, { topicId: topic.id, statement: "Objetivo de prueba", links }),
      ).rejects.toMatchObject({ code: "INVALID" });
    }
  });

  it("RN-06: el vínculo se conserva si el MEN reemplaza la fuente, y se marca", async () => {
    const { ctx } = await teacher();
    const { course: c, objective } = await plannedCourse(ctx);
    await db.curriculumSource.update({
      where: { key: "MEN-DBA-MAT-V2" },
      data: { status: "SUPERSEDED" },
    });

    const link = (await getCoursePlanning(ctx, c.id)).units[0]!.topics[0]!.objectives[0]!.links[0]!;
    expect(link.superseded).toBe(true);
    // Editar el objetivo puede conservar el DBA anterior.
    await updateObjective(ctx, {
      objectiveId: objective.id,
      statement: "Ubica enteros y racionales en la recta.",
      links: [{ code: "MEN-DBA-MAT-V2-G6-01", evidenceIndexes: [] }],
    });
  });

  it("CA-0006-10: un objetivo sin DBA se guarda y el curso indica que el área sí tiene DBA", async () => {
    const { ctx } = await teacher();
    const { topic, course: c } = await plannedCourse(ctx);
    await createObjective(ctx, {
      topicId: topic.id,
      statement: "Trabaja en equipo con respeto.",
      links: [],
    });
    const planning = await getCoursePlanning(ctx, c.id);
    expect(planning.areaHasItems).toBe(true);
    expect(planning.units[0]!.topics[0]!.objectives[1]!.links).toEqual([]);

    // En un área sin DBA (Ética) no hay aviso.
    const etica = await course(ctx, "Ética y Valores Humanos", "G6", "601");
    expect((await getCoursePlanning(ctx, etica.id)).areaHasItems).toBe(false);
  });

  it("CA-0006-05: la cobertura muestra los DBA del grado vinculados y pendientes", async () => {
    const { ctx } = await teacher();
    const { course: c } = await plannedCourse(ctx);
    const { coverage } = await getCoursePlanning(ctx, c.id);
    const total = await db.curriculumItem.count({ where: { areaId: "MATEMATICAS", grade: "G6" } });
    expect(coverage.total).toBe(total);
    expect(coverage.covered).toEqual(["MEN-DBA-MAT-V2-G6-01"]);
    expect(coverage.pending).toHaveLength(total - 1);
    expect(coverage.pending.map((p) => p.code)).not.toContain("MEN-DBA-MAT-V2-G6-01");
  });
});

describe("copiar planeación", () => {
  it("CA-0006-07: crea una copia independiente con orden y vínculos", async () => {
    const { ctx } = await teacher();
    const { course: from, topic } = await plannedCourse(ctx);
    await createTopic(ctx, {
      unitId: (await db.topic.findUniqueOrThrow({ where: { id: topic.id } })).unitId,
      title: "Opuestos",
      description: null,
      plannedSessions: null,
    });
    const to = await course(ctx, "Matemáticas", "G6", "602");

    expect(await copyPlanning(ctx, from.id, to.id)).toEqual({ units: 1, topics: 2, objectives: 1 });
    const copy = await getCoursePlanning(ctx, to.id);
    expect(copy.periods).toHaveLength(4);
    expect(copy.units[0]!.topics.map((t) => t.title)).toEqual(["La recta numérica", "Opuestos"]);
    expect(copy.units[0]!.topics[0]!.objectives[0]!.links[0]!.evidenceIndexes).toEqual([0, 2]);

    // Independiente: editar la copia no cambia el original.
    await updateTopic(ctx, {
      topicId: copy.units[0]!.topics[0]!.id,
      title: "Recta (602)",
      description: null,
      plannedSessions: 2,
    });
    expect((await getCoursePlanning(ctx, from.id)).units[0]!.topics[0]!.title).toBe(
      "La recta numérica",
    );
  });

  it("RN-08: si el destino ya tiene periodos, los conserva y la unidad sin periodo equivalente queda sin periodo", async () => {
    const { ctx } = await teacher();
    const from = await course(ctx, "Matemáticas", "G6", "601");
    await getCoursePlanning(ctx, from.id);
    await createUnit(ctx, {
      courseId: from.id,
      periodNumber: 1,
      title: "Unidad del P1",
      description: null,
    });
    await createUnit(ctx, {
      courseId: from.id,
      periodNumber: 4,
      title: "Unidad del P4",
      description: null,
    });

    const to = await course(ctx, "Matemáticas", "G6", "602");
    await getCoursePlanning(ctx, to.id);
    await setCoursePeriods(ctx, {
      courseId: to.id,
      periods: [1, 2].map((n) => ({
        number: n,
        name: `Semestre ${n}`,
        startDate: null,
        endDate: null,
      })),
    });
    await createUnit(ctx, {
      courseId: to.id,
      periodNumber: 2,
      title: "Ya existía",
      description: null,
    });

    await copyPlanning(ctx, from.id, to.id);
    const target = await getCoursePlanning(ctx, to.id);
    expect(target.periods.map((p) => p.name)).toEqual(["Semestre 1", "Semestre 2"]);
    expect(target.units.map((u) => [u.title, u.periodNumber])).toEqual([
      ["Ya existía", 2],
      ["Unidad del P1", 1],
      ["Unidad del P4", null],
    ]);
  });

  it("RN-08: solo a cursos propios de la misma asignatura y grado", async () => {
    const { ctx } = await teacher();
    const { course: from } = await plannedCourse(ctx);
    const otherGrade = await course(ctx, "Matemáticas", "G7", "701");
    const otherSubject = await course(ctx, "Lengua Castellana", "G6", "601");
    await expect(copyPlanning(ctx, from.id, otherGrade.id)).rejects.toMatchObject({
      code: "INVALID",
    });
    await expect(copyPlanning(ctx, from.id, otherSubject.id)).rejects.toMatchObject({
      code: "INVALID",
    });
    await expect(copyPlanning(ctx, from.id, from.id)).rejects.toMatchObject({ code: "INVALID" });

    const other = await teacher("Otra");
    const foreign = await course(other.ctx, "Matemáticas", "G6", "601");
    await expect(copyPlanning(ctx, from.id, foreign.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("aislamiento", () => {
  it("CA-0006-08: otro profesor del mismo colegio recibe NOT_FOUND con IDs ajenos", async () => {
    const admin = await createUser("Rector");
    const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
    const adminCtx = await ctxFor(admin, institutionId);
    const colleague = await createUser("Colega");
    const { token } = await createInvitation(adminCtx, {
      email: colleague.email,
      roles: ["TEACHER"],
    });
    await acceptInvitation(colleague, token);
    const colleagueCtx = await ctxFor(colleague, institutionId);

    const { course: c, unit, topic, objective } = await plannedCourse(adminCtx);
    const attempts = [
      () => getCoursePlanning(colleagueCtx, c.id),
      () =>
        createUnit(colleagueCtx, {
          courseId: c.id,
          periodNumber: 1,
          title: "Intrusa",
          description: null,
        }),
      () =>
        createTopic(colleagueCtx, {
          unitId: unit.id,
          title: "Intruso",
          description: null,
          plannedSessions: null,
        }),
      () =>
        updateTopic(colleagueCtx, {
          topicId: topic.id,
          title: "Cambiado",
          description: null,
          plannedSessions: null,
        }),
      () =>
        updateObjective(colleagueCtx, {
          objectiveId: objective.id,
          statement: "Cambiado otra vez",
          links: [],
        }),
      () => moveItem(colleagueCtx, "unit", unit.id, "down"),
      () => setItemArchived(colleagueCtx, "objective", objective.id, true),
      () =>
        setCoursePeriods(colleagueCtx, {
          courseId: c.id,
          periods: [{ number: 1, name: "P1", startDate: null, endDate: null }],
        }),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect((await getCoursePlanning(adminCtx, c.id)).units[0]!.topics[0]!.title).toBe(
      "La recta numérica",
    );
  });

  it("CA-0006-08: la base rechaza un tema que mezcle espacios aunque el código fallara", async () => {
    const a = await teacher("A");
    const b = await teacher("B");
    const { unit } = await plannedCourse(a.ctx);
    await expect(
      db.topic.create({
        data: { institutionId: b.institutionId, unitId: unit.id, title: "Mezcla", position: 1 },
      }),
    ).rejects.toThrow();
  });

  it("una asignatura propia sin área permite planear, pero no vincular DBA", async () => {
    const { ctx } = await teacher();
    const custom = await createSubject(ctx, "Robótica");
    const c = await createCourse(ctx, {
      subjectId: custom.id,
      grade: "G6",
      groupName: "",
      academicYear: "2026",
    });
    const planning = await getCoursePlanning(ctx, c.id);
    expect(planning.hasArea).toBe(false);
    const unit = await createUnit(ctx, {
      courseId: c.id,
      periodNumber: 1,
      title: "Sensores",
      description: null,
    });
    const topic = await createTopic(ctx, {
      unitId: unit.id,
      title: "Luz",
      description: null,
      plannedSessions: null,
    });
    await expect(
      createObjective(ctx, {
        topicId: topic.id,
        statement: "Arma un circuito",
        links: [{ code: "MEN-DBA-MAT-V2-G6-01", evidenceIndexes: [] }],
      }),
    ).rejects.toMatchObject({ code: "INVALID" });
  });
});
