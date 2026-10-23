import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildQuiz,
  buildWorkshop,
  quizVariant,
  type ExportContext,
} from "@/modules/documents/build";
import type { DocModel } from "@/modules/documents/model";
import { renderDocx } from "@/modules/documents/render-docx";
import { renderPdf, toPdfDefinition } from "@/modules/documents/render-pdf";
import { safeFilename } from "@/modules/documents/filename";
import { seededShuffle } from "@/modules/documents/shuffle";
import type { QuizContent, WorkshopContent } from "@/modules/resources/client";

const ctx: ExportContext = {
  resourceId: "res-1",
  version: 3,
  draft: false,
  header: [
    { label: "Institución", value: "I. E. San José" },
    { label: "Docente", value: "Ana Pérez" },
    { label: "Asignatura", value: "Matemáticas" },
    { label: "Grado y grupo", value: "6° 601" },
  ],
  dba: [{ code: "DBA-1", number: 1, statement: "Interpreta los números enteros." }],
  date: "1 de octubre de 2026",
};

const quiz: QuizContent = {
  title: "Quiz de enteros",
  instructions: "Responde cada pregunta.",
  questions: [
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `q${i + 1}`,
      type: "MULTIPLE_CHOICE" as const,
      stem: `Pregunta ${i + 1}: ¿cuál es el menor?`,
      options: ["−3", "0", "2", "5"],
      answer: "−3",
      explanation: `Justificación ${i + 1}`,
      cognitiveLevel: "REMEMBER" as const,
      dbaCodes: ["DBA-1"],
    })),
    {
      id: "q6",
      type: "TRUE_FALSE",
      stem: "El −5 es mayor que el −2.",
      options: ["Verdadero", "Falso"],
      answer: "Falso",
      explanation: "−5 está más a la izquierda.",
      cognitiveLevel: "UNDERSTAND",
      dbaCodes: [],
    },
    {
      id: "q7",
      type: "SHORT_ANSWER",
      stem: "Escribe un número menor que −4.",
      options: [],
      answer: "−5",
      explanation: "Cualquier entero menor que −4.",
      cognitiveLevel: "APPLY",
      dbaCodes: [],
    },
  ],
};

const workshop: WorkshopContent = {
  title: "Taller de la recta",
  purpose: "Comparar números enteros.",
  studentInstructions: "Trabaja en parejas.",
  materials: ["Cuaderno"],
  moments: [
    {
      name: "Inicio",
      activities: [
        {
          id: "a1",
          title: "Termómetro",
          instructions: "Observa el termómetro y responde.",
          durationMinutes: 10,
          expectedOutcome: "Lectura de temperaturas bajo cero",
          cognitiveLevel: "UNDERSTAND",
          dbaCodes: ["DBA-1"],
        },
      ],
    },
    { name: "Desarrollo", activities: [] },
  ],
  teacherGuidance: ["Revisa que ubiquen el cero."],
  sectionTexts: [],
};

const text = (doc: DocModel) => JSON.stringify(doc);

describe("versiones del quiz (SPEC-0009 RN-07)", () => {
  it("CA-0009-10: la B tiene las mismas preguntas en otro orden y es siempre igual", () => {
    const a = quizVariant(quiz, ctx, "A");
    const b = quizVariant(quiz, ctx, "B");
    expect(a.map((q) => q.id)).toEqual(quiz.questions.map((q) => q.id));
    expect(b.map((q) => q.id).sort()).toEqual(a.map((q) => q.id).sort());
    expect(b.map((q) => q.id)).not.toEqual(a.map((q) => q.id));
    expect(quizVariant(quiz, ctx, "B")).toEqual(b);
    expect(quizVariant(quiz, ctx, "C").map((q) => q.id)).not.toEqual(b.map((q) => q.id));
    // Las opciones de selección múltiple también cambian; verdadero/falso no.
    const mc = b.filter((q) => q.type === "MULTIPLE_CHOICE");
    expect(mc.some((q) => q.options.join() !== "−3,0,2,5")).toBe(true);
    expect(b.find((q) => q.id === "q6")!.options).toEqual(["Verdadero", "Falso"]);
    // Otra versión del contenido (RN-01: semilla con la versión) baraja distinto.
    expect(quizVariant(quiz, { ...ctx, version: 4 }, "B")).not.toEqual(b);
  });

  it("una versión distinta nunca queda igual a la original", () => {
    expect(seededShuffle([1, 2], "x")).not.toEqual([1, 2]);
    expect(seededShuffle([1], "x")).toEqual([1]);
  });

  it("CA-0009-11: la clave de la versión B usa las letras de la hoja B", () => {
    const sheet = buildQuiz(quiz, ctx, "student", "B");
    const key = buildQuiz(quiz, ctx, "key", "B");
    const table = key.blocks[0]!;
    if (table.kind !== "keyTable") throw new Error("esperaba la tabla de la clave");
    sheet.blocks
      .filter((b) => b.kind === "question")
      .forEach((q, i) => {
        if (q.kind !== "question") return;
        const row = table.rows[i]!;
        if (q.options.length && q.options[0]!.label.endsWith(")")) {
          const correct = q.options.find((o) => o.text === "−3")!;
          expect(row.answer).toBe(`${correct.label} −3`);
        }
      });
    expect(sheet.header).toContainEqual({ label: "Versión", value: "B" });
    expect(sheet.subtitle).toBe("Hoja del estudiante · Versión B");
  });
});

describe("qué va en cada documento (RN-02)", () => {
  it("CA-0009-01: la hoja del estudiante no trae respuestas ni justificaciones", () => {
    const sheet = buildQuiz(quiz, ctx, "student", "A");
    expect(text(sheet)).not.toContain("Justificación");
    expect(text(sheet)).not.toContain('"correct"');
    expect(sheet.studentFields).toEqual(["Nombre", "Curso", "Fecha"]);
    const questions = sheet.blocks.filter((b) => b.kind === "question");
    expect(questions).toHaveLength(7);
    expect(questions.at(-1)).toMatchObject({ answerLines: 3 }); // respuesta corta
    expect(questions.at(-2)).toMatchObject({ inline: true }); // verdadero/falso
  });

  it("CA-0009-02: la clave trae cada respuesta y su justificación", () => {
    const key = buildQuiz(quiz, ctx, "key", "A");
    expect(key.studentFields).toEqual([]);
    expect(key.blocks[0]).toMatchObject({
      kind: "keyTable",
      rows: expect.arrayContaining([
        { number: "1", answer: "a) −3", explanation: "Justificación 1" },
        { number: "6", answer: "Falso", explanation: "−5 está más a la izquierda." },
        { number: "7", answer: "−5", explanation: "Cualquier entero menor que −4." },
      ]),
    });
  });

  it("CA-0009-03: la guía del estudiante no trae orientaciones ni productos esperados; la del docente sí", () => {
    const student = buildWorkshop(workshop, ctx, "student");
    const teacher = buildWorkshop(workshop, ctx, "key");
    expect(text(student)).not.toContain("Revisa que ubiquen el cero");
    expect(text(student)).not.toContain("Lectura de temperaturas");
    expect(text(teacher)).toContain("Revisa que ubiquen el cero");
    expect(text(teacher)).toContain("Producto esperado: Lectura de temperaturas bajo cero");
    expect(text(teacher)).toContain("DBA 1: Interpreta los números enteros.");
    // Un momento sin actividades no se imprime.
    expect(text(student)).not.toContain("Desarrollo");
  });

  it("CA-0009-05: el borrador lleva la marca; el listo no", () => {
    expect(
      toPdfDefinition(buildQuiz(quiz, { ...ctx, draft: true }, "student", "A")),
    ).toHaveProperty("watermark");
    expect(toPdfDefinition(buildQuiz(quiz, ctx, "student", "A"))).not.toHaveProperty("watermark");
  });
});

describe("renderizadores (ADR-0009)", () => {
  it("CA-0009-08: el PDF es carta y se genera con la fuente embebida", async () => {
    const pdf = await renderPdf(buildQuiz(quiz, { ...ctx, draft: true }, "student", "B"));
    const raw = pdf.toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw).toMatch(/\/MediaBox \[0 0 612 792\]/);
    expect(raw).toMatch(/Roboto/);
  });

  it("CA-0009-09: el DOCX tiene texto real, carta y márgenes de 2 cm", async () => {
    const docx = await renderDocx(buildWorkshop(workshop, { ...ctx, draft: true }, "key"));
    const xml = await (await JSZip.loadAsync(docx)).file("word/document.xml")!.async("string");
    expect(xml).toContain("Observa el termómetro y responde.");
    expect(xml).toContain("BORRADOR");
    expect(xml).toContain("Ana Pérez");
    expect(xml).toMatch(/w:w="12240"/);
    expect(xml).toMatch(/w:h="15840"/);
    expect(xml).toMatch(/w:top="1134"/);
  });
});

describe("safeFilename (RN-06)", () => {
  it("quita caracteres que rompen Windows y conserva tildes", () => {
    expect(safeFilename(["Clave", "Quiz", 'Fracciones: ¿qué son? 1/2 "x"', "6°601"], "pdf")).toBe(
      "Clave - Quiz - Fracciones- ¿qué son- 1-2 -x- - 6°601.pdf",
    );
  });
});
