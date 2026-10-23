import "server-only";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { invalid } from "@/lib/errors";
import { MAX_FORMAT_BYTES } from "./schemas";

// Extractor de estructura de un formato en Word (SPEC-0010 T1). Lee word/document.xml y los
// encabezados de página como texto: párrafos (con estilo, negrita y numeración) y tablas. No
// ejecuta nada del archivo, no resuelve entidades y no conserva el archivo (RN-03, RN-07).

export type Paragraph = {
  kind: "p";
  text: string;
  heading: boolean;
  bold: boolean;
  numbered: boolean;
};
export type TableBlock = { kind: "table"; rows: string[][] };
export type Block = Paragraph | TableBlock;
export type DocxBlocks = { pageHeader: Block[]; body: Block[] };

type XNode = Record<string, unknown> & { ":@"?: Record<string, string> };

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  processEntities: true,
  htmlEntities: false,
});

const tagOf = (node: XNode) => Object.keys(node).find((k) => k !== ":@") ?? "";
const children = (node: XNode): XNode[] => (node[tagOf(node)] as XNode[]) ?? [];
const find = (nodes: XNode[], tag: string) => nodes.find((n) => tagOf(n) === tag);

/** RN-07: un DOCX de verdad (ZIP con word/document.xml), sin macros y de tamaño razonable. */
export async function openDocx(data: Buffer): Promise<JSZip> {
  if (data.length > MAX_FORMAT_BYTES) throw invalid("El archivo pesa más de 5 MB");
  if (data.subarray(0, 4).toString("latin1") !== "PK\u0003\u0004") {
    throw invalid("El archivo no es un documento de Word (.docx)");
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw invalid("No pudimos abrir el documento de Word");
  }
  if (!zip.file("word/document.xml"))
    throw invalid("El archivo no es un documento de Word (.docx)");
  if (zip.file(/vbaProject\.bin$/i).length) {
    throw invalid("El documento tiene macros; guárdalo como .docx sin macros");
  }
  // Un ZIP que se infla demasiado (bomba de compresión) se rechaza antes de leerlo.
  const declared = Object.values(zip.files).reduce(
    (sum, f) =>
      sum +
      ((f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0),
    0,
  );
  if (declared > 60 * 1024 * 1024) throw invalid("El documento es demasiado grande");
  return zip;
}

async function readXml(zip: JSZip, path: string): Promise<XNode[]> {
  const xml = await zip.file(path)!.async("string");
  // Sin DTD ni entidades propias: evita la expansión de entidades (XXE, "billion laughs").
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw invalid("El documento tiene un formato no permitido");
  return parser.parse(xml) as XNode[];
}

function runText(nodes: XNode[]): string {
  let text = "";
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === "w:t") {
      text += children(node)
        .map((c) => String(c["#text"] ?? ""))
        .join("");
    } else if (tag === "w:tab") text += " ";
    else if (tag === "w:br" || tag === "w:cr") text += "\n";
    else if (tag !== "w:rPr" && tag !== "#text") text += runText(children(node));
  }
  return text;
}

function paragraph(node: XNode): Paragraph {
  const parts = children(node);
  const pPr = find(parts, "w:pPr");
  const pprKids = pPr ? children(pPr) : [];
  const style = find(pprKids, "w:pStyle")?.[":@"]?.["w:val"] ?? "";
  const runs = parts.filter((n) =>
    ["w:r", "w:hyperlink", "w:ins", "w:smartTag"].includes(tagOf(n)),
  );
  const textRuns = runs.filter((r) => runText(children(r)).trim());
  const isBold = (r: XNode) => {
    const rPr = find(children(r), "w:rPr");
    const b = rPr && find(children(rPr), "w:b");
    return !!b && !["0", "false"].includes(b[":@"]?.["w:val"] ?? "");
  };
  return {
    kind: "p",
    text: runText(runs)
      .replace(/[ \t]+/g, " ")
      .trim(),
    heading: /heading|t[ií]tulo|title|encabezado/i.test(style),
    bold: textRuns.length > 0 && textRuns.every(isBold),
    numbered: !!find(pprKids, "w:numPr"),
  };
}

function table(node: XNode): TableBlock {
  const rows = children(node)
    .filter((n) => tagOf(n) === "w:tr")
    .map((tr) =>
      children(tr)
        .filter((n) => tagOf(n) === "w:tc")
        .map((tc) =>
          blocksOf(children(tc))
            .map((b) => (b.kind === "p" ? b.text : b.rows.map((r) => r.join(" ")).join(" ")))
            .filter(Boolean)
            .join("\n"),
        ),
    );
  return { kind: "table", rows };
}

function blocksOf(nodes: XNode[]): Block[] {
  const out: Block[] = [];
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === "w:p") out.push(paragraph(node));
    else if (tag === "w:tbl") out.push(table(node));
    // Controles de contenido y bloques de texto: se recorre su contenido.
    else if (tag === "w:sdt" || tag === "w:sdtContent" || tag === "w:txbxContent") {
      out.push(...blocksOf(children(node)));
    }
  }
  return out;
}

export async function extractBlocks(data: Buffer): Promise<DocxBlocks> {
  const zip = await openDocx(data);
  const document = await readXml(zip, "word/document.xml");
  const root = document.find((n) => tagOf(n) === "w:document");
  const body = root && find(children(root), "w:body");
  if (!body) throw invalid("El documento de Word está vacío");

  const headerPaths = zip
    .file(/^word\/header\d*\.xml$/)
    .map((f) => f.name)
    .sort();
  const pageHeader: Block[] = [];
  for (const path of headerPaths.slice(0, 3)) {
    const xml = await readXml(zip, path);
    const hdr = xml.find((n) => tagOf(n) === "w:hdr");
    if (hdr) pageHeader.push(...blocksOf(children(hdr)));
  }
  const nonEmpty = (b: Block) => (b.kind === "p" ? !!b.text : b.rows.some((r) => r.some(Boolean)));
  return {
    pageHeader: pageHeader.filter(nonEmpty),
    body: blocksOf(children(body)).filter(nonEmpty),
  };
}
