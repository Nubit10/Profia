// Tipos de la generación con IA seguros para el navegador (SPEC-0007).

export type SuggestedObjective = {
  id: string;
  statement: string;
  dba: { code: string; number: number; statement: string }[];
};

export type ObjectiveSuggestionsResult =
  | { status: "ok"; generationId: string; model: string; suggestions: SuggestedObjective[] }
  | { status: "unavailable" }
  | { status: "invalid" };

/** Propuesta de planeación (SPEC-0014): vive solo en la pantalla de revisión (RN-02). */
export type ProposedTopic = {
  key: string;
  title: string;
  description: string;
  /** RN-01: número y enunciado salen de la base; vacío = "Sin DBA". */
  dba: { code: string; number: number; statement: string }[];
};

export type ProposedUnit = {
  key: string;
  /** Unidad existente que se completa (proponer temas de una unidad), o null si es nueva. */
  unitId: string | null;
  title: string;
  topics: ProposedTopic[];
};

export type PlanningProposal =
  | {
      status: "ok";
      generationId: string;
      courseId: string;
      periods: { number: number; name: string; units: ProposedUnit[] }[];
    }
  | { status: "unavailable" }
  | { status: "invalid" };

/** Objetivos propuestos en bloque para varios temas (SPEC-0014 RN-06). Nada está guardado. */
export type ObjectivesBatchTopic = {
  topicId: string;
  title: string;
  unitTitle: string;
  /** Objetivos que el tema ya tiene: cuentan para el máximo de 5. */
  existing: number;
  suggestions: { key: string; statement: string; dba: SuggestedObjective["dba"] }[];
};

export type ObjectivesBatchProposal =
  | {
      status: "ok";
      generationId: string;
      courseId: string;
      topics: ObjectivesBatchTopic[];
      /** Temas que no recibieron propuesta (la IA falló para ellos). */
      failed: number;
      /** Temas que ya tenían 3 objetivos o más y no se tocaron. */
      skipped: number;
    }
  | { status: "unavailable" }
  | { status: "invalid" };
