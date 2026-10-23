/** Nombre para comparar unicidad: sin acentos, minúsculas y espacios colapsados. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Limpia espacios de un texto de usuario. */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
// Teléfonos colombianos (10 dígitos, desde 2021 también los fijos), con separadores. Un umbral
// más bajo borraría cantidades de los talleres de matemáticas (p. ej. 1.000.000).
const LONG_NUMBER = /\+?\d[\d\s().-]{5,}\d/g;

/**
 * Quita correos y números de teléfono de un texto libre antes de enviarlo a
 * un modelo de IA (SPEC-0008 §9). No detecta nombres: la UI pide no escribirlos.
 */
export function redactContactData(value: string): string {
  return value
    .replace(EMAIL, "[correo omitido]")
    .replace(LONG_NUMBER, (match) =>
      match.replace(/\D/g, "").length >= 10 ? "[número omitido]" : match,
    );
}
