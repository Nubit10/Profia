import { z } from "zod";
import { CURRICULUM_AREA_IDS } from "@/lib/curriculum-areas";

// Schemas compartidos entre formularios y servidor (SPEC-0003 §5). Sin dependencias de servidor.

export const GRADES = [
  "JARDIN",
  "TRANSICION",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "G10",
  "G11",
] as const;
export type Grade = (typeof GRADES)[number];

/** RN-03: etiquetas que ve el docente. */
export const GRADE_LABELS: Record<Grade, string> = {
  JARDIN: "Jardín",
  TRANSICION: "Transición",
  G1: "1°",
  G2: "2°",
  G3: "3°",
  G4: "4°",
  G5: "5°",
  G6: "6°",
  G7: "7°",
  G8: "8°",
  G9: "9°",
  G10: "10°",
  G11: "11°",
};

export const currentAcademicYear = () => String(new Date().getFullYear());

export const subjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre es demasiado largo"),
});

const courseFields = z.object({
  subjectId: z.string().min(1, "Elige la asignatura"),
  grade: z.enum(GRADES, "Elige el grado"),
  groupName: z.string().trim().max(20, "El grupo es demasiado largo").default(""),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(-\d{4})?$/, "Usa el formato 2026 o 2026-2027"),
  campusId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const courseSchema = courseFields;
export const updateCourseSchema = courseFields.extend({ courseId: z.string().min(1) });
export const courseArchiveSchema = z.object({ courseId: z.string().min(1), archived: z.boolean() });
export const subjectArchiveSchema = z.object({
  subjectId: z.string().min(1),
  archived: z.boolean(),
});

export const subjectAreaSchema = z.object({
  subjectId: z.string().min(1),
  areaId: z.enum(CURRICULUM_AREA_IDS).nullable(),
});

export type CourseInput = z.input<typeof courseSchema>;
export type SubjectInput = z.input<typeof subjectSchema>;

/** "Matemáticas · 6° · 601" */
export function courseTitle(course: { subjectName: string; grade: Grade; groupName: string }) {
  return [course.subjectName, GRADE_LABELS[course.grade], course.groupName || null]
    .filter(Boolean)
    .join(" · ");
}
