import "server-only";

// API pública (servidor) del módulo courses (SPEC-0003).
export { seedPreloadedSubjects } from "./seed";
export {
  createCourse,
  createSubject,
  getMyCourse,
  linkSubjectToArea,
  listMyCourses,
  listSubjects,
  setCourseArchived,
  setSubjectArchived,
  updateCourse,
} from "./service";
export {
  createCourseAction,
  createSubjectAction,
  linkSubjectToAreaAction,
  setCourseArchivedAction,
  setSubjectArchivedAction,
  updateCourseAction,
} from "./actions";
