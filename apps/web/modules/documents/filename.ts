import type { DocFormat } from "./model";

/** RN-06: nombre legible y válido en Windows, macOS y Linux. */
export function safeFilename(parts: string[], format: DocFormat): string {
  const base = parts
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  return `${base}.${format}`;
}
