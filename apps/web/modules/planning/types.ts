// Tipos de la planeación seguros para el navegador (SPEC-0006).
import type { Grade } from "@/modules/courses/client";
import type { CurriculumReference } from "@/modules/curriculum/client";

export type PlanningLink = {
  code: string;
  number: number;
  statement: string;
  evidenceIndexes: number[];
  evidences: string[];
  superseded: boolean;
  citation: { title: string; version: string; year: number; page: number; url: string };
};

export type PlanningObjective = {
  id: string;
  statement: string;
  archived: boolean;
  links: PlanningLink[];
};

export type PlanningTopic = {
  id: string;
  title: string;
  description: string | null;
  plannedSessions: number | null;
  archived: boolean;
  objectives: PlanningObjective[];
};

export type PlanningUnit = {
  id: string;
  periodNumber: number | null;
  title: string;
  description: string | null;
  archived: boolean;
  topics: PlanningTopic[];
};

export type PlanningPeriod = {
  number: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

export type CoursePlanning = {
  course: {
    id: string;
    grade: Grade;
    groupName: string;
    academicYear: string;
    subjectId: string;
    subjectName: string;
    curriculumAreaId: string | null;
  };
  areaName: string | null;
  hasArea: boolean;
  /** RN-10: si el área tiene DBA, un objetivo sin vínculo muestra un aviso. */
  areaHasItems: boolean;
  periods: PlanningPeriod[];
  units: PlanningUnit[];
  references: CurriculumReference[];
  coverage: {
    total: number;
    covered: string[];
    pending: { code: string; number: number; statement: string }[];
  };
};

/** Temario de un curso para el asistente de creación (SPEC-0012). */
export type TopicOutline = {
  courseId: string;
  units: {
    id: string;
    title: string;
    periodNumber: number | null;
    topics: { id: string; title: string; objectiveCount: number }[];
  }[];
};
