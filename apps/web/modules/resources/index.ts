import "server-only";

// API pública (servidor) del módulo resources: talleres y quices (SPEC-0008).
export {
  DAILY_LIMIT,
  MAX_IN_FLIGHT,
  addPreference,
  createResource,
  decideRegeneration,
  deletePreference,
  duplicateResource,
  getExamFormContext,
  getResource,
  getResourceForExport,
  getResourceFormContext,
  getResourceStatus,
  listCourseResources,
  listPreferences,
  rateItem,
  rateResource,
  regenerateItem,
  retryResource,
  runGeneration,
  saveResourceContent,
  setGradingScale,
  setResourceStatus,
  updatePreference,
  type GenerationDeps,
  type Scheduler,
} from "./service";
export { promptQualityMetrics } from "./metrics";
export { getQuotaStatus, getTeacherHome, listMyResources } from "./overview";
export * from "./actions";
export type * from "./types";
