// Tipos de recursos seguros para el navegador (SPEC-0008).
import type { Grade } from "@/modules/courses/client";
import type { FormatScope, FormatSnapshot } from "@/modules/formats/client";
import type {
  Blueprint,
  ExamContent,
  GradingScale,
  QuizContent,
  ResourceType,
  WorkshopContent,
} from "./schemas";

export type ResourceStatus = "GENERATING" | "FAILED" | "DRAFT" | "READY" | "ARCHIVED";
export type FailureReason = "unavailable" | "invalid" | "interrupted";

export type ResourceSummary = {
  id: string;
  type: ResourceType;
  status: ResourceStatus;
  title: string;
  topicTitle: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Copia del contexto usado para generar (RN-09). */
export type ResourceContextSnapshot = {
  subject: string;
  grade: string;
  /** Tema principal; en un examen, `title` resume todos sus temas. */
  topic: { id: string; title: string; description: string | null };
  /** Examen (SPEC-0011 RN-12): copia de todos sus temas y de sus periodos. */
  topics?: { id: string; title: string; description: string | null }[];
  periods?: string[];
  objectives: { id: string; statement: string }[];
  dba: { code: string; number: number; statement: string }[];
};

export type ResourceContent =
  | { type: "QUIZ"; content: QuizContent }
  | { type: "WORKSHOP"; content: WorkshopContent }
  | { type: "EXAM"; content: ExamContent };

export type ResourceDetail = ResourceSummary & {
  courseId: string;
  failureReason: FailureReason | null;
  blueprint: Blueprint;
  context: ResourceContextSnapshot;
  version: number;
  model: string | null;
  promptVersion: string | null;
  data: ResourceContent | null;
  /** Formato propio usado para el taller (SPEC-0010 RN-05); null = estructura estándar. */
  format: FormatSnapshot | null;
  rating: number | null;
  ratingComment: string | null;
  itemFeedback: Record<string, { rating: "UP" | "DOWN"; comment: string | null }>;
  /** El docente dueño puede editar; un administrador solo mira (SPEC-0008 §3). */
  canEdit: boolean;
  /** Examen: escala de notas de la clave (SPEC-0011 RN-14). */
  gradingScale: GradingScale | null;
};

export type TeacherPreferenceView = {
  id: string;
  text: string;
  scope: "COURSE" | "ALL";
  active: boolean;
};

export type ResourceFormContext = {
  courseId: string;
  grade: Grade;
  gradeLabel: string;
  subject: string;
  topic: { id: string; title: string };
  objectives: { id: string; statement: string; dbaCodes: string[] }[];
  hasDba: boolean;
  preferences: TeacherPreferenceView[];
  /** Formatos propios e institucionales que puede usar (SPEC-0010). */
  formats: {
    id: string;
    name: string;
    scope: FormatScope;
    sections: { title: string; kind: "ACTIVITIES" | "TEXT" | "FIXED" }[];
  }[];
  defaultFormatId: string | null;
  quota: { used: number; limit: number; inFlight: number; maxInFlight: number };
};

/** Datos del asistente para un examen (SPEC-0011): varios temas del mismo curso. */
export type ExamFormContext = {
  courseId: string;
  grade: Grade;
  gradeLabel: string;
  subject: string;
  topics: {
    id: string;
    title: string;
    unitTitle: string;
    periodName: string | null;
    objectives: { id: string; statement: string; dbaCodes: string[] }[];
  }[];
  hasDba: boolean;
  preferences: TeacherPreferenceView[];
  quota: { used: number; limit: number; inFlight: number; maxInFlight: number; cost: number };
};

export type ItemProposal = {
  regenerationId: string;
  itemKey: string;
  item: unknown;
};

export type RegenerateResult =
  { status: "ok"; proposal: ItemProposal } | { status: "unavailable" } | { status: "invalid" };

/** Cupo de recursos con IA para el menú (SPEC-0012 RN-12). `freesAt` solo si se acabó. */
export type QuotaStatus = { used: number; limit: number; freesAt: Date | null };

/** Recurso en "Mis recursos" y en el Inicio, con su curso (SPEC-0012 RN-13). */
export type ResourceListItem = ResourceSummary & {
  courseId: string;
  courseTitle: string;
  subjectId: string;
};

/** Siguiente paso del Inicio (SPEC-0012 RN-02). */
export type NextStep =
  | { kind: "CREATE_COURSE" }
  | { kind: "PLAN"; courseId: string; courseTitle: string }
  | {
      kind: "FIRST_WORKSHOP";
      courseId: string;
      courseTitle: string;
      topicId: string;
      topicTitle: string;
    }
  | { kind: "OPEN_LAST"; resource: ResourceListItem };

export type TeacherHome = {
  nextStep: NextStep;
  courses: {
    id: string;
    title: string;
    subjectId: string;
    subjectName: string;
    academicYear: string;
    topicCount: number;
  }[];
  recent: ResourceListItem[];
};
