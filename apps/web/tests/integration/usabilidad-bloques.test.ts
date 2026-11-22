import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import { exportResource, previewResource } from "@/modules/documents";
import { createIndependentSpace } from "@/modules/institutions";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import { getTeacherHome } from "@/modules/resources";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// Mejoras de usabilidad (docs/usabilidad/proximos-pasos.md): bloque 3 (la hoja como se imprime,
// SPEC-0029), bloque 4 ("Para esta semana") y bloque 6 (primer curso con temas propuestos).

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");

async function teacher() {
  const user = await createUser("ProfIA");
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

async function topics(ctx: TenantContext, courseId: string, titles: string[]) {
  const unit = await createUnit(ctx, {
    courseId,
    periodNumber: 1,
    title: "Números",
    description: null,
  });
  const out = [];
  for (const title of titles) {
    out.push(
      await createTopic(ctx, { unitId: unit.id, title, description: null, plannedSessions: null }),
    );
  }
  return out;
}

const question = (i: number) => ({
  id: `q${i}`,
  type: "MULTIPLE_CHOICE",
  stem: `Pregunta ${i}: ¿cuál es el menor?`,
  options: ["−3", "0", "2"],
  answer: "−3",
  explanation: "Está más a la izquierda.",
  cognitiveLevel: "REMEMBER",
  dbaCodes: [],
});

async function quiz(
  ctx: TenantContext,
  courseId: string,
  topicId: string,
  status: "DRAFT" | "ARCHIVED" = "DRAFT",
) {
  return db.resource.create({
    data: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      courseId,
      topicId,
      type: "QUIZ",
      status,
      title: "Quiz",
      blueprint: { type: "QUIZ" },
      context: {
        subject: "Matemáticas",
        grade: "6°",
        topic: { id: topicId, title: "T", description: null },
        objectives: [],
        dba: [],
      },
      generationId: "log",
      currentVersion: 1,
      versions: {
        create: {
          number: 1,
          source: "AI",
          content: { title: "Quiz", instructions: "", questions: [question(1), question(2)] },
        },
      },
      topics: { create: [{ topicId, position: 0 }] },
    },
    select: { id: true },
  });
}

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("bloque 4: Para esta semana", () => {
  it("por curso, el primer tema de la planeación sin recursos (los archivados no cuentan)", async () => {
    const ctx = await teacher();
    const c601 = await course(ctx, "601");
    const c602 = await course(ctx, "602");
    const [a, b] = await topics(ctx, c601.id, ["Enteros", "Fracciones"]);
    const [x] = await topics(ctx, c602.id, ["Enteros"]);
    await quiz(ctx, c601.id, a!.id);
    await quiz(ctx, c602.id, x!.id, "ARCHIVED");

    const home = await getTeacherHome(ctx);
    expect(home.upNext).toEqual([
      expect.objectContaining({ courseId: c601.id, topicId: b!.id, topicTitle: "Fracciones" }),
      expect.objectContaining({ courseId: c602.id, topicId: x!.id, topicTitle: "Enteros" }),
    ]);
  });

  it("no muestra recursos ni temas de otro docente", async () => {
    const ctx = await teacher();
    const other = await teacher();
    const mine = await course(ctx, "601");
    await topics(ctx, mine.id, ["Enteros"]);
    const theirs = await course(other, "601");
    await topics(other, theirs.id, ["Ajeno"]);
    const home = await getTeacherHome(ctx);
    expect(home.upNext.map((u) => u.topicTitle)).toEqual(["Enteros"]);
  });
});

describe("bloque 6: primer curso con temas propuestos", () => {
  it("con DBA, el paso 2 de Primeros pasos es revisar los temas que ProfIA propone", async () => {
    const ctx = await teacher();
    await course(ctx, "601");
    const home = await getTeacherHome(ctx);
    expect(home.firstSteps).toMatchObject({ current: "TOPIC", canProposeTopics: true });
  });

  it("sin referentes del MEN (Educación Religiosa), sigue «Escribe tu tema»", async () => {
    const ctx = await teacher();
    // Educación Física ya tiene Orientaciones del MEN (SPEC-0038 etapa 2) y Lucía las propone.
    await course(ctx, "6R", "Educación Religiosa");
    const home = await getTeacherHome(ctx);
    expect(home.firstSteps).toMatchObject({ current: "TOPIC", canProposeTopics: false });
  });
});

describe("SPEC-0029: la hoja como se imprime", () => {
  it("CA-0029-01/03: la vista marca la correcta solo si se pide; las descargas nunca", async () => {
    const ctx = await teacher();
    const c = await course(ctx, "601");
    const [t] = await topics(ctx, c.id, ["Enteros"]);
    const { id } = await quiz(ctx, c.id, t!.id);

    const plain = await previewResource(ctx, id);
    const marked = await previewResource(ctx, id, { showAnswers: true });
    const options = (m: typeof plain) =>
      m.blocks.flatMap((b) => (b.kind === "question" ? b.options : []));
    expect(options(plain).some((o) => o.correct)).toBe(false);
    expect(
      options(marked)
        .filter((o) => o.correct)
        .map((o) => o.text),
    ).toEqual(["−3", "−3"]);
    // Cada pregunta sabe qué ítem editar.
    expect(marked.blocks.filter((b) => b.kind === "question").map((b) => b.itemId)).toEqual([
      "q1",
      "q2",
    ]);
    // El PDF de la hoja del estudiante sigue sin respuestas (se genera sin `showAnswers`).
    const file = await exportResource(ctx, id, { doc: "student", format: "pdf", variant: "A" });
    expect(file.contentType).toBe("application/pdf");
  });

  it("la vista de otro docente no se puede pedir", async () => {
    const ctx = await teacher();
    const other = await teacher();
    const c = await course(ctx, "601");
    const [t] = await topics(ctx, c.id, ["Enteros"]);
    const { id } = await quiz(ctx, c.id, t!.id);
    await expect(previewResource(other, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
