import "server-only";

// API pública (servidor) del módulo documents: exportar recursos a DOCX y PDF (SPEC-0009).
export { safeFilename } from "./filename";
export {
  exportBundle,
  exportPiar,
  exportResource,
  type BundleRequest,
  type ExportRequest,
  type ExportedFile,
} from "./service";
export { VARIANTS, type Variant } from "./shuffle";
export {
  listOfflineLibrary,
  recordOfflineSync,
  type OfflineEntry,
  type OfflineFile,
} from "./offline";
export { offlineLibraryAction, recordOfflineSyncAction } from "./actions";
