import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
} from "docx";
import { LETTER, MARGIN_PT, type DocBlock, type DocModel } from "./model";

// Renderizador DOCX (ADR-0009): texto real y editable, carta, márgenes de 2 cm. El texto del
// recurso entra siempre como TextRun (texto plano), nunca como campos ni HTML.

const TWIPS_PER_PT = 20;
const MUTED = "555555";
const FONT = "Calibri";
const LINE = "_".repeat(70);

const p = (
  text: string,
  opts: IParagraphOptions & {
    bold?: boolean;
    color?: string;
    italics?: boolean;
    size?: number;
  } = {},
) => {
  const { bold, color, italics, size, ...rest } = opts;
  return new Paragraph({
    spacing: { after: 80 },
    ...rest,
    children: [new TextRun({ text, bold, color, italics, size, font: FONT })],
  });
};

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
};

const cell = (
  text: string,
  opts: { bold?: boolean; color?: string; size?: number; width?: number } = {},
) =>
  new TableCell({
    borders: cellBorders,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      p(text, { bold: opts.bold, color: opts.color, size: opts.size, spacing: { after: 0 } }),
    ],
  });

function headerTable(doc: DocModel) {
  const rows: TableRow[] = [];
  for (let i = 0; i < doc.header.length; i += 2) {
    const pair = doc.header.slice(i, i + 2);
    const cells = pair.flatMap((h) => [
      cell(h.label, { bold: true, color: MUTED, size: 18, width: 16 }),
      cell(h.value, { size: 20, width: 34 }),
    ]);
    if (pair.length === 1) cells.push(cell("", { width: 16 }), cell("", { width: 34 }));
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

const answerLines = (n: number, indent = 0) =>
  Array.from({ length: n }, () => p(LINE, { color: "999999", indent: { left: indent } }));

function blocks(b: DocBlock): (Paragraph | Table)[] {
  switch (b.kind) {
    case "heading":
      return [
        p(b.text, {
          bold: true,
          size: b.level === 1 ? 26 : 23,
          spacing: { before: b.level === 1 ? 240 : 120, after: 80 },
          keepNext: true,
        }),
      ];
    case "paragraph":
      return [
        p(b.text, {
          ...(b.tone === "muted" && { color: MUTED, italics: true }),
          ...(b.tone === "strong" && { bold: true }),
        }),
      ];
    case "list":
      return b.items.map(
        (item) =>
          new Paragraph({
            numbering: { reference: b.ordered ? "ordered" : "bullets", level: 0 },
            children: [new TextRun({ text: item, font: FONT })],
          }),
      );
    case "question":
      return [
        new Paragraph({
          spacing: { before: 160, after: 60 },
          keepNext: true,
          keepLines: true,
          children: [
            new TextRun({ text: `${b.number}. `, bold: true, font: FONT }),
            new TextRun({ text: b.stem, font: FONT }),
          ],
        }),
        ...(b.inline
          ? [
              p(b.options.map((o) => `${o.label} ${o.text}`).join("        "), {
                indent: { left: 280 },
              }),
            ]
          : b.options.map((o, i) =>
              p(`${o.label} ${o.text}`, {
                indent: { left: 280 },
                spacing: { after: 40 },
                keepNext: i < b.options.length - 1,
              }),
            )),
        ...answerLines(b.answerLines, 280),
      ];
    case "activity":
      return [
        p(b.title, { bold: true, spacing: { before: 120, after: 40 }, keepNext: true }),
        p(b.instructions),
        ...b.details.map((d) => p(d, { color: MUTED, size: 20 })),
        ...answerLines(b.answerLines),
      ];
    case "keyTable":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                cell("N°", { bold: true, width: 8 }),
                cell("Respuesta", { bold: true, width: 40 }),
                cell("Justificación", { bold: true, width: 52 }),
              ],
            }),
            ...b.rows.map(
              (r) =>
                new TableRow({
                  cantSplit: true,
                  children: [
                    cell(r.number, { width: 8 }),
                    cell(r.answer, { width: 40 }),
                    cell(r.explanation, { width: 52, color: MUTED }),
                  ],
                }),
            ),
          ],
        }),
      ];
    case "table": {
      const strong = new Set(b.strongRows ?? []);
      const tableCell = (text: string, i: number, opts: { bold?: boolean } = {}) => {
        const column = b.columns[i]!;
        return new TableCell({
          borders: cellBorders,
          width: { size: column.width, type: WidthType.PERCENTAGE },
          children: [
            p(text, {
              bold: opts.bold,
              color: column.muted ? MUTED : undefined,
              alignment: column.center ? AlignmentType.CENTER : undefined,
              spacing: { after: 0 },
              keepNext: b.keepTogether,
            }),
          ],
        });
      };
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              cantSplit: true,
              children: b.columns.map((c, i) => tableCell(c.title, i, { bold: true })),
            }),
            ...b.rows.map(
              (row, r) =>
                new TableRow({
                  cantSplit: true,
                  children: row.map((text, i) => tableCell(text, i, { bold: strong.has(r) })),
                }),
            ),
          ],
        }),
        p("", { spacing: { after: 120 } }),
      ];
    }
  }
}

export async function renderDocx(doc: DocModel): Promise<Buffer> {
  const margin = Math.round(MARGIN_PT * TWIPS_PER_PT);
  const children: (Paragraph | Table)[] = [];
  if (doc.draft) {
    children.push(
      p("BORRADOR — revisar antes de imprimir", { bold: true, color: "B45309", size: 18 }),
    );
  }
  if (doc.logo || doc.institutionLine) {
    // Logo con altura fija (≈48 pt) y el nombre de la institución al lado (SPEC-0010 RN-09).
    const runs: (ImageRun | TextRun)[] = [];
    if (doc.logo) {
      const height = 64;
      const width = Math.min(Math.round((height * doc.logo.width) / doc.logo.height), 190);
      runs.push(
        new ImageRun({
          type: doc.logo.mimeType === "image/png" ? "png" : "jpg",
          data: doc.logo.data,
          transformation: { width, height: Math.round((width * doc.logo.height) / doc.logo.width) },
        }),
      );
    }
    if (doc.institutionLine) {
      runs.push(
        new TextRun({
          text: `${doc.logo ? "   " : ""}${doc.institutionLine}`,
          bold: true,
          size: 26,
          font: FONT,
        }),
      );
    }
    children.push(new Paragraph({ spacing: { after: 120 }, children: runs }));
  }
  children.push(headerTable(doc));
  children.push(p(doc.title, { bold: true, size: 32, spacing: { before: 160, after: 40 } }));
  children.push(p(doc.subtitle, { color: MUTED }));
  if (doc.studentFields.length) {
    children.push(
      p(doc.studentFields.map((f, i) => `${f}: ${"_".repeat(i === 0 ? 34 : 12)}`).join("    "), {
        spacing: { before: 120, after: 200 },
      }),
    );
  }
  for (const b of doc.blocks) children.push(...blocks(b));

  const document = new Document({
    creator: "Profe",
    title: `${doc.title} — ${doc.subtitle}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
        {
          reference: "ordered",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: LETTER.widthPt * TWIPS_PER_PT, height: LETTER.heightPt * TWIPS_PER_PT },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${doc.footer} · Página `,
                    size: 16,
                    color: MUTED,
                    font: FONT,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: MUTED,
                    font: FONT,
                  }),
                  new TextRun({ text: " de ", size: 16, color: MUTED, font: FONT }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: MUTED,
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}
