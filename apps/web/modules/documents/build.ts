import type {
  Activity,
  QuizContent,
  QuizQuestion,
  WorkshopContent,
} from "@/modules/resources/client";
import { LEVEL_LABELS } from "@/modules/resources/client";
import type { FieldSource, FormatSnapshot } from "@/modules/formats/client";
import type { DocBlock, DocLogo, DocModel } from "./model";
import { seededShuffle, type Variant } from "./shuffle";

// Constructores del modelo intermedio (SPEC-0009). Aquí se decide qué va en cada documento:
// la clave y la guía del docente nunca entran en el documento del estudiante (RN-02).

/** `answers`: hoja de respuestas del examen (SPEC-0011 RN-15). */
export type DocKind = "student" | "key" | "answers";

export type ExportContext = {
  resourceId: string;
  version: number;
  draft: boolean;
  header: { label: string; value: string }[];
  dba: { code: string; number: number; statement: string }[];
  /** Fecha de la descarga, ya formateada. */
  date: string;
  logo?: DocLogo | null;
  /** Nombre de la institución para la línea superior. */
  institution?: string;
  /** Valor de cada origen de campo, para el encabezado de un formato propio (SPEC-0010). */
  values?: Partial<Record<FieldSource, string>>;
};

const top = (ctx: ExportContext, hasInstitutionField = false) => ({
  logo: ctx.logo ?? null,
  institutionLine: hasInstitutionField ? null : (ctx.institution ?? null),
});

const LETTERS = "abcdefghij";
const footer = (ctx: ExportContext, variant?: Variant) =>
  `Profe · Versión ${ctx.version} del recurso${variant && variant !== "A" ? ` · Versión ${variant} del quiz` : ""} · ${ctx.date}`;

/** RN-07: la versión A es el orden del docente; B–D barajan preguntas y opciones. */
export function quizVariant(
  content: QuizContent,
  ctx: ExportContext,
  variant: Variant,
): QuizQuestion[] {
  if (variant === "A") return content.questions;
  const seed = `${ctx.resourceId}:${ctx.version}:${variant}`;
  return seededShuffle(content.questions, seed).map((q) =>
    q.type === "MULTIPLE_CHOICE"
      ? { ...q, options: seededShuffle(q.options, `${seed}:${q.id}`) }
      : q,
  );
}

const optionsOf = (q: QuizQuestion) =>
  q.type === "SHORT_ANSWER"
    ? []
    : q.options.map((text, i) => ({
        label: q.type === "TRUE_FALSE" ? "○" : `${LETTERS[i]})`,
        text,
        correct: text === q.answer,
      }));

const correctLabel = (q: QuizQuestion) => {
  if (q.type !== "MULTIPLE_CHOICE") return q.answer;
  const i = q.options.indexOf(q.answer);
  return i >= 0 ? `${LETTERS[i]}) ${q.answer}` : q.answer;
};

const versionSuffix = (variant: Variant, variants: boolean) =>
  variants ? ` · Versión ${variant}` : "";

export function buildQuiz(
  content: QuizContent,
  ctx: ExportContext,
  doc: DocKind,
  variant: Variant,
): DocModel {
  const questions = quizVariant(content, ctx, variant);
  const labeled = variant !== "A";
  const header = labeled ? [...ctx.header, { label: "Versión", value: variant }] : ctx.header;

  if (doc === "key") {
    return {
      ...top(ctx),
      title: content.title,
      subtitle: `Clave de respuestas${versionSuffix(variant, labeled)}`,
      draft: ctx.draft,
      header,
      studentFields: [],
      blocks: [
        {
          kind: "keyTable",
          rows: questions.map((q, i) => ({
            number: String(i + 1),
            answer: correctLabel(q),
            explanation: q.explanation,
          })),
        },
      ],
      footer: footer(ctx, variant),
    };
  }

  const blocks: DocBlock[] = [];
  if (content.instructions)
    blocks.push({ kind: "paragraph", text: content.instructions, tone: "muted" });
  questions.forEach((q, i) =>
    blocks.push({
      kind: "question",
      number: i + 1,
      stem: q.stem,
      // RN-02: en la hoja del estudiante no se marca la correcta.
      options: optionsOf(q).map(({ label, text }) => ({ label, text })),
      inline: q.type === "TRUE_FALSE",
      answerLines: q.type === "SHORT_ANSWER" ? 3 : 0,
    }),
  );
  return {
    ...top(ctx),
    title: content.title,
    subtitle: `Hoja del estudiante${versionSuffix(variant, labeled)}`,
    draft: ctx.draft,
    header,
    studentFields: ["Nombre", "Curso", "Fecha"],
    blocks,
    footer: footer(ctx, variant),
  };
}

const dbaLabel = (codes: string[], ctx: ExportContext) =>
  codes
    .map((c) => ctx.dba.find((d) => d.code === c))
    .filter(Boolean)
    .map((d) => `DBA ${d!.number}`)
    .join(", ");

function activityBlock(a: Activity, n: number, ctx: ExportContext, teacher: boolean): DocBlock {
  const details = teacher
    ? [
        a.expectedOutcome && `Producto esperado: ${a.expectedOutcome}`,
        `Nivel de pensamiento: ${LEVEL_LABELS[a.cognitiveLevel]}`,
        a.dbaCodes.length ? `Referentes: ${dbaLabel(a.dbaCodes, ctx)}` : "",
      ].filter((x): x is string => !!x)
    : [];
  return {
    kind: "activity",
    title: `Actividad ${n}. ${a.title} (${a.durationMinutes} min)`,
    instructions: a.instructions,
    details,
    answerLines: teacher ? 0 : 4,
  };
}

export function buildWorkshop(
  content: WorkshopContent,
  ctx: ExportContext,
  doc: DocKind,
  format: FormatSnapshot | null = null,
): DocModel {
  if (format) return buildFormattedWorkshop(content, ctx, doc, format);
  const teacher = doc === "key";
  const blocks: DocBlock[] = [];
  if (content.purpose) {
    blocks.push({ kind: "heading", text: "Propósito", level: 2 });
    blocks.push({ kind: "paragraph", text: content.purpose });
  }
  if (content.studentInstructions) {
    blocks.push({ kind: "heading", text: "Indicaciones", level: 2 });
    blocks.push({ kind: "paragraph", text: content.studentInstructions });
  }
  if (content.materials.length) {
    blocks.push({ kind: "heading", text: "Materiales", level: 2 });
    blocks.push({ kind: "list", items: content.materials });
  }
  let n = 0;
  for (const moment of content.moments) {
    // Un momento sin actividades no se imprime (SPEC-0009 §7).
    if (!moment.activities.length) continue;
    blocks.push({ kind: "heading", text: moment.name, level: 1 });
    for (const a of moment.activities) blocks.push(activityBlock(a, ++n, ctx, teacher));
  }
  if (teacher) {
    if (content.teacherGuidance.length) {
      blocks.push({ kind: "heading", text: "Orientaciones para el docente", level: 1 });
      blocks.push({ kind: "list", items: content.teacherGuidance });
    }
    const cited = new Set(content.moments.flatMap((m) => m.activities.flatMap((a) => a.dbaCodes)));
    const refs = ctx.dba.filter((d) => cited.has(d.code));
    if (refs.length) {
      blocks.push({ kind: "heading", text: "Referentes curriculares (MEN)", level: 1 });
      blocks.push({ kind: "list", items: refs.map((d) => `DBA ${d.number}: ${d.statement}`) });
    }
  }
  return {
    ...top(ctx),
    title: content.title,
    subtitle: teacher ? "Guía del docente" : "Guía del estudiante",
    draft: ctx.draft,
    header: ctx.header,
    studentFields: teacher ? [] : ["Nombre", "Curso", "Fecha"],
    blocks,
    footer: footer(ctx),
  };
}

function teacherAppendix(content: WorkshopContent, ctx: ExportContext): DocBlock[] {
  const blocks: DocBlock[] = [];
  if (content.purpose) {
    blocks.push({ kind: "heading", text: "Propósito", level: 1 });
    blocks.push({ kind: "paragraph", text: content.purpose });
  }
  if (content.teacherGuidance.length) {
    blocks.push({ kind: "heading", text: "Orientaciones para el docente", level: 1 });
    blocks.push({ kind: "list", items: content.teacherGuidance });
  }
  const cited = new Set(content.moments.flatMap((m) => m.activities.flatMap((a) => a.dbaCodes)));
  const refs = ctx.dba.filter((d) => cited.has(d.code));
  if (refs.length) {
    blocks.push({ kind: "heading", text: "Referentes curriculares (MEN)", level: 1 });
    blocks.push({ kind: "list", items: refs.map((d) => `DBA ${d.number}: ${d.statement}`) });
  }
  return blocks;
}

const same = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");

/**
 * SPEC-0010: el taller con el formato del docente. El encabezado lleva sus etiquetas en su orden
 * (con los datos del curso o en blanco) y las secciones van en el orden del formato: actividades,
 * textos generados y textos fijos copiados tal cual.
 */
function buildFormattedWorkshop(
  content: WorkshopContent,
  ctx: ExportContext,
  doc: DocKind,
  format: FormatSnapshot,
): DocModel {
  const teacher = doc === "key";
  const { header, sections } = format.structure;
  const values = ctx.values ?? {};
  const blocks: DocBlock[] = [];
  if (content.studentInstructions) {
    blocks.push({ kind: "paragraph", text: content.studentInstructions, tone: "muted" });
  }
  if (content.materials.length) {
    blocks.push({ kind: "paragraph", text: `Materiales: ${content.materials.join(", ")}.` });
  }
  let n = 0;
  for (const section of sections) {
    blocks.push({ kind: "heading", text: section.title, level: 1 });
    if (section.kind === "ACTIVITIES") {
      const moment = content.moments.find((m) => same(m.name, section.title));
      for (const a of moment?.activities ?? []) blocks.push(activityBlock(a, ++n, ctx, teacher));
    } else if (section.kind === "TEXT") {
      const text = (content.sectionTexts ?? []).find((t) => same(t.title, section.title))?.content;
      if (text)
        blocks.push(...text.split(/\n+/).map((t) => ({ kind: "paragraph" as const, text: t })));
    } else {
      blocks.push(
        ...section.text.split(/\n+/).map((t) => ({ kind: "paragraph" as const, text: t })),
      );
    }
  }
  if (teacher) blocks.push(...teacherAppendix(content, ctx));
  return {
    ...top(
      ctx,
      header.some((h) => h.source === "INSTITUTION"),
    ),
    title: content.title,
    subtitle: teacher ? `${format.name} · Guía del docente` : format.name,
    draft: ctx.draft,
    header: header.map((h) => ({
      label: h.label,
      value: h.source === "BLANK" ? "" : (values[h.source] ?? ""),
    })),
    // Los campos del estudiante ya vienen en el encabezado del formato.
    studentFields: [],
    blocks,
    footer: footer(ctx),
  };
}
