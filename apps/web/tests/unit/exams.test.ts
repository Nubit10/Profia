import { describe, expect, it } from "vitest";
import type { ExportContext } from "@/modules/documents/build";
import {
  buildExam,
  conversionRows,
  examVariant,
  hasAnswerSheet,
  matchingColumn,
  matchingKey,
} from "@/modules/documents/build-exam";
import {
  blueprintSchema,
  distributePoints,
  examBlueprintPoints,
  examQuestionSchema,
  examTotalPoints,
  gradeFor,
  gradingScaleSchema,
  passingPointsFor,
  type ExamContent,
  type ExamQuestion,
} from "@/modules/resources/client";

// SPEC-0011: reglas del examen que no necesitan base de datos.

const q = (over: Partial<ExamQuestion> & Pick<ExamQuestion, "id" | "type">): ExamQuestion => ({
  stem: `Enunciado ${over.id}`,
  options: [],
  answer: "",
  explanation: "Porque sí.",
  pairs: [],
  distractors: [],
  criteria: [],
  points: 5,
  topicId: "t1",
  cognitiveLevel: "UNDERSTAND",
  dbaCodes: [],
  ...over,
});

const mc = (id: string) =>
  q({ id, type: "MULTIPLE_CHOICE", options: ["a1", "a2", "a3", "a4"], answer: "a1" });

const content: ExamContent = {
  title: "Examen: Números enteros",
  instructions: "Lee con atención.",
  durationMinutes: 60,
  targetPoints: 100,
  topics: [
    { id: "t1", title: "Recta" },
    { id: "t2", title: "Suma" },
  ],
  sections: [
    {
      id: "s1",
      questionType: "MULTIPLE_CHOICE",
      title: "Selección múltiple",
      instructions: "Marca una.",
      questions: Array.from({ length: 6 }, (_, i) => mc(`m${i}`)),
    },
    {
      id: "s2",
      questionType: "MATCHING",
      title: "Emparejamiento",
      instructions: "",
      questions: [
        q({
          id: "p1",
          type: "MATCHING",
          points: 20,
          pairs: [
            { left: "3", right: "−3" },
            { left: "−7", right: "7" },
            { left: "10", right: "−10" },
            { left: "−1", right: "1" },
          ],
          distractors: ["0"],
        }),
      ],
    },
    {
      id: "s3",
      questionType: "OPEN",
      title: "Pregunta abierta",
      instructions: "",
      questions: [
        q({
          id: "o1",
          type: "OPEN",
          points: 50,
          answer: "Una explicación completa.",
          criteria: [
            { description: "Ubica los números", points: 30 },
            { description: "Justifica", points: 20 },
          ],
        }),
      ],
    },
  ],
};

const ctx: ExportContext = {
  resourceId: "r1",
  version: 3,
  draft: false,
  header: [{ label: "Asignatura", value: "Matemáticas" }],
  dba: [],
  date: "10 de octubre de 2026",
};

const text = (model: ReturnType<typeof buildExam>) => JSON.stringify(model.blocks);
const scale = { passingGrade: 3, passingPoints: null };

describe("schema del examen (SPEC-0011)", () => {
  it("RN-04: emparejamiento entre 4 y 8 pares, sin repetidos en ninguna columna", () => {
    const matching = content.sections[1]!.questions[0]!;
    expect(examQuestionSchema.safeParse(matching).success).toBe(true);
    const three = { ...matching, pairs: matching.pairs.slice(0, 3) };
    expect(examQuestionSchema.safeParse(three).error?.issues[0]?.message).toContain("entre 4 y 8");
    const repeated = { ...matching, distractors: ["−3"] };
    expect(examQuestionSchema.safeParse(repeated).error?.issues[0]?.message).toContain("columna B");
  });

  it("CA-0011-05 / RN-05: los criterios de la abierta suman los puntos de la pregunta", () => {
    const open = content.sections[2]!.questions[0]!;
    expect(examQuestionSchema.safeParse(open).success).toBe(true);
    const off = { ...open, points: 45 };
    expect(examQuestionSchema.safeParse(off).error?.issues[0]?.message).toBe(
      "Los criterios suman 50 y la pregunta vale 45: ajusta la diferencia de -5",
    );
  });

  it("RN-06: puntos positivos con máximo un decimal; el total es la suma", () => {
    expect(examQuestionSchema.safeParse({ ...mc("x"), points: 2.25 }).success).toBe(false);
    expect(examQuestionSchema.safeParse({ ...mc("x"), points: 2.5 }).success).toBe(true);
    expect(examTotalPoints(content)).toBe(100);
  });

  it("RN-06: Profe reparte el total según el número de preguntas y su tipo", () => {
    const sections = distributePoints(
      [
        { questionType: "MULTIPLE_CHOICE" as const, questionCount: 10 },
        { questionType: "OPEN" as const, questionCount: 2 },
      ],
      100,
    );
    // 10 de peso 1 y 2 de peso 3: 100 / 16 = 6,25 → 6,3 por pregunta; 18,8 por abierta.
    expect(sections.map((s) => s.pointsPerQuestion)).toEqual([6.3, 18.8]);
    expect(examBlueprintPoints(sections)).toBe(100.6);
  });

  it("RN-02/03/09: tamaño del examen y más temas que preguntas", () => {
    const base = {
      type: "EXAM",
      scope: { kind: "TOPICS" },
      topicIds: ["a", "b"],
      objectiveIds: [],
      durationMinutes: 60,
      difficulty: "BASIC",
      totalPoints: 100,
      cognitiveDistribution: { REMEMBER: 100 },
      notes: null,
      sections: [
        { questionType: "MULTIPLE_CHOICE", questionCount: 8, pointsPerQuestion: 10 },
        { questionType: "TRUE_FALSE", questionCount: 2, pointsPerQuestion: 10 },
      ],
    };
    expect(blueprintSchema.safeParse(base).success).toBe(true);
    const small = { ...base, sections: base.sections.map((s) => ({ ...s, questionCount: 1 })) };
    expect(blueprintSchema.safeParse(small).error?.issues[0]?.message).toContain("entre 10 y 40");
    const matching = {
      ...base,
      sections: [
        ...base.sections,
        { questionType: "MATCHING", questionCount: 3, pointsPerQuestion: 5 },
      ],
    };
    expect(blueprintSchema.safeParse(matching).error?.issues[0]?.message).toContain("máximo 2");
    const topics = { ...base, topicIds: Array.from({ length: 11 }, (_, i) => `t${i}`) };
    expect(blueprintSchema.safeParse(topics).error?.issues[0]?.message).toContain(
      "cada tema necesita al menos una",
    );
    expect(
      blueprintSchema.safeParse({ ...base, sections: base.sections.slice(0, 1) }).success,
    ).toBe(false);
  });

  it("RN-14: conversión lineal a 1,0–5,0 y en dos tramos con puntaje de aprobación", () => {
    expect(gradeFor(0, 100, scale)).toBe(1);
    expect(gradeFor(50, 100, scale)).toBe(3);
    expect(gradeFor(100, 100, scale)).toBe(5);
    expect(passingPointsFor(100, scale)).toBe(50);
    const custom = { passingGrade: 3, passingPoints: 60 };
    expect(gradeFor(60, 100, custom)).toBe(3);
    expect(gradeFor(80, 100, custom)).toBe(4);
    expect(gradingScaleSchema.safeParse({ passingGrade: 5.5, passingPoints: null }).success).toBe(
      false,
    );
  });
});

describe("documentos del examen (SPEC-0011)", () => {
  it("CA-0011-07: la hoja del estudiante no trae respuestas, justificaciones ni criterios", () => {
    const sheet = text(buildExam(content, ctx, "student", "A", scale));
    expect(sheet).toContain("Sección 3. Pregunta abierta (50 puntos)");
    expect(sheet).not.toContain("Ubica los números");
    expect(sheet).not.toContain("Una explicación completa.");
    expect(sheet).not.toContain("Porque sí.");
    const model = buildExam(content, ctx, "student", "A", scale);
    expect(model.studentFields).toContain("Calificación");
  });

  it("CA-0011-08: la clave trae criterios, pares, puntos por sección y la conversión", () => {
    const key = text(buildExam(content, ctx, "key", "A", scale));
    expect(key).toContain("Ubica los números (30 puntos)");
    expect(key).toContain("Puntos por sección");
    expect(key).toContain("3,0 (nota mínima)");
    for (const pair of matchingKey(content.sections[1]!.questions[0]!, ctx, "A")) {
      expect(key).toContain(pair);
    }
  });

  it("CA-0011-09: la versión B baraja dentro de cada sección, sin mover preguntas entre secciones", () => {
    const a = examVariant(content, ctx, "A");
    const b = examVariant(content, ctx, "B");
    expect(b.map((s) => s.id)).toEqual(a.map((s) => s.id));
    expect(b.map((s) => s.questions.map((x) => x.id).sort())).toEqual(
      a.map((s) => s.questions.map((x) => x.id).sort()),
    );
    expect(b[0]!.questions.map((x) => x.id)).not.toEqual(a[0]!.questions.map((x) => x.id));
    expect(examVariant(content, ctx, "B")).toEqual(b);
    // La columna B del emparejamiento cambia entre versiones y su clave la sigue.
    const matching = content.sections[1]!.questions[0]!;
    const columnB = matchingColumn(matching, ctx, "B");
    expect(columnB).not.toEqual(matchingColumn(matching, ctx, "A"));
    const letter = matchingKey(matching, ctx, "B")[0]!.split("→ ")[1]!;
    expect(columnB["abcdefgh".indexOf(letter)]).toBe("−3");
  });

  it("CA-0011-15 / RN-15: la hoja de respuestas tiene casillas solo para selección múltiple y V/F", () => {
    expect(hasAnswerSheet(content)).toBe(true);
    const sheet = buildExam(content, ctx, "answers", "A", scale);
    const tables = sheet.blocks.filter((b) => b.kind === "table");
    expect(tables).toHaveLength(1);
    const table = tables[0]!;
    expect(table.kind === "table" && table.columns.map((c) => c.title)).toEqual([
      "N°",
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(table.kind === "table" && table.rows).toHaveLength(6);
    // Es la misma para todas las versiones.
    expect(buildExam(content, ctx, "answers", "D", scale).blocks).toEqual(sheet.blocks);
    expect(hasAnswerSheet({ sections: content.sections.slice(1) })).toBe(false);
  });

  it("RN-14: la tabla de conversión marca la fila de la nota mínima", () => {
    const { rows, passingRow } = conversionRows(100, { passingGrade: 3, passingPoints: 60 });
    expect(rows[passingRow]).toEqual(["60", "3,0 (nota mínima)"]);
    expect(rows.at(-1)).toEqual(["100", "5,0"]);
  });
});
