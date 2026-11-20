// API pública del módulo institutions segura para el navegador.
export {
  CALENDARS,
  SECTORS,
  SECTOR_LABELS,
  campusNameSchema,
  invitationSchema,
  registerSchoolSchema,
  updateSchoolSchema,
  type InvitationInput,
  type RegisterSchoolInput,
  type UpdateSchoolInput,
} from "./schemas";
export {
  BANDS_ERROR,
  DEFAULT_GRADING_BANDS,
  PERFORMANCE_LABELS,
  PERFORMANCE_LEVELS,
  SCALE_MAXIMUMS,
  bandRange,
  formatScore,
  gradingBandsSchema,
  scaleStep,
  suggestedBands,
  type GradingBands,
  type PerformanceLevel,
  type ScaleMax,
} from "./grading-scale";
