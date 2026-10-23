// Tipos de formatos seguros para el navegador (SPEC-0010).
import type { FormatScope, FormatStructure } from "./schemas";

export type FormatView = {
  id: string;
  name: string;
  scope: FormatScope;
  isDefault: boolean;
  /** El dueño (formato personal) o un administrador del colegio (institucional). */
  canEdit: boolean;
  structure: FormatStructure;
  updatedAt: Date;
};

/** Lo que propone Profe al subir un archivo; el docente lo revisa antes de guardar (RN-01). */
export type FormatProposal = {
  name: string;
  structure: FormatStructure;
  /** Avisos para el docente (secciones recortadas, campos sin origen claro, IA no disponible…). */
  warnings: string[];
  aiUsed: boolean;
};

/** Copia del formato guardada en cada taller generado con él (RN-05). */
export type FormatSnapshot = { formatId: string; name: string; structure: FormatStructure };

export type LogoInfo = { mimeType: "image/png" | "image/jpeg"; width: number; height: number };
