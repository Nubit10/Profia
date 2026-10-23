import "server-only";

// API pública (servidor) del módulo generation (SPEC-0007).
export { acceptSuggestion, discardSuggestion, rateSuggestion, suggestObjectives } from "./service";
export {
  requestExam,
  requestExamItem,
  requestFormatAnalysis,
  requestItem,
  requestQuiz,
  requestWorkshop,
} from "./engine";
export type * from "./engine";
export * from "./actions";
export type * from "./types";
