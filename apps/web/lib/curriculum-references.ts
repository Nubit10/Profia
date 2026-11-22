// Referentes del catálogo: cuáles guían la planeación de un curso y cómo se nombran (SPEC-0039).
// Datos puros: los usan servidor, navegador y documentos.

export type ReferenceType = "DBA" | "STANDARD" | "ORIENTATION";

/**
 * Referentes con que Lucía planea y genera en un curso: los DBA del grado; si el área no tiene DBA
 * para ese grado (Ética, Cátedra de la Paz, Tecnología, Inglés 1°-5°…), sus Estándares y
 * Orientaciones. Conserva el orden recibido.
 */
export function baseReferences<T extends { type: ReferenceType }>(references: readonly T[]): T[] {
  const dba = references.filter((r) => r.type === "DBA");
  return dba.length > 0 ? dba : references.filter((r) => r.type !== "DBA");
}

/**
 * Tipo de un referente por su código (`MEN-DBA-…`, `MEN-EBC-…`, `MEN-ORI-…`). Los recursos guardan
 * solo el código y el número de sus referentes; así una etiqueta vieja sigue diciendo «DBA».
 */
export function referenceType(code: string): ReferenceType {
  if (/(^|-)EBC-/.test(code)) return "STANDARD";
  if (/(^|-)ORI-/.test(code)) return "ORIENTATION";
  return "DBA";
}

const NOUN: Record<ReferenceType, [singular: string, plural: string]> = {
  DBA: ["DBA", "DBA"],
  STANDARD: ["Estándar", "Estándares"],
  ORIENTATION: ["Orientación", "Orientaciones"],
};

/** «DBA 3», «Estándar 12», «Orientación 5». */
export function referenceLabel(code: string, number: number | string): string {
  return `${NOUN[referenceType(code)][0]} ${number}`;
}

/** Nombre del tipo, en singular o plural: «DBA», «Estándares», «Orientaciones». */
export function referenceNoun(type: ReferenceType, plural = false): string {
  return NOUN[type][plural ? 1 : 0];
}

/** Cómo llamar a los referentes base de un curso: «DBA», «Estándares» u «Orientaciones del MEN». */
export function baseReferencesNoun(references: readonly { type: ReferenceType }[]): string {
  const base = baseReferences(references);
  if (base.length === 0 || base[0]!.type === "DBA") return "DBA";
  return base.every((r) => r.type === "ORIENTATION") ? "Orientaciones del MEN" : "Estándares";
}

/** Un referente tal como viaja al AI Engine. `kind` solo va cuando no es DBA (contratos aditivos). */
export type EngineReference = {
  code: string;
  statement: string;
  evidences: string[];
  kind?: "STANDARD" | "ORIENTATION";
};

export function engineReference(ref: {
  code: string;
  statement: string;
  evidences: string[];
}): EngineReference {
  const kind = referenceType(ref.code);
  const base = { code: ref.code, statement: ref.statement, evidences: ref.evidences };
  return kind === "DBA" ? base : { ...base, kind };
}

/** Título de la lista que acompaña a un referente en sus fichas (SPEC-0036/0037/0038). */
export function evidencesTitle(ref: { code: string; evidences: readonly string[] }): string {
  switch (referenceType(ref.code)) {
    case "DBA":
      return "Evidencias de aprendizaje";
    case "STANDARD":
      // En Inglés (Guía 22), las competencias que desarrolla; en las demás áreas, el estándar general.
      return ref.evidences.every((e) => e.startsWith("Competencia "))
        ? "Competencias que desarrolla"
        : "Estándar del grupo de grados";
    case "ORIENTATION":
      return "Competencia a la que apunta";
  }
}
