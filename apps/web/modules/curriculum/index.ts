import "server-only";

// API pública (servidor) del módulo curriculum (SPEC-0004, ADR-0005).
export {
  CurriculumImportError,
  importCurriculumFile,
  importCurriculumJson,
  parseCurriculumFile,
  type ImportReport,
} from "./importer";
export {
  getCourseReferences,
  listCurriculumSources,
  type CourseReferences,
  type CurriculumReference,
} from "./service";
export { curriculumFileSchema, documentKeyOf, type CurriculumFile } from "./file-schema";
export { searchCourseCurriculum, type CurriculumSearchResult } from "./search";
export { searchCurriculumAction } from "./actions";
