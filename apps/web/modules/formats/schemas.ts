import { z } from "zod";

// Formato propio del docente (SPEC-0010). Sin dependencias de servidor: el mismo schema valida el
// editor del formato y la server action.

export const FIELD_SOURCES = [
  "INSTITUTION",
  "CAMPUS",
  "TEACHER",
  "SUBJECT",
  "GRADE",
  "GROUP",
  "GRADE_GROUP",
  "PERIOD",
  "TOPIC",
  "YEAR",
  "DATE",
  "TITLE",
  "BLANK",
] as const;
export type FieldSource = (typeof FIELD_SOURCES)[number];

export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  INSTITUTION: "Institución",
  CAMPUS: "Sede",
  TEACHER: "Docente",
  SUBJECT: "Asignatura",
  GRADE: "Grado",
  GROUP: "Grupo",
  GRADE_GROUP: "Grado y grupo",
  PERIOD: "Periodo",
  TOPIC: "Tema",
  YEAR: "Año",
  DATE: "Fecha de descarga",
  TITLE: "Título del taller",
  BLANK: "En blanco (lo llena el estudiante)",
};

export const SECTION_KINDS = ["ACTIVITIES", "TEXT", "FIXED"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  ACTIVITIES: "Actividades (las crea la IA)",
  TEXT: "Texto (lo escribe la IA)",
  FIXED: "Fijo (se copia tal cual)",
};

export const MAX_HEADER_FIELDS = 16;
export const MAX_SECTIONS = 10;

export const headerFieldSchema = z.object({
  label: z.string().trim().min(1, "Escribe la etiqueta").max(80, "Máximo 80 caracteres"),
  source: z.enum(FIELD_SOURCES),
});

export const sectionSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe el título").max(120, "Máximo 120 caracteres"),
    kind: z.enum(SECTION_KINDS),
    purpose: z.string().trim().max(300, "Máximo 300 caracteres").default(""),
    /** Texto de las secciones fijas (RN-02: nunca va a la IA). */
    text: z.string().trim().max(3000, "Máximo 3000 caracteres").default(""),
  })
  .superRefine((s, ctx) => {
    if (s.kind === "FIXED" && !s.text) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: "Una sección fija necesita su texto",
      });
    }
  });

/** RN-04: entre 1 y 10 secciones, al menos una de actividades; máximo 16 campos. */
export const formatStructureSchema = z
  .object({
    header: z.array(headerFieldSchema).max(MAX_HEADER_FIELDS, "Máximo 16 campos"),
    sections: z
      .array(sectionSchema)
      .min(1, "El formato necesita al menos una sección")
      .max(MAX_SECTIONS, "Máximo 10 secciones"),
  })
  .superRefine((f, ctx) => {
    if (!f.sections.some((s) => s.kind === "ACTIVITIES")) {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: "Al menos una sección debe ser de actividades",
      });
    }
    const titles = f.sections.map((s) => s.title.toLocaleLowerCase("es"));
    if (new Set(titles).size !== titles.length) {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: "Hay secciones con el mismo título",
      });
    }
  });
export type FormatStructure = z.output<typeof formatStructureSchema>;
export type FormatStructureInput = z.input<typeof formatStructureSchema>;

export const FORMAT_SCOPES = ["TEACHER", "INSTITUTION"] as const;
export type FormatScope = (typeof FORMAT_SCOPES)[number];

export const saveFormatSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
  scope: z.enum(FORMAT_SCOPES),
  structure: formatStructureSchema,
});
export type SaveFormatInput = z.input<typeof saveFormatSchema>;

/** RN-07 y RN-09: límites de archivos. */
export const MAX_FORMAT_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_BYTES = 500 * 1024;
export const MAX_LOGO_SIDE = 2000;
