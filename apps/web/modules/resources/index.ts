import "server-only";

// API pública (servidor) del módulo resources: talleres y quices (SPEC-0008).
export {
  DAILY_LIMIT,
  MAX_IN_FLIGHT,
  addPreference,
  copyResourceToCourses,
  createResource,
  decideAdjustment,
  decideRegeneration,
  deletePreference,
  duplicateResource,
  getExamFormContext,
  getResource,
  getResourceForExport,
  getResourceFormContext,
  getResourceStatus,
  listCourseResources,
  listResourceCopyTargets,
  listPreferences,
  rateItem,
  rateResource,
  regenerateItem,
  requestAdjustment,
  retryResource,
  runGeneration,
  saveResourceContent,
  setGradingScale,
  setResourceStatus,
  updatePreference,
  type GenerationDeps,
  type Scheduler,
} from "./service";
export { groupByPlan } from "./grouping";
export {
  acceptPreferenceSuggestion,
  declinePreferenceSuggestion,
  maybeProposePreferences,
  pendingPreferenceSuggestions,
  schedulePreferenceCheck,
} from "./suggestions";
export { preferenceSuggestionMetrics, promptQualityMetrics } from "./metrics";
export { createResourceQuick, type QuickResourceInput } from "./quick";
export { getQuotaStatus, getTeacherHome, listMyResources, watchGenerations } from "./overview";
export * from "./actions";
export type * from "./types";
