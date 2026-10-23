import "server-only";
import pdfmake from "pdfmake";
import vfs from "pdfmake/build/vfs_fonts";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { MARGIN_PT, type DocBlock, type DocModel } from "./model";

// Renderizador PDF (ADR-0009): carta, márgenes de 2 cm, Roboto embebida (SIL OFL 1.1, viene en el
// sistema de archivos virtual de pdfmake) y texto seleccionable. Sin acceso a URLs ni al disco.

// En el servidor, pdfmake lee las fuentes de su sistema de archivos virtual.
const virtualfs = (
  pdfmake as unknown as {
    virtualfs: { writeFileSync: (name: string, content: Buffer) => void };
  }
).virtualfs;
for (const [name, base64] of Object.entries(vfs as Record<string, string>)) {
  virtualfs.writeFileSync(name, Buffer.from(base64, "base64"));
}
pdfmake.setFonts({
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
});
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => false);

const LINE = "_".repeat(80);
const MUTED = "#555555";

function block(b: DocBlock): Content {
  switch (b.kind) {
    case "heading":
      return { text: b.text, style: b.level === 1 ? "h1" : "h2" };
    case "paragraph":
      return {
        text: b.text,
        margin: [0, 0, 0, 6],
        ...(b.tone === "muted" && { color: MUTED, italics: true }),
        ...(b.tone === "strong" && { bold: true }),
      };
    case "list":
      return b.ordered
        ? { ol: b.items, margin: [0, 0, 0, 6] }
        : { ul: b.items, margin: [0, 0, 0, 6] };
    case "question":
      return {
        // Una pregunta no se parte entre páginas (SPEC-0009 §2).
        unbreakable: true,
        margin: [0, 6, 0, 6],
        stack: [
          { text: [{ text: `${b.number}. `, bold: true }, b.stem] },
          b.inline
            ? {
                text: b.options.map((o) => `${o.label} ${o.text}`).join("        "),
                margin: [14, 4, 0, 0],
              }
            : {
                stack: b.options.map((o) => ({
                  text: `${o.label} ${o.text}`,
                  margin: [14, 2, 0, 0],
                })),
              },
          ...Array.from({ length: b.answerLines }, () => ({
            text: LINE,
            color: "#999999",
            margin: [14, 6, 0, 0] as [number, number, number, number],
          })),
        ],
      };
    case "activity":
      return {
        // Una actividad no se parte entre páginas (sus líneas de respuesta van con ella).
        unbreakable: true,
        margin: [0, 4, 0, 8],
        stack: [
          { text: b.title, bold: true, margin: [0, 0, 0, 2] },
          { text: b.instructions },
          ...b.details.map((d) => ({
            text: d,
            color: MUTED,
            fontSize: 10,
            margin: [0, 2, 0, 0] as [number, number, number, number],
          })),
          ...Array.from({ length: b.answerLines }, () => ({
            text: LINE,
            color: "#999999",
            margin: [0, 6, 0, 0] as [number, number, number, number],
          })),
        ],
      };
    case "keyTable":
      return {
        table: {
          headerRows: 1,
          widths: [24, "*", "*"],
          body: [
            [
              { text: "N°", bold: true },
              { text: "Respuesta", bold: true },
              { text: "Justificación", bold: true },
            ],
            ...b.rows.map((r) => [r.number, r.answer, { text: r.explanation, color: MUTED }]),
          ],
        },
        layout: "lightHorizontalLines",
      };
    case "table": {
      const strong = new Set(b.strongRows ?? []);
      return {
        unbreakable: b.keepTogether ?? false,
        margin: [0, 4, 0, 10],
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: b.columns.map((c) => `${c.width}%`),
          body: [
            b.columns.map((c) => ({
              text: c.title,
              bold: true,
              ...(c.center && { alignment: "center" as const }),
            })),
            ...b.rows.map((row, r) =>
              row.map((text, i) => ({
                text,
                ...(b.columns[i]?.muted && { color: MUTED }),
                ...(b.columns[i]?.center && { alignment: "center" as const }),
                ...(strong.has(r) && { bold: true }),
              })),
            ),
          ],
        },
        layout: {
          hLineColor: () => "#bbbbbb",
          vLineColor: () => "#bbbbbb",
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      };
    }
  }
}

function headerTable(doc: DocModel): Content {
  // Dos pares etiqueta/valor por fila, como los formatos institucionales.
  const rows: Content[][] = [];
  for (let i = 0; i < doc.header.length; i += 2) {
    const pair = doc.header.slice(i, i + 2);
    rows.push(
      pair.flatMap((h) => [
        { text: h.label, bold: true, fontSize: 9, color: MUTED },
        { text: h.value, fontSize: 10 },
      ]),
    );
    if (pair.length === 1) rows[rows.length - 1]!.push({ text: "" }, { text: "" });
  }
  return {
    table: { widths: ["auto", "*", "auto", "*"], body: rows },
    layout: {
      hLineColor: () => "#bbbbbb",
      vLineColor: () => "#bbbbbb",
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 8],
  };
}

/** Logo y nombre de la institución (SPEC-0010 RN-09). */
function topRow(doc: DocModel): Content | null {
  if (!doc.logo && !doc.institutionLine) return null;
  const columns: Content[] = [];
  if (doc.logo) {
    // `fit` conserva la proporción: como máximo 140 × 48 pt; la columna mide lo que el logo.
    const width = Math.min(140, Math.round((48 * doc.logo.width) / doc.logo.height));
    columns.push({
      image: `data:${doc.logo.mimeType};base64,${doc.logo.data.toString("base64")}`,
      fit: [width, 48],
      width,
    });
  }
  if (doc.institutionLine) {
    columns.push({ text: doc.institutionLine, bold: true, fontSize: 13, margin: [0, 14, 0, 0] });
  }
  return { columns, columnGap: 10, margin: [0, 0, 0, 8] };
}

export function toPdfDefinition(doc: DocModel): TDocumentDefinitions {
  const content: Content[] = [];
  if (doc.draft) {
    content.push({
      text: "BORRADOR — revisar antes de imprimir",
      color: "#b45309",
      bold: true,
      fontSize: 9,
      margin: [0, 0, 0, 6],
    });
  }
  const top = topRow(doc);
  if (top) content.push(top);
  content.push(headerTable(doc));
  content.push({ text: doc.title, style: "title" });
  content.push({ text: doc.subtitle, color: MUTED, margin: [0, 0, 0, 8] });
  if (doc.studentFields.length) {
    content.push({
      columns: doc.studentFields.map((f, i) => ({
        text: `${f}: ${"_".repeat(i === 0 ? 34 : 12)}`,
        width: i === 0 ? "*" : "auto",
      })),
      columnGap: 12,
      margin: [0, 0, 0, 12],
    });
  }
  content.push(...doc.blocks.map(block));
  return {
    pageSize: "LETTER",
    pageMargins: [MARGIN_PT, MARGIN_PT, MARGIN_PT, MARGIN_PT],
    info: { title: `${doc.title} — ${doc.subtitle}`, creator: "Profe" },
    defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.2 },
    styles: {
      title: { fontSize: 16, bold: true, margin: [0, 4, 0, 2] },
      h1: { fontSize: 13, bold: true, margin: [0, 10, 0, 4] },
      h2: { fontSize: 11.5, bold: true, margin: [0, 6, 0, 2] },
    },
    ...(doc.draft && { watermark: { text: "BORRADOR", opacity: 0.06, bold: true } }),
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: doc.footer, fontSize: 8, color: MUTED },
        {
          width: "auto",
          text: `Página ${currentPage} de ${pageCount}`,
          fontSize: 8,
          color: MUTED,
          alignment: "right",
        },
      ],
      margin: [MARGIN_PT, 20, MARGIN_PT, 0],
    }),
    content,
  };
}

export async function renderPdf(doc: DocModel): Promise<Buffer> {
  return pdfmake.createPdf(toPdfDefinition(doc)).getBuffer();
}
