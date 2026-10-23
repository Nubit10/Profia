import "server-only";

// API pública (servidor) del módulo formats: formato propio del docente y logo (SPEC-0010).
export {
  analyzeFormatFile,
  defaultFormatId,
  deleteFormat,
  deleteLogo,
  getFormatSnapshot,
  getLogo,
  getLogoInfo,
  listFormats,
  saveFormat,
  saveLogo,
  setDefaultFormat,
} from "./service";
export * from "./actions";
export type * from "./types";
