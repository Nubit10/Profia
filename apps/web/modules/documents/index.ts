import "server-only";

// API pública (servidor) del módulo documents: exportar recursos a DOCX y PDF (SPEC-0009).
export { safeFilename } from "./filename";
export { exportResource, type ExportRequest, type ExportedFile } from "./service";
export { VARIANTS, type Variant } from "./shuffle";
