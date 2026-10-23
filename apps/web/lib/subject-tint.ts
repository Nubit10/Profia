// Color estable por asignatura (SPEC-0012): la misma asignatura siempre tiene el mismo tinte, para
// que el docente reconozca sus cursos de un vistazo. Los tintes son tokens de globals.css.

const TINTS = [
  { bg: "bg-tint-1", fg: "text-tint-1-fg" },
  { bg: "bg-tint-2", fg: "text-tint-2-fg" },
  { bg: "bg-tint-3", fg: "text-tint-3-fg" },
  { bg: "bg-tint-4", fg: "text-tint-4-fg" },
  { bg: "bg-tint-5", fg: "text-tint-5-fg" },
  { bg: "bg-tint-6", fg: "text-tint-6-fg" },
] as const;

export function subjectTint(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length]!;
}
