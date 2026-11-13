import "server-only";

// API pública (servidor) del módulo generation (SPEC-0007).
export { acceptSuggestion, discardSuggestion, rateSuggestion, suggestObjectives } from "./service";
export { MAX_BATCH_TOPICS, proposeObjectivesBatch } from "./objectives-batch";
export { PROPOSALS_PER_DAY, PROPOSALS_PER_MINUTE, proposePlanning } from "./planning";
export { proposePiarAdjustments } from "./piar";
export {
  requestExam,
  requestExamItem,
  requestFormatAnalysis,
  requestItem,
  requestPlanning,
  requestQuiz,
  requestWorkshop,
} from "./engine";
export type * from "./engine";
export * from "./actions";
export type * from "./types";
