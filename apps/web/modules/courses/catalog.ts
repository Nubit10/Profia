import type { CurriculumAreaId } from "@/lib/curriculum-areas";

// Áreas obligatorias y fundamentales de la Ley 115 de 1994 (art. 23, básica; art. 31, media académica).
// Humanidades se separa en Lengua Castellana e Inglés, como se dictan en la práctica. SPEC-0003 RN-01.
// `area`: área curricular oficial a la que se vincula sola (SPEC-0004, CA-0004-05).
export const PRELOADED_SUBJECTS: readonly { name: string; area: CurriculumAreaId | null }[] = [
  { name: "Ciencias Naturales y Educación Ambiental", area: "CIENCIAS_NATURALES" },
  { name: "Ciencias Sociales", area: "CIENCIAS_SOCIALES" },
  { name: "Educación Artística", area: "ARTISTICA" },
  { name: "Ética y Valores Humanos", area: "CIUDADANAS" },
  { name: "Educación Física, Recreación y Deportes", area: "EDUCACION_FISICA" },
  { name: "Educación Religiosa", area: null },
  { name: "Lengua Castellana", area: "LENGUAJE" },
  { name: "Inglés", area: "INGLES" },
  { name: "Matemáticas", area: "MATEMATICAS" },
  { name: "Tecnología e Informática", area: "TECNOLOGIA" },
  { name: "Filosofía", area: "FILOSOFIA" },
  { name: "Ciencias Económicas y Políticas", area: null },
  // SPEC-0036: como se llaman en muchos colegios en 10° y 11°; ven los DBA y Estándares de su área.
  { name: "Biología", area: "CIENCIAS_NATURALES" },
  { name: "Física", area: "CIENCIAS_NATURALES" },
  { name: "Química", area: "CIENCIAS_NATURALES" },
  { name: "Historia", area: "CIENCIAS_SOCIALES" },
  { name: "Geografía", area: "CIENCIAS_SOCIALES" },
  // SPEC-0038: obligatoria desde la Ley 1732 de 2014; ve los Estándares de Competencias Ciudadanas.
  { name: "Cátedra de la Paz", area: "CIUDADANAS" },
];
