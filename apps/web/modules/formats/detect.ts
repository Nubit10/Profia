import type { Block, DocxBlocks } from "./extract";
import {
  MAX_HEADER_FIELDS,
  MAX_SECTIONS,
  type FieldSource,
  type FormatStructure,
  type SectionKind,
} from "./schemas";

// Detección del encabezado y las secciones de un formato (SPEC-0010). Heurística pura: funciona sin
// IA; el AI Engine solo afina el origen de los campos y el tipo de las secciones.

export type DetectedField = { label: string; value: string };
export type DetectedSection = { title: string; body: string };
export type Detection = {
  fields: DetectedField[];
  sections: DetectedSection[];
  /** Líneas sueltas del encabezado (nombre del colegio, título de la guía). */
  titleLines: string[];
  warnings: string[];
};

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const BLANKISH = /^[\s_.\-–—…]*$/;
const LABEL = /^[\p{L}°º#.()/ ]{2,40}$/u;

/** "NOMBRE: ____  GRADO: ____" → pares etiqueta/valor. */
function fieldsInText(text: string): DetectedField[] {
  const out: DetectedField[] = [];
  const re = /([\p{L}°º#.()/ ]{2,40}?)\s*:\s*/gu;
  const matches = [...text.matchAll(re)];
  matches.forEach((m, i) => {
    const label = m[1]!.trim();
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : text.length;
    const value = text.slice(start, end).trim();
    if (label.split(/\s+/).length <= 5 && LABEL.test(label)) out.push({ label, value });
  });
  return out;
}

/** Celdas de una fila: "ETIQUETA:" o pares etiqueta | valor. */
function fieldsInRow(row: string[]): DetectedField[] {
  const out: DetectedField[] = [];
  for (let i = 0; i < row.length; i++) {
    const cell = row[i]!.trim();
    if (!cell) continue;
    const inline = fieldsInText(cell);
    if (inline.length) {
      // "DOCENTE:" sola en una celda: el valor está en la celda siguiente.
      if (
        inline.length === 1 &&
        !inline[0]!.value &&
        i + 1 < row.length &&
        !fieldsInText(row[i + 1]!).length
      ) {
        out.push({ label: inline[0]!.label, value: row[i + 1]!.trim() });
        i++;
      } else out.push(...inline);
      continue;
    }
    // Etiqueta corta seguida de una celda de valor (tabla de dos columnas sin dos puntos).
    if (
      i + 1 < row.length &&
      LABEL.test(cell) &&
      cell.length <= 30 &&
      !fieldsInText(row[i + 1]!).length
    ) {
      out.push({ label: cell, value: row[i + 1]!.trim() });
      i++;
    }
  }
  return out;
}

/**
 * En un párrafo, un solo "Etiqueta: valor" es un campo si el valor está en blanco o es un dato
 * corto; así "Responde: ¿qué sabes de…?" no se toma como campo.
 */
function fieldsIn(block: Block): DetectedField[] {
  if (block.kind === "table") return block.rows.flatMap(fieldsInRow);
  const found = fieldsInText(block.text);
  if (found.length !== 1) return found;
  const [f] = found;
  const shortValue = f!.value.length <= 40 && !/[?¿!¡]/.test(f!.value);
  return BLANKISH.test(f!.value) || (shortValue && f!.label.split(/\s+/).length <= 3) ? found : [];
}

const isNumberedTitle = (block: Block) =>
  block.kind === "p" &&
  (/^(\d{1,2}|[IVX]{1,4})[.)-]\s*\p{L}/u.test(block.text) || block.numbered || block.heading);

const letters = (text: string) => text.replace(/[^\p{L}]/gu, "");

/** Un título de sección: corto y con estilo de título, en negrita, en mayúsculas o numerado. */
function isTitle(block: Block): boolean {
  const text =
    block.kind === "p"
      ? block.text
      : block.rows.length === 1 && block.rows[0]!.filter(Boolean).length === 1
        ? block.rows[0]!.find(Boolean)!
        : "";
  if (!text || text.length > 80 || text.includes("\n")) return false;
  if (fieldsInText(text).length && !/:\s*$/.test(text)) return false;
  const l = letters(text);
  if (l.length < 3) return false;
  const upper = l === l.toLocaleUpperCase("es") && l !== l.toLocaleLowerCase("es");
  const numbered = /^(\d{1,2}|[IVX]{1,4})[.)-]\s*\p{L}/u.test(text);
  if (block.kind === "table") return upper || numbered;
  return block.heading || block.bold || upper || (block.numbered && text.length <= 50) || numbered;
}

const titleText = (block: Block) =>
  (block.kind === "p" ? block.text : block.rows[0]!.find(Boolean)!)
    .replace(/:\s*$/, "")
    // "1. SABERES PREVIOS" → "SABERES PREVIOS": la numeración la pone el documento.
    .replace(/^(\d{1,2}|[IVX]{1,4})[.)-]\s*/u, "")
    .trim();

const bodyText = (blocks: Block[]) =>
  blocks
    .map((b) =>
      b.kind === "p" ? b.text : b.rows.map((r) => r.filter(Boolean).join(" | ")).join("\n"),
    )
    .filter((t) => t && !BLANKISH.test(t))
    .join("\n")
    .slice(0, 3000);

export function detectStructure({ pageHeader, body }: DocxBlocks): Detection {
  const warnings: string[] = [];
  const fields: DetectedField[] = pageHeader.flatMap(fieldsIn);
  const titleLines = pageHeader
    .filter((b) => b.kind === "p" && !fieldsIn(b).length)
    .map((b) => (b as { text: string }).text);

  // Zona del encabezado: desde el inicio hasta el último bloque con campos, antes del contenido.
  let headerEnd = -1;
  for (let i = 0; i < body.length && i < 25; i++) {
    const block = body[i]!;
    if (isTitle(block) && isNumberedTitle(block)) break;
    if (fieldsIn(block).length) headerEnd = i;
    else if (block.kind === "p" && block.text.length > 200) break;
  }
  for (let i = 0; i <= headerEnd; i++) {
    const block = body[i]!;
    const found = fieldsIn(block);
    if (found.length) fields.push(...found);
    else if (block.kind === "p") titleLines.push(block.text);
  }

  const rest = body.slice(headerEnd + 1);
  // Si los títulos van numerados ("1. SABERES PREVIOS"), solo esos son secciones: los demás títulos
  // son el nombre de la guía (antes) o subtítulos dentro de una sección (después).
  const numberedOnly = rest.filter((b) => isTitle(b) && isNumberedTitle(b)).length >= 2;
  const sections: DetectedSection[] = [];
  let current: { title: string; blocks: Block[] } | null = null;
  for (const block of rest) {
    if (isTitle(block) && (!numberedOnly || isNumberedTitle(block))) {
      if (current) sections.push({ title: current.title, body: bodyText(current.blocks) });
      current = { title: titleText(block), blocks: [] };
    } else if (current) current.blocks.push(block);
    // Lo que va antes del primer título y después del encabezado (p. ej. el título de la guía).
    else if (block.kind === "p") titleLines.push(block.text);
  }
  if (current) sections.push({ title: current.title, body: bodyText(current.blocks) });

  // Campos repetidos (el mismo campo en el encabezado de página y en el cuerpo) cuentan una vez.
  const unique = fields.filter(
    (f, i) => fields.findIndex((g) => plain(g.label) === plain(f.label)) === i,
  );
  if (unique.length > MAX_HEADER_FIELDS) {
    warnings.push(
      `El encabezado tenía ${unique.length} campos; se tomaron los primeros ${MAX_HEADER_FIELDS}.`,
    );
  }
  const uniqueSections = sections.filter(
    (s, i) => sections.findIndex((t) => plain(t.title) === plain(s.title)) === i,
  );
  if (uniqueSections.length > MAX_SECTIONS) {
    warnings.push(
      `Se encontraron ${uniqueSections.length} secciones; se tomaron las primeras ${MAX_SECTIONS}.`,
    );
  }
  if (!uniqueSections.length) {
    warnings.push("No encontramos títulos de sección: agrega las secciones de tu formato.");
  }
  return {
    fields: unique.slice(0, MAX_HEADER_FIELDS),
    sections: uniqueSections.slice(0, MAX_SECTIONS),
    titleLines: titleLines.filter((t) => t.length <= 120).slice(0, 5),
    warnings,
  };
}

// --- Propuesta sin IA (respaldo y punto de partida) -------------------------------------------

const SOURCE_HINTS: [RegExp, FieldSource][] = [
  [/\bsede\b/, "CAMPUS"],
  [/institucion|colegio|establecimiento/, "INSTITUTION"],
  [/docente|profesor|maestr|orientador|facilitador/, "TEACHER"],
  [/estudiante|alumn|nombre|apellido|integrante/, "BLANK"],
  [/area|asignatura|materia|disciplina/, "SUBJECT"],
  [/grado y grupo|curso/, "GRADE_GROUP"],
  [/grado/, "GRADE"],
  [/grupo/, "GROUP"],
  [/periodo/, "PERIOD"],
  [/tema|eje tematico|contenido/, "TOPIC"],
  [/\bano\b|vigencia/, "YEAR"],
  [/titulo|nombre de la guia/, "TITLE"],
];

export function guessSource(label: string): FieldSource {
  const p = plain(label);
  return SOURCE_HINTS.find(([re]) => re.test(p))?.[1] ?? "BLANK";
}

const TEXT_HINTS = /concept|teori|introduc|criterio|lectura|marco|explicacion|fundamenta/;
const FIXED_HINTS = /autoevalu|coevalu|rubrica|compromiso|bibliograf|webgraf|referencia/;

export function guessKind(section: DetectedSection): SectionKind {
  const p = plain(section.title);
  if (section.body.length >= 15 && FIXED_HINTS.test(p)) return "FIXED";
  return TEXT_HINTS.test(p) ? "TEXT" : "ACTIVITIES";
}

export function heuristicStructure(detection: Detection): FormatStructure {
  const sections = detection.sections.length
    ? detection.sections.map((s) => ({
        title: s.title.slice(0, 120),
        kind: guessKind(s),
        purpose: "",
        text: s.body,
      }))
    : [{ title: "Actividades", kind: "ACTIVITIES" as const, purpose: "", text: "" }];
  if (!sections.some((s) => s.kind === "ACTIVITIES")) {
    const first = sections.find((s) => s.kind !== "FIXED") ?? sections[0]!;
    first.kind = "ACTIVITIES";
  }
  return {
    header: detection.fields.map((f) => ({
      label: f.label.slice(0, 80),
      source: guessSource(f.label),
    })),
    // Solo las fijas conservan su texto; en las demás lo genera la IA.
    sections: sections.map((s) => ({ ...s, text: s.kind === "FIXED" ? s.text : "" })),
  };
}
