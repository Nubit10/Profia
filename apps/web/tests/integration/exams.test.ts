import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import { exportResource } from "@/modules/documents";
import { createIndependentSpace } from "@/modules/institutions";
import {
  createObjective,
  createTopic,
  createUnit,
  getCoursePlanning,
  setItemArchived,
} from "@/modules/planning";
import {
  DAILY_LIMIT,
  createResource,
  decideRegeneration,
  duplicateResource,
  getExamFormContext,
  getQuotaStatus,
  getResource,
  promptQualityMetrics,
  rateItem,
  regenerateItem,
  saveResourceContent,
  setGradingScale,
  type GenerationDeps,
} from "@/modules/resources";
import {
  blueprintSchema,
  examTotalPoints,
  type Blueprint,
  type ExamContent,
} from "@/modules/resources/client";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0011: exámenes con IA. El AI Engine se simula a partir de la petición que recibe.

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const DBA1 = "MEN-DBA-MAT-V2-G6-01";

type EngineSection = {
  questionType: string;
  questionCount: number;
  pointsPerQuestion: number;
};
type EngineBody = {
  topics: { key: string; title: string }[];
  dba: { code: string }[];
  sections: EngineSection[];
};

/** Pregunta válida del tipo pedido, para el tema `topic`. */
function engineQuestion(type: string, i: number, topic: string, points: number, dba: string[]) {
  const base = {
    type,
    stem: `Pregunta ${i}: ¿qué sabes del tema ${topic}?`,
    options: [] as string[],
    answer: "",
    explanation: "Es lo que se estudió en clase.",
    pairs: [] as { left: string; right: string }[],
    distractors: [] as string[],
    criteria: [] as { description: string; points: number }[],
    topic,
    cognitiveLevel: "UNDERSTAND",
    // Un código inventado: la web también lo filtra (defensa en profundidad, RN-07).
    dbaCodes: [...dba.slice(0, 1), "MEN-DBA-INVENTADO"],
  };
  if (type === "MULTIPLE_CHOICE") {
    return { ...base, options: ["−3", "0", "2", "5"], answer: "−3" };
  }
  if (type === "TRUE_FALSE") return { ...base, options: ["Verdadero", "Falso"], answer: "Falso" };
  if (type === "SHORT_ANSWER") return { ...base, answer: "El cero" };
  if (type === "MATCHING") {
    return {
      ...base,
      stem: `Bloque ${i}: relaciona cada número con su opuesto.`,
      pairs: [
        { left: "3", right: "−3" },
        { left: "−7", right: "7" },
        { left: "10", right: "−10" },
        { left: "−1", right: "1" },
      ],
      distractors: ["0"],
    };
  }
  return {
    ...base,
    answer: "Ubica ambos números y compara su posición.",
    criteria: [
      { description: "Ubica los números en la recta", points: points / 2 },
      { description: "Justifica la comparación", points: points / 2 },
    ],
  };
}

/** AI Engine simulado: arma el examen según las secciones y temas que recibe. */
function examResponse(body: EngineBody) {
  let n = 0;
  const sections = body.sections.map((s) => ({
    questionType: s.questionType,
    pointsPerQuestion: s.pointsPerQuestion,
    questions: Array.from({ length: s.questionCount }, () => {
      const topic = body.topics[n % body.topics.length]!.key;
      n += 1;
      return engineQuestion(
        s.questionType,
        n,
        topic,
        s.pointsPerQuestion,
        body.dba.map((d) => d.code),
      );
    }),
  }));
  const calls = sections.map((_, i) => ({
    section: i + 1,
    provider: "groq",
    model: "qwen/qwen3.8-27b",
    attempts: 1,
    latencyMs: 1000,
    tokens: 2500,
  }));
  return {
    exam: { sections },
    meta: {
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      promptVersion: "exam.v1",
      attempts: calls.length,
      latencyMs: 1000 * calls.length,
      tokens: 2500 * calls.length,
      calls,
    },
  };
}

function engine() {
  return vi.fn(async (url: URL | string, init?: RequestInit) => {
    const route = new URL(String(url)).pathname;
    const body = JSON.parse(String(init?.body));
    if (route === "/v1/generation/exam") return Response.json(examResponse(body));
    if (route === "/v1/generation/exam/item") {
      const current = body.current;
      const item = engineQuestion(current.type, 99, current.topic, body.points, [DBA1]);
      return Response.json({
        item: { ...item, stem: `Versión revisada (${body.instruction}): ${current.stem}` },
        meta: {
          provider: "groq",
          model: "qwen/qwen3.8-27b",
          promptVersion: "exam_item.v1",
          attempts: 1,
          latencyMs: 800,
          tokens: 600,
        },
      });
    }
    throw new Error(`ruta inesperada ${route}`);
  });
}

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

const bodyOf = (fetcher: ReturnType<typeof engine>, i = 0) =>
  JSON.parse(String((fetcher.mock.calls[i] as unknown as [URL, RequestInit])[1].body));

/** Docente con un curso de 6°, una unidad con 3 temas y otro curso aparte. */
async function teacherWithUnit(name = "Profe") {
  const user = await createUser(name);
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
  const subjects = await listSubjects(ctx);
  const math = subjects.find((s) => s.name === "Matemáticas")!;
  const course = await createCourse(ctx, {
    subjectId: math.id,
    grade: "G6",
    groupName: "601",
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, course.id);
  const unit = await createUnit(ctx, {
    courseId: course.id,
    periodNumber: 2,
    title: "Números enteros",
    description: null,
  });
  const topics = [];
  for (const title of ["La recta numérica", "Suma de enteros", "Resta de enteros"]) {
    topics.push(
      await createTopic(ctx, { unitId: unit.id, title, description: null, plannedSessions: 2 }),
    );
  }
  const objective = await createObjective(ctx, {
    topicId: topics[0]!.id,
    statement: "Compara números enteros usando la recta numérica.",
    links: [{ code: DBA1, evidenceIndexes: [] }],
  });
  const other = await createCourse(ctx, {
    subjectId: math.id,
    grade: "G7",
    groupName: "701",
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, other.id);
  const otherUnit = await createUnit(ctx, {
    courseId: other.id,
    periodNumber: 1,
    title: "Racionales",
    description: null,
  });
  const otherTopic = await createTopic(ctx, {
    unitId: otherUnit.id,
    title: "Fracciones",
    description: null,
    plannedSessions: 2,
  });
  return { user, ctx, course, unit, topics, objective, otherTopic };
}

const examBlueprint = (topicIds: string[], unitId?: string): Blueprint =>
  blueprintSchema.parse({
    type: "EXAM",
    scope: unitId ? { kind: "UNIT", unitId } : { kind: "TOPICS" },
    topicIds,
    objectiveIds: [],
    durationMinutes: 90,
    difficulty: "INTERMEDIATE",
    sections: [
      { questionType: "MULTIPLE_CHOICE", questionCount: 6, pointsPerQuestion: 5 },
      { questionType: "MATCHING", questionCount: 1, pointsPerQuestion: 20 },
      { questionType: "TRUE_FALSE", questionCount: 4, pointsPerQuestion: 2.5 },
      { questionType: "OPEN", questionCount: 2, pointsPerQuestion: 20 },
    ],
    totalPoints: 100,
    cognitiveDistribution: { UNDERSTAND: 100 },
    notes: "Sin calculadora. Dudas a ana@colegio.edu.co",
    excludedPreferenceIds: [],
  });

async function generatedExam() {
  const teacher = await teacherWithUnit();
  const fetcher = engine();
  const run = deps(fetcher as unknown as typeof fetch);
  const { id } = await createResource(
    teacher.ctx,
    examBlueprint(
      teacher.topics.map((t) => t.id),
      teacher.unit.id,
    ),
    run,
  );
  await run.done();
  return { ...teacher, id, fetcher };
}

async function docxText(body: Buffer) {
  const zip = await JSZip.loadAsync(body);
  const parts = Object.keys(zip.files).filter((f) => /^word\/(document|footer\d*)\.xml$/.test(f));
  const xml = (await Promise.all(parts.map((f) => zip.file(f)!.async("string")))).join("\n");
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("exámenes con IA (SPEC-0011)", () => {
  it("CA-0011-01: la unidad trae sus 3 temas; se puede quitar uno, y un tema de otro curso se rechaza", async () => {
    const { ctx, topics, otherTopic } = await teacherWithUnit();
    const form = await getExamFormContext(
      ctx,
      topics.map((t) => t.id),
    );
    expect(form.topics.map((t) => t.title)).toEqual([
      "La recta numérica",
      "Suma de enteros",
      "Resta de enteros",
    ]);
    expect(form.topics[0]).toMatchObject({ unitTitle: "Números enteros" });
    expect(form.quota.cost).toBe(2);

    // Quitar un tema: sigue siendo válido.
    expect((await getExamFormContext(ctx, [topics[0]!.id, topics[2]!.id])).topics).toHaveLength(2);

    // Un tema de otro curso (aunque sea del mismo docente) no entra.
    const fetcher = engine();
    await expect(
      createResource(
        ctx,
        examBlueprint([topics[0]!.id, otherTopic.id]),
        deps(fetcher as unknown as typeof fetch),
      ),
    ).rejects.toMatchObject({ code: "INVALID", message: expect.stringContaining("mismo curso") });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("CA-0011-02/10: el examen queda en borrador con sus secciones, todos los temas y solo DBA del contexto", async () => {
    const { ctx, id, topics, fetcher } = await generatedExam();
    const resource = await getResource(ctx, id);
    expect(resource).toMatchObject({
      type: "EXAM",
      status: "DRAFT",
      version: 1,
      title: "Examen: Números enteros",
      promptVersion: "exam.v1",
    });
    const content = resource.data!.content as ExamContent;
    expect(content.sections.map((s) => s.questionType)).toEqual([
      "MULTIPLE_CHOICE",
      "MATCHING",
      "TRUE_FALSE",
      "OPEN",
    ]);
    expect(content.sections.map((s) => s.questions.length)).toEqual([6, 1, 4, 2]);
    const questions = content.sections.flatMap((s) => s.questions);
    expect(new Set(questions.map((q) => q.topicId))).toEqual(new Set(topics.map((t) => t.id)));
    expect(questions.every((q) => q.dbaCodes.every((c) => c !== "MEN-DBA-INVENTADO"))).toBe(true);
    expect(examTotalPoints(content)).toBe(100);
    expect(resource.gradingScale).toEqual({ passingGrade: 3, passingPoints: null });

    // RN-10: una fila de generation_logs por sección.
    const logs = await db.generationLog.findMany({ where: { entityId: id } });
    expect(logs).toHaveLength(4);
    expect(logs.every((l) => l.task === "exam" && l.status === "OK")).toBe(true);

    // T2: el examen queda relacionado con sus 3 temas.
    const links = await db.resourceTopic.findMany({ where: { resourceId: id } });
    expect(links.map((l) => l.topicId).sort()).toEqual(topics.map((t) => t.id).sort());

    // CA-0011-10: solo contexto pedagógico; los temas viajan con su clave, no con su id.
    const body = bodyOf(fetcher);
    expect(body.topics.map((t: { key: string }) => t.key)).toEqual(["T1", "T2", "T3"]);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("ana@colegio.edu.co");
    expect(raw).not.toContain("Profe");
    for (const t of topics) expect(raw).not.toContain(t.id);
    expect(Object.keys(body).sort()).toEqual(
      [
        "cognitiveDistribution",
        "dba",
        "difficulty",
        "durationMinutes",
        "grade",
        "notes",
        "objectives",
        "preferences",
        "sections",
        "subject",
        "topics",
      ].sort(),
    );
  });

  it("CA-0011-04/05: cambiar puntos crea versión nueva y recalcula; criterios que no suman no se guardan", async () => {
    const { ctx, id } = await generatedExam();
    const original = (await getResource(ctx, id)).data!.content as ExamContent;
    const edited = structuredClone(original);
    edited.sections[0]!.questions[0]!.points = 10;
    const { version } = await saveResourceContent(ctx, id, 1, edited);
    expect(version).toBe(2);
    const saved = (await getResource(ctx, id)).data!.content as ExamContent;
    expect(examTotalPoints(saved)).toBe(105);
    const v1 = await db.resourceVersion.findFirstOrThrow({ where: { resourceId: id, number: 1 } });
    expect(examTotalPoints(v1.content as unknown as ExamContent)).toBe(100);

    // CA-0011-05: la abierta vale 20 y sus criterios suman 13.
    const bad = structuredClone(saved);
    bad.sections[3]!.questions[0]!.criteria[0]!.points = 3;
    await expect(saveResourceContent(ctx, id, 2, bad)).rejects.toMatchObject({
      code: "INVALID",
      message: expect.stringContaining("Los criterios suman 13"),
    });

    // Emparejamiento con menos de 4 pares tras editar (§7).
    const short = structuredClone(saved);
    short.sections[1]!.questions[0]!.pairs.pop();
    await expect(saveResourceContent(ctx, id, 2, short)).rejects.toMatchObject({
      code: "INVALID",
    });

    // Los temas del examen no se cambian al editar (RN-02).
    const tampered = structuredClone(saved);
    tampered.topics = [{ id: "otro", title: "Otro" }];
    await saveResourceContent(ctx, id, 2, tampered);
    const after = (await getResource(ctx, id)).data!.content as ExamContent;
    expect(after.topics).toEqual(original.topics);
  });

  it("CA-0011-06: regenerar un emparejamiento o una abierta propone el mismo tipo", async () => {
    const { ctx, id, fetcher } = await generatedExam();
    const content = (await getResource(ctx, id)).data!.content as ExamContent;
    const matching = content.sections[1]!.questions[0]!;
    const open = content.sections[3]!.questions[0]!;

    const proposal = await regenerateItem(
      ctx,
      id,
      open.id,
      "Que pida un ejemplo de la vida diaria",
      fetcher as unknown as typeof fetch,
    );
    expect(proposal.status).toBe("ok");
    if (proposal.status !== "ok") return;
    expect(proposal.proposal.item).toMatchObject({ type: "OPEN", points: 20, id: open.id });
    const sent = bodyOf(fetcher, fetcher.mock.calls.length - 1);
    expect(sent).toMatchObject({ points: 20, current: { type: "OPEN" } });

    const { version } = await decideRegeneration(ctx, proposal.proposal.regenerationId, true);
    expect(version).toBe(2);

    const again = await regenerateItem(
      ctx,
      id,
      matching.id,
      "Usa números más grandes",
      fetcher as unknown as typeof fetch,
    );
    expect(again.status === "ok" && again.proposal.item).toMatchObject({ type: "MATCHING" });
    await rateItem(ctx, id, matching.id, "UP", null);
  });

  it("CA-0011-07/08/15/16: hoja sin respuestas, clave con criterios y conversión, hoja de respuestas", async () => {
    const { ctx, id } = await generatedExam();
    const content = (await getResource(ctx, id)).data!.content as ExamContent;
    const open = content.sections[3]!.questions[0]!;

    const student = await exportResource(ctx, id, {
      doc: "student",
      format: "docx",
      variant: "A",
    });
    const sheet = await docxText(student.body);
    expect(sheet).toContain("Examen: Números enteros");
    expect(sheet).toContain("Temas");
    expect(sheet).toContain("La recta numérica, Suma de enteros, Resta de enteros");
    expect(sheet).toContain("90 minutos");
    expect(sheet).toContain("100 puntos");
    expect(sheet).toContain("Calificación");
    expect(sheet).toContain("Sección 4. Pregunta abierta (40 puntos)");
    expect(sheet).toContain("(5 puntos)");
    expect(sheet).not.toContain(open.criteria[0]!.description);
    expect(sheet).not.toContain(open.answer);
    expect(sheet).not.toContain("Es lo que se estudió en clase.");

    const key = await docxText(
      (await exportResource(ctx, id, { doc: "key", format: "docx", variant: "A" })).body,
    );
    expect(key).toContain(open.criteria[0]!.description);
    expect(key).toContain("Puntos por sección");
    expect(key).toContain("Conversión a nota");
    expect(key).toContain("3,0 (nota mínima)");
    expect(key).toMatch(/1 → [a-e]/);

    const answers = await exportResource(ctx, id, {
      doc: "answers",
      format: "docx",
      variant: "C",
    });
    expect(answers.filename).toBe("Hoja de respuestas - Examen - Números enteros - 6°601.docx");
    const answersText = await docxText(answers.body);
    expect(answersText).toContain("Hoja de respuestas");
    expect(answersText).toContain("Sección 1. Selección múltiple");
    expect(answersText).toContain("Sección 3. Verdadero o falso");
    expect(answersText).not.toContain("Sección 4");

    // CA-0011-16: cambiar la nota mínima se refleja en la siguiente clave y no crea versión.
    await setGradingScale(ctx, id, { passingGrade: 3.5, passingPoints: 60 });
    const rescaled = await docxText(
      (await exportResource(ctx, id, { doc: "key", format: "docx", variant: "A" })).body,
    );
    expect(rescaled).toContain("3,5 (nota mínima)");
    expect((await getResource(ctx, id)).version).toBe(1);
    await expect(
      setGradingScale(ctx, id, { passingGrade: 3, passingPoints: 100 }),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("CA-0011-15: sin selección múltiple ni V/F no hay hoja de respuestas", async () => {
    const teacher = await teacherWithUnit();
    const run = deps(engine() as unknown as typeof fetch);
    const blueprint = blueprintSchema.parse({
      ...examBlueprint(teacher.topics.map((t) => t.id)),
      sections: [
        { questionType: "SHORT_ANSWER", questionCount: 8, pointsPerQuestion: 5 },
        { questionType: "OPEN", questionCount: 2, pointsPerQuestion: 30 },
      ],
    });
    const { id } = await createResource(teacher.ctx, blueprint, run);
    await run.done();
    await expect(
      exportResource(teacher.ctx, id, { doc: "answers", format: "pdf", variant: "A" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("CA-0011-09: la versión B baraja dentro de cada sección y se repite igual al volver a descargar", async () => {
    const { ctx, id } = await generatedExam();
    const sheetA = await docxText(
      (await exportResource(ctx, id, { doc: "student", format: "docx", variant: "A" })).body,
    );
    const sheetB = await docxText(
      (await exportResource(ctx, id, { doc: "student", format: "docx", variant: "B" })).body,
    );
    const again = await docxText(
      (await exportResource(ctx, id, { doc: "student", format: "docx", variant: "B" })).body,
    );
    expect(sheetB).not.toBe(sheetA);
    expect(again).toBe(sheetB);
    // Las secciones conservan su orden.
    const order = (text: string) =>
      [1, 2, 3, 4]
        .map((n) => text.indexOf(`Sección ${n}.`))
        .every((v, i, a) => !i || v > a[i - 1]!);
    expect(order(sheetB)).toBe(true);
    const keyB = await exportResource(ctx, id, { doc: "key", format: "pdf", variant: "B" });
    expect(keyB.filename).toBe("Clave - Examen - Números enteros - 6°601 - Versión B.pdf");
  });

  it("CA-0011-11: con 1 recurso de cupo, el examen (cuesta 2) se rechaza sin llamar a la IA", async () => {
    const { ctx, course, topics } = await teacherWithUnit();
    for (let i = 0; i < DAILY_LIMIT - 1; i++) {
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
    const fetcher = engine();
    await expect(
      createResource(
        ctx,
        examBlueprint(topics.map((t) => t.id)),
        deps(fetcher as unknown as typeof fetch),
      ),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: expect.stringMatching(/Un examen usa 2 .* te queda 1\. Podrás generarlo desde las/),
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("CA-0011-11: un examen generado cuenta 2 en el cupo del día", async () => {
    const { ctx } = await generatedExam();
    expect(await getQuotaStatus(ctx)).toMatchObject({ used: 2, limit: DAILY_LIMIT });
  });

  it("§6: las métricas por versión de prompt cuentan el examen una vez y suman sus secciones", async () => {
    await generatedExam();
    const exam = (await promptQualityMetrics()).find((m) => m.promptVersion === "exam.v1");
    expect(exam).toMatchObject({ resources: 1, averageTokens: 4 * 2500 });
  });

  it("CA-0011-12: examen, contenido, evaluación y descarga de otro docente responden NOT_FOUND", async () => {
    const owner = await generatedExam();
    const stranger = await teacherWithUnit("Otra profe");
    const notFound = { code: "NOT_FOUND" };
    await expect(getResource(stranger.ctx, owner.id)).rejects.toMatchObject(notFound);
    await expect(saveResourceContent(stranger.ctx, owner.id, 1, {})).rejects.toMatchObject(
      notFound,
    );
    await expect(
      exportResource(stranger.ctx, owner.id, { doc: "key", format: "pdf", variant: "A" }),
    ).rejects.toMatchObject(notFound);
    await expect(rateItem(stranger.ctx, owner.id, "q-1", "UP", null)).rejects.toMatchObject(
      notFound,
    );
    await expect(
      setGradingScale(stranger.ctx, owner.id, { passingGrade: 3, passingPoints: null }),
    ).rejects.toMatchObject(notFound);
    // Meter en el blueprint un tema de otra institución tampoco sirve.
    await expect(
      createResource(
        stranger.ctx,
        examBlueprint([stranger.topics[0]!.id, owner.topics[1]!.id]),
        deps(engine() as unknown as typeof fetch),
      ),
    ).rejects.toMatchObject(notFound);
    await expect(
      getExamFormContext(
        stranger.ctx,
        owner.topics.map((t) => t.id),
      ),
    ).rejects.toMatchObject(notFound);
  });

  it("CA-0011-13: archivar un tema después de generar no cambia el examen ni sus descargas", async () => {
    const { ctx, id, topics } = await generatedExam();
    const before = await docxText(
      (await exportResource(ctx, id, { doc: "student", format: "docx", variant: "A" })).body,
    );
    await setItemArchived(ctx, "topic", topics[1]!.id, true);
    const resource = await getResource(ctx, id);
    expect(resource.context.topics?.map((t) => t.title)).toContain("Suma de enteros");
    const after = await docxText(
      (await exportResource(ctx, id, { doc: "student", format: "docx", variant: "A" })).body,
    );
    // Solo cambia la fecha del pie si cambió el día; el contenido es el mismo.
    expect(after.replace(/· [^·]*$/, "")).toBe(before.replace(/· [^·]*$/, ""));

    // Un tema archivado ya no entra en un examen nuevo.
    await expect(
      createResource(
        ctx,
        examBlueprint(topics.map((t) => t.id)),
        deps(engine() as unknown as typeof fetch),
      ),
    ).rejects.toMatchObject({ code: "INVALID", message: expect.stringContaining("archivado") });
  });

  it("ADR-0008 (nota): un examen generándose se da por interrumpido a los 6 minutos, no a los 5", async () => {
    const { ctx, id } = await generatedExam();
    await db.resource.update({ where: { id }, data: { status: "GENERATING" } });
    await db.$executeRaw`UPDATE resources SET "updatedAt" = now() - interval '5 minutes 30 seconds' WHERE id = ${id}`;
    expect((await getResource(ctx, id)).status).toBe("GENERATING");
    await db.$executeRaw`UPDATE resources SET "updatedAt" = now() - interval '7 minutes' WHERE id = ${id}`;
    expect(await getResource(ctx, id)).toMatchObject({
      status: "FAILED",
      failureReason: "interrupted",
    });
  });

  it("duplicar un examen copia sus temas y su escala", async () => {
    const { ctx, id, topics } = await generatedExam();
    await setGradingScale(ctx, id, { passingGrade: 3.2, passingPoints: null });
    const copy = await duplicateResource(ctx, id);
    const links = await db.resourceTopic.findMany({ where: { resourceId: copy.id } });
    expect(links).toHaveLength(topics.length);
    expect((await getResource(ctx, copy.id)).gradingScale).toMatchObject({ passingGrade: 3.2 });
  });
});
