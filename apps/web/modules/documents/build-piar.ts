import type { PiarDetail } from "@/modules/piar/client";
import { PIAR_CONFIDENTIAL_FOOTER } from "@/modules/piar/client";
import type { DocBlock, DocLogo, DocModel } from "./model";

// SPEC-0017 T5: el PIAR en Word y PDF. Lleva el aviso de confidencialidad (RN-06) y los espacios
// para las firmas del docente, el acudiente y el directivo (Decreto 1421 de 2017).

export type PiarExportContext = {
  logo?: DocLogo | null;
  institution?: string;
  teacherName: string;
  /** Fecha de la descarga, ya formateada. */
  date: string;
};

const SIGNATURE_LINE = "______________________________";

export function buildPiar(piar: PiarDetail, ctx: PiarExportContext): DocModel {
  const c = piar.content;
  const blocks: DocBlock[] = [
    { kind: "paragraph", text: PIAR_CONFIDENTIAL_FOOTER, tone: "strong" },
    { kind: "heading", text: "1. Estudiante", level: 1 },
    {
      kind: "list",
      items: [
        `Nombre: ${c.student.name}`,
        c.student.age ? `Edad: ${c.student.age} años` : "",
        `Valoración o soporte externo: ${
          c.student.externalSupport
            ? `Sí${c.student.supportIssuer ? `, emitido por ${c.student.supportIssuer}` : ""}`
            : "No"
        }`,
      ].filter(Boolean),
    },
  ];
  const text = (heading: string, value: string) => {
    blocks.push({ kind: "heading", text: heading, level: 2 });
    blocks.push({ kind: "paragraph", text: value.trim() || "—" });
  };
  blocks.push({ kind: "heading", text: "2. Cómo aprende", level: 1 });
  text("Fortalezas e intereses", c.learning.strengths);
  text("Cómo aprende mejor", c.learning.howLearnsBest);
  blocks.push({
    kind: "heading",
    text: `3. Barreras para aprender en ${piar.course.subjectName}`,
    level: 1,
  });
  blocks.push({ kind: "paragraph", text: c.barriers.trim() || "—" });

  blocks.push({ kind: "heading", text: "4. Ajustes razonables por periodo", level: 1 });
  blocks.push({
    kind: "table",
    columns: [
      { title: "Periodo", width: 14 },
      { title: "Propósito", width: 18 },
      { title: "Ajustes curriculares", width: 17 },
      { title: "Ajustes didácticos", width: 17 },
      { title: "Ajustes de evaluación", width: 17 },
      { title: "Seguimiento", width: 17 },
    ],
    rows: c.periods.map((p) => [
      p.name,
      p.purpose || "—",
      p.curricular || "—",
      p.didactic || "—",
      p.evaluative || "—",
      p.followUp || "—",
    ]),
  });
  blocks.push({ kind: "heading", text: "5. Recomendaciones para la familia", level: 1 });
  blocks.push({ kind: "paragraph", text: c.family.trim() || "—" });

  blocks.push({ kind: "heading", text: "Firmas", level: 1 });
  blocks.push({
    kind: "table",
    columns: [
      { title: "Docente", width: 34, center: true },
      { title: "Acudiente", width: 33, center: true },
      { title: "Directivo o coordinador", width: 33, center: true },
    ],
    rows: [
      ["\n\n" + SIGNATURE_LINE, "\n\n" + SIGNATURE_LINE, "\n\n" + SIGNATURE_LINE],
      [ctx.teacherName, "Nombre:", "Nombre:"],
    ],
    keepTogether: true,
  });

  return {
    logo: ctx.logo ?? null,
    institutionLine: ctx.institution ?? null,
    title: "PIAR · Plan Individual de Ajustes Razonables",
    subtitle: `${piar.course.title} · Año ${piar.academicYear}`,
    draft: false,
    header: [
      { label: "Asignatura", value: piar.course.subjectName },
      { label: "Grado", value: piar.course.gradeLabel },
      { label: "Año lectivo", value: piar.academicYear },
      { label: "Fecha", value: ctx.date },
    ],
    studentFields: [],
    blocks,
    footer: `${PIAR_CONFIDENTIAL_FOOTER} · Profe · ${ctx.date}`,
  };
}
