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
