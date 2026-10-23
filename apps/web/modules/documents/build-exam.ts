import {
  examTotalPoints,
  gradeFor,
  passingPointsFor,
  type ExamContent,
  type ExamQuestion,
  type ExamSection,
  type GradingScale,
} from "@/modules/resources/client";
import type { DocBlock, DocModel } from "./model";
import { seededShuffle, type Variant } from "./shuffle";
import type { DocKind, ExportContext } from "./build";

// Constructor del examen (SPEC-0011 §2). Hoja del estudiante sin respuestas ni criterios (RN-02 de
// SPEC-0009), clave con puntos y tabla de conversión a nota (RN-14), hoja de respuestas (RN-15) y
// versiones A–D que barajan dentro de cada sección sin mover preguntas entre secciones (RN-13).

const LETTERS = "abcdefghijklmnop";
const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const grade = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const formatPoints = (n: number) => `${number.format(n)} ${n === 1 ? "punto" : "puntos"}`;

const sectionPoints = (s: ExamSection) =>
  Math.round(s.questions.reduce((sum, q) => sum + q.points, 0) * 10) / 10;

const footer = (ctx: ExportContext, variant: Variant) =>
  `Profe · Versión ${ctx.version} del examen${variant !== "A" ? ` · Versión ${variant}` : ""} · ${ctx.date}`;

const seedOf = (ctx: ExportContext, variant: Variant) =>
  `${ctx.resourceId}:${ctx.version}:${variant}`;

/**
 * RN-13: las secciones conservan su orden. En B–D cambian el orden de las preguntas dentro de cada
 * sección y el de las opciones de selección múltiple. Verdadero/falso conserva sus opciones.
 */
export function examVariant(
  content: ExamContent,
  ctx: ExportContext,
  variant: Variant,
): ExamSection[] {
  if (variant === "A") return content.sections;
  const seed = seedOf(ctx, variant);
  return content.sections.map((s) => ({
    ...s,
    questions: seededShuffle(s.questions, `${seed}:${s.id}`).map((q) =>
      q.type === "MULTIPLE_CHOICE"
        ? { ...q, options: seededShuffle(q.options, `${seed}:${q.id}`) }
        : q,
    ),
  }));
}

/**
 * Columna B del emparejamiento: respuestas y distractores barajados. También en la versión A, si
 * no la columna B quedaría alineada con la A y mostraría las respuestas.
 */
export function matchingColumn(q: ExamQuestion, ctx: ExportContext, variant: Variant): string[] {
  return seededShuffle(
    [...q.pairs.map((p) => p.right), ...q.distractors],
    `${seedOf(ctx, variant)}:${q.id}:b`,
  );
}

/** Pareja correcta de cada elemento de la columna A, como "1 → c". */
export function matchingKey(q: ExamQuestion, ctx: ExportContext, variant: Variant): string[] {
  const column = matchingColumn(q, ctx, variant);
  return q.pairs.map((p, i) => `${i + 1} → ${LETTERS[column.indexOf(p.right)]}`);
}

function studentQuestion(q: ExamQuestion, n: number, ctx: ExportContext, variant: Variant) {
  const stem = `${q.stem} (${formatPoints(q.points)})`;
  const blocks: DocBlock[] = [];
  if (q.type === "MATCHING") {
    const column = matchingColumn(q, ctx, variant);
    blocks.push({ kind: "question", number: n, stem, options: [], answerLines: 0 });
    const rows = Math.max(q.pairs.length, column.length);
    blocks.push({
      kind: "table",
      keepTogether: true,
      columns: [
        { title: "Columna A", width: 50 },
        { title: "Columna B", width: 50 },
      ],
      rows: Array.from({ length: rows }, (_, i) => [
        q.pairs[i] ? `(    ) ${i + 1}. ${q.pairs[i]!.left}` : "",
        column[i] ? `${LETTERS[i]}) ${column[i]}` : "",
      ]),
    });
    return blocks;
  }
  blocks.push({
    kind: "question",
    number: n,
    stem,
    options:
      q.type === "MULTIPLE_CHOICE"
        ? q.options.map((text, i) => ({ label: `${LETTERS[i]})`, text }))
        : q.type === "TRUE_FALSE"
          ? q.options.map((text) => ({ label: "○", text }))
          : [],
    inline: q.type === "TRUE_FALSE",
    answerLines: q.type === "SHORT_ANSWER" ? 3 : q.type === "OPEN" ? 8 : 0,
  });
  return blocks;
}

function keyAnswer(q: ExamQuestion, ctx: ExportContext, variant: Variant): string {
  if (q.type === "MULTIPLE_CHOICE") {
    const i = q.options.indexOf(q.answer);
    return i >= 0 ? `${LETTERS[i]}) ${q.answer}` : q.answer;
  }
  if (q.type === "MATCHING") return matchingKey(q, ctx, variant).join("; ");
  return q.answer;
}

function keyDetail(q: ExamQuestion): string {
  if (q.type !== "OPEN") return q.explanation;
  const criteria = q.criteria.map((c) => `${c.description} (${formatPoints(c.points)})`);
  return [`Criterios: ${criteria.join("; ")}`, q.explanation].filter(Boolean).join(". ");
}

/** RN-14: puntos de 0 al total con su nota, y la fila de la nota mínima resaltada. */
export function conversionRows(total: number, scale: GradingScale) {
  const step = total <= 20 ? 1 : total <= 50 ? 2 : 5;
  const passing = passingPointsFor(total, scale);
  const points = new Set<number>();
  for (let p = 0; p < total; p += step) points.add(Math.round(p * 10) / 10);
  points.add(total);
  points.add(passing);
  const sorted = [...points].sort((a, b) => a - b);
  return {
    rows: sorted.map((p) => [
      number.format(p),
      `${grade.format(gradeFor(p, total, scale))}${p === passing ? " (nota mínima)" : ""}`,
    ]),
    passingRow: sorted.indexOf(passing),
  };
}

const header = (ctx: ExportContext, variant: Variant) =>
  variant !== "A" ? [...ctx.header, { label: "Versión", value: variant }] : ctx.header;

export function buildExam(
  content: ExamContent,
  ctx: ExportContext,
  doc: DocKind,
  variant: Variant,
  scale: GradingScale,
): DocModel {
  if (doc === "answers") return buildAnswerSheet(content, ctx);
  const sections = examVariant(content, ctx, variant);
  const total = examTotalPoints(content);
  const blocks: DocBlock[] = [];
  const suffix = variant !== "A" ? ` · Versión ${variant}` : "";
  let n = 0;

  if (doc === "key") {
    sections.forEach((s, i) => {
      blocks.push({
        kind: "heading",
        text: `Sección ${i + 1}. ${s.title} (${formatPoints(sectionPoints(s))})`,
        level: 1,
      });
      blocks.push({
        kind: "table",
        columns: [
          { title: "N°", width: 7, center: true },
          { title: "Respuesta", width: 38 },
          { title: "Puntos", width: 10, center: true },
          { title: "Justificación y criterios", width: 45, muted: true },
        ],
        rows: s.questions.map((q) => [
          String(++n),
          keyAnswer(q, ctx, variant),
          number.format(q.points),
          keyDetail(q),
        ]),
      });
    });
    blocks.push({ kind: "heading", text: "Puntos por sección", level: 1 });
    blocks.push({
      kind: "table",
      columns: [
        { title: "Sección", width: 60 },
        { title: "Preguntas", width: 20, center: true },
        { title: "Puntos", width: 20, center: true },
      ],
      rows: [
        ...sections.map((s, i) => [
          `${i + 1}. ${s.title}`,
          String(s.questions.length),
          number.format(sectionPoints(s)),
        ]),
        ["Total", String(n), number.format(total)],
      ],
      strongRows: [sections.length],
    });
    const covered = content.topics.map((t) => [
      t.title,
      String(content.sections.flatMap((s) => s.questions).filter((q) => q.topicId === t.id).length),
    ]);
    blocks.push({ kind: "heading", text: "Preguntas por tema", level: 1 });
    blocks.push({
      kind: "table",
      columns: [
        { title: "Tema", width: 80 },
        { title: "Preguntas", width: 20, center: true },
      ],
      rows: covered,
    });
    const conversion = conversionRows(total, scale);
    blocks.push({ kind: "heading", text: "Conversión a nota (1,0 a 5,0)", level: 1 });
    blocks.push({
      kind: "paragraph",
      tone: "muted",
      text: `Nota mínima aprobatoria: ${grade.format(scale.passingGrade)} con ${number.format(passingPointsFor(total, scale))} de ${formatPoints(total)}. Ajústala en Profe si tu colegio usa otra.`,
    });
    blocks.push({
      kind: "table",
      keepTogether: true,
      columns: [
        { title: "Puntos", width: 50, center: true },
        { title: "Nota", width: 50, center: true },
      ],
      rows: conversion.rows,
      strongRows: [conversion.passingRow],
    });
    return {
      logo: ctx.logo ?? null,
      institutionLine: ctx.institution ?? null,
      title: content.title,
      subtitle: `Clave de respuestas${suffix}`,
      draft: ctx.draft,
      header: header(ctx, variant),
      studentFields: [],
      blocks,
      footer: footer(ctx, variant),
    };
  }

  if (content.instructions) {
    blocks.push({ kind: "paragraph", text: content.instructions, tone: "muted" });
  }
  sections.forEach((s, i) => {
    blocks.push({
      kind: "heading",
      text: `Sección ${i + 1}. ${s.title} (${formatPoints(sectionPoints(s))})`,
      level: 1,
    });
    if (s.instructions) blocks.push({ kind: "paragraph", text: s.instructions, tone: "muted" });
    for (const q of s.questions) blocks.push(...studentQuestion(q, ++n, ctx, variant));
  });
  return {
    logo: ctx.logo ?? null,
    institutionLine: ctx.institution ?? null,
    title: content.title,
    subtitle: `Hoja del estudiante${suffix}`,
    draft: ctx.draft,
    header: header(ctx, variant),
    // La casilla de calificación del examen (SPEC-0011 §2).
    studentFields: ["Nombre", "Curso", "Fecha", "Calificación"],
    blocks,
    footer: footer(ctx, variant),
  };
}

/** RN-15: hay hoja de respuestas si hay al menos una sección de selección múltiple o de V/F. */
export const hasAnswerSheet = (content: Pick<ExamContent, "sections">) =>
  content.sections.some(
    (s) => s.questionType === "MULTIPLE_CHOICE" || s.questionType === "TRUE_FALSE",
  );

/**
 * RN-15: casillas para marcar en selección múltiple y V/F. Es la misma para las versiones A–D:
 * las columnas dependen de la sección (el máximo de opciones), no del orden de las preguntas.
 */
function buildAnswerSheet(content: ExamContent, ctx: ExportContext): DocModel {
  const blocks: DocBlock[] = [];
  blocks.push({
    kind: "paragraph",
    tone: "muted",
    text: "Rellena el círculo de la respuesta correcta. Las demás preguntas se responden en la hoja del examen.",
  });
  let n = 0;
  content.sections.forEach((s, i) => {
    const first = n + 1;
    n += s.questions.length;
    if (s.questionType !== "MULTIPLE_CHOICE" && s.questionType !== "TRUE_FALSE") return;
    const labels =
      s.questionType === "TRUE_FALSE"
        ? ["V", "F"]
        : Array.from({ length: Math.max(...s.questions.map((q) => q.options.length), 2) }, (_, k) =>
            LETTERS[k]!.toUpperCase(),
          );
    const width = Math.floor(84 / labels.length);
    blocks.push({ kind: "heading", text: `Sección ${i + 1}. ${s.title}`, level: 2 });
    blocks.push({
      kind: "table",
      columns: [
        { title: "N°", width: 100 - width * labels.length, center: true },
        ...labels.map((l) => ({ title: l, width, center: true })),
      ],
      rows: s.questions.map((_, k) => [String(first + k), ...labels.map(() => "○")]),
    });
  });
  return {
    logo: ctx.logo ?? null,
    institutionLine: ctx.institution ?? null,
    title: content.title,
    subtitle: "Hoja de respuestas",
    draft: ctx.draft,
    header: ctx.header,
    studentFields: ["Nombre", "Curso", "Fecha", "Versión"],
    blocks,
    footer: footer(ctx, "A"),
  };
}
