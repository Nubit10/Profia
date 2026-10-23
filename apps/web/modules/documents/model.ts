// Modelo de documento intermedio (ADR-0009): lo construyen los constructores de cada tipo de
// recurso y lo dibujan los renderizadores DOCX y PDF. Así ambos formatos tienen el mismo
// contenido y orden (SPEC-0009 RN-03). Todo el texto es texto plano.

export type DocOption = { label: string; text: string; correct?: boolean };

export type DocBlock =
  | { kind: "heading"; text: string; level: 1 | 2 }
  | { kind: "paragraph"; text: string; tone?: "normal" | "muted" | "strong" }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | {
      kind: "question";
      number: number;
      stem: string;
      /** Opciones en una sola línea (verdadero/falso) o en columna (selección múltiple). */
      options: DocOption[];
      inline?: boolean;
      /** Líneas en blanco para responder. */
      answerLines: number;
    }
  | {
      kind: "activity";
      title: string;
      instructions: string;
      /** Datos para el docente (producto esperado, nivel, DBA); vacío en la guía del estudiante. */
      details: string[];
      answerLines: number;
    }
  | { kind: "keyTable"; rows: { number: string; answer: string; explanation: string }[] }
  | {
      /**
       * Tabla genérica (SPEC-0011): emparejamiento, puntos por sección, conversión a nota y hoja
       * de respuestas. `width` en porcentaje; `muted` atenúa la columna; `center` la centra.
       */
      kind: "table";
      columns: { title: string; width: number; muted?: boolean; center?: boolean }[];
      rows: string[][];
      /** Filas resaltadas (p. ej. la nota mínima o el total). */
      strongRows?: number[];
      /** La tabla no se parte entre páginas (emparejamiento). */
      keepTogether?: boolean;
    };

/** Logo de la institución (SPEC-0010 RN-09). */
export type DocLogo = {
  data: Buffer;
  mimeType: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

export type DocModel = {
  /** Logo y nombre de la institución arriba del encabezado (si el formato no trae ese campo). */
  logo?: DocLogo | null;
  institutionLine?: string | null;
  /** Título grande del documento, p. ej. "Quiz: La recta numérica". */
  title: string;
  /** Debajo del título: "Hoja del estudiante · Versión B", "Clave de respuestas"… */
  subtitle: string;
  /** RN-05: marca de borrador. */
  draft: boolean;
  header: { label: string; value: string }[];
  /** Espacios en blanco para el estudiante (vacío en la clave y la guía del docente). */
  studentFields: string[];
  blocks: DocBlock[];
  footer: string;
};

export type DocFormat = "pdf" | "docx";

export const LETTER = { widthPt: 612, heightPt: 792 };
/** 2 cm en puntos tipográficos. */
export const MARGIN_PT = 56.7;
