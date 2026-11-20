import { PERFORMANCE_LABELS, bandRange, type GradingBands } from "@/modules/institutions/client";
import { RUBRIC_COLUMNS, sessionMinutes, type LessonPlanContent } from "@/modules/resources/client";
import type { ExportContext } from "./build";
import type { DocBlock, DocModel } from "./model";

// SPEC-0024 RN-05: el plan de aula es un documento del docente (no hay hoja del estudiante ni
// clave). Encabezado, propósito, DBA y objetivos, sesiones en orden, evaluación y la rúbrica con
// los rangos de la escala del espacio (RN-04: se leen al descargar, no se copian en el plan).

export function buildLessonPlan(
  content: LessonPlanContent,
  ctx: ExportContext,
  objectives: string[],
  scale: GradingBands,
): DocModel {
  const dbaByCode = new Map(ctx.dba.map((d) => [d.code, d]));
  const blocks: DocBlock[] = [
    { kind: "heading", text: "Propósito", level: 1 },
    { kind: "paragraph", text: content.purpose },
  ];

  const cited = [...new Set(content.sessions.flatMap((s) => s.dbaCodes))]
    .map((c) => dbaByCode.get(c))
    .filter((d) => d !== undefined);
  if (cited.length || objectives.length) {
    blocks.push({ kind: "heading", text: "Referentes y objetivos", level: 1 });
    if (cited.length) {
      blocks.push({
        kind: "list",
        items: cited.map((d) => `DBA ${d.number}: ${d.statement}`),
      });
    }
    if (objectives.length) blocks.push({ kind: "list", items: objectives, ordered: true });
  }

  blocks.push({ kind: "heading", text: "Secuencia didáctica", level: 1 });
  for (const s of content.sessions) {
    blocks.push({
      kind: "heading",
      text: `Sesión ${s.number}. ${s.title} (${sessionMinutes(s)} min)`,
      level: 2,
    });
    blocks.push({
      kind: "table",
      columns: [
        { title: "Momento", width: 18 },
        { title: "Actividades", width: 70 },
        { title: "Min", width: 12, center: true },
      ],
      rows: [
        ["Inicio", s.start, String(s.startMinutes)],
        ["Desarrollo", s.development, String(s.developmentMinutes)],
        ["Cierre", s.closure, String(s.closureMinutes)],
      ],
    });
    const dba = s.dbaCodes
      .map((c) => dbaByCode.get(c))
      .filter((d) => d !== undefined)
      .map((d) => `DBA ${d.number}`);
    const details = [
      s.resources.length ? `Recursos: ${s.resources.join(", ")}` : "",
      dba.length ? `Referentes: ${dba.join(", ")}` : "",
    ].filter(Boolean);
    for (const text of details) blocks.push({ kind: "paragraph", text, tone: "muted" });
  }

  blocks.push({ kind: "heading", text: "Evaluación", level: 1 });
  blocks.push({ kind: "paragraph", text: content.evaluation.evidence });
  if (content.evaluation.instruments.length) {
    blocks.push({
      kind: "paragraph",
      text: `Instrumentos: ${content.evaluation.instruments.join(", ")}`,
      tone: "muted",
    });
  }

  blocks.push({ kind: "heading", text: "Rúbrica por desempeños", level: 1 });
  blocks.push({
    kind: "table",
    columns: [
      { title: "Criterio", width: 20 },
      ...RUBRIC_COLUMNS.map(({ level }) => ({
        title: `${PERFORMANCE_LABELS[level]} (${bandRange(scale, level)})`,
        width: 20,
      })),
    ],
    rows: content.rubric.map((r) => [r.criterion, ...RUBRIC_COLUMNS.map(({ key }) => r[key])]),
  });

  if (content.diversity.trim()) {
    blocks.push({ kind: "heading", text: "Ajustes para la diversidad", level: 1 });
    blocks.push({ kind: "paragraph", text: content.diversity });
  }

  return {
    logo: ctx.logo ?? null,
    institutionLine: ctx.institution ?? null,
    title: content.title,
    subtitle: "Plan de aula",
    draft: ctx.draft,
    header: ctx.header,
    studentFields: [],
    blocks,
    footer: `Profe · Versión ${ctx.version} del plan · ${ctx.date}`,
  };
}
