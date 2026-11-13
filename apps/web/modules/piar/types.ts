// Tipos del PIAR seguros para el navegador (SPEC-0017).
import type { PiarContent } from "./schemas";

export type PiarSummary = {
  id: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  academicYear: string;
  updatedAt: Date;
  expiresAt: Date;
};

export type PiarDetail = {
  id: string;
  course: { id: string; title: string; subjectName: string; gradeLabel: string };
  academicYear: string;
  content: PiarContent;
  consentAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  /** Temas activos de cada periodo, para la propuesta con IA y como guía (no se guardan aquí). */
  topicsByPeriod: Record<number, string[]>;
};
