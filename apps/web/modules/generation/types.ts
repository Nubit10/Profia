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
