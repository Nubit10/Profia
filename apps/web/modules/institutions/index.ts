import "server-only";

// API pública (servidor) del módulo institutions (SPEC-0002).
export {
  MAIN_CAMPUS_NAME,
  createIndependentSpace,
  getSchool,
  registerSchool,
  updateSchool,
} from "./spaces";
export { createCampus, listCampuses, renameCampus, setCampusArchived } from "./campuses";
export {
  INVITATION_TTL_DAYS,
  acceptInvitation,
  createInvitation,
  getInvitationPreview,
  listPendingInvitations,
  revokeInvitation,
  type InvitationPreview,
} from "./invitations";
export { canEditGradingBands, getGradingBands, updateGradingBands } from "./grading";
export {
  DEFAULT_GRADING_BANDS,
  PERFORMANCE_LABELS,
  PERFORMANCE_LEVELS,
  bandRange,
  formatScore,
  parseGradingBands,
  type GradingBands,
  type PerformanceLevel,
} from "./grading-scale";
export { listMembers, setMemberActive, updateMemberRoles } from "./members";
export {
  acceptInvitationAction,
  createCampusAction,
  createIndependentSpaceAction,
  createInvitationAction,
  registerSchoolAction,
  renameCampusAction,
  revokeInvitationAction,
  setCampusArchivedAction,
  setMemberActiveAction,
  updateMemberRolesAction,
  updateGradingBandsAction,
  updateSchoolAction,
} from "./actions";
