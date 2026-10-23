// Áreas curriculares oficiales (SPEC-0004). Deben coincidir con las filas de `curriculum_areas`
// insertadas en la migración `curriculum_catalog`. Datos puros: los usan servidor y formularios.

export const CURRICULUM_AREAS = [
  { id: "MATEMATICAS", name: "Matemáticas" },
  { id: "LENGUAJE", name: "Lenguaje" },
  { id: "CIENCIAS_NATURALES", name: "Ciencias Naturales" },
  { id: "CIENCIAS_SOCIALES", name: "Ciencias Sociales" },
  { id: "INGLES", name: "Inglés" },
  { id: "TRANSICION", name: "Transición (todas las dimensiones)" },
] as const;

export type CurriculumAreaId = (typeof CURRICULUM_AREAS)[number]["id"];

export const CURRICULUM_AREA_IDS = CURRICULUM_AREAS.map((a) => a.id) as [
  CurriculumAreaId,
  ...CurriculumAreaId[],
];

/** Áreas que un docente puede elegir para una asignatura (Transición aplica por grado, no por área). */
export const LINKABLE_AREAS = CURRICULUM_AREAS.filter((a) => a.id !== "TRANSICION");

export function areaName(id: string | null | undefined): string | null {
  return CURRICULUM_AREAS.find((a) => a.id === id)?.name ?? null;
}
