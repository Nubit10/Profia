import "server-only";

// API pública (servidor) del módulo planning (SPEC-0006).
export {
  getCoursePlanning,
  getTopicGenerationContext,
  getTopicPeriodName,
  getTopicsGenerationContext,
  getUnitCourseId,
  listCopyTargets,
  type TopicsGenerationContext,
} from "./read";
export { ensureDefaultPeriods, setCoursePeriods } from "./periods";
export {
  createObjective,
  createTopic,
  createUnit,
  moveItem,
  setItemArchived,
  updateObjective,
  updateTopic,
  updateUnit,
} from "./structure";
export { copyPlanning } from "./copy";
export { acceptPlanningProposal, type AcceptProposalResult } from "./proposal";
export { splitDbaByPeriod } from "./distribution";
export { createQuickTopic, listTopicOutline } from "./outline";
export * from "./actions";
export type * from "./types";
