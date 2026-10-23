import type { CurriculumAreaId } from "@/lib/curriculum-areas";

// Áreas obligatorias y fundamentales de la Ley 115 de 1994 (art. 23, básica; art. 31, media académica).
// Humanidades se separa en Lengua Castellana e Inglés, como se dictan en la práctica. SPEC-0003 RN-01.
// `area`: área curricular oficial a la que se vincula sola (SPEC-0004, CA-0004-05).
export const PRELOADED_SUBJECTS: readonly { name: string; area: CurriculumAreaId | null }[] = [
  { name: "Ciencias Naturales y Educación Ambiental", area: "CIENCIAS_NATURALES" },
  { name: "Ciencias Sociales", area: "CIENCIAS_SOCIALES" },
  { name: "Educación Artística", area: null },
  { name: "Ética y Valores Humanos", area: null },
  { name: "Educación Física, Recreación y Deportes", area: null },
  { name: "Educación Religiosa", area: null },
  { name: "Lengua Castellana", area: "LENGUAJE" },
  { name: "Inglés", area: "INGLES" },
  { name: "Matemáticas", area: "MATEMATICAS" },
  { name: "Tecnología e Informática", area: null },
  { name: "Filosofía", area: null },
  { name: "Ciencias Económicas y Políticas", area: null },
];
