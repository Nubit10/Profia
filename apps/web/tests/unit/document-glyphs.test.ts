import { readFileSync } from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";
import vfs from "pdfmake/build/vfs_fonts";
import { describe, expect, it } from "vitest";

// SPEC-0011 T10: la Roboto que trae pdfmake no tiene todos los símbolos; uno que falte sale como un
// cuadro en el PDF (pasó con la flecha "→" de la clave del emparejamiento). Todo carácter no ASCII
// que el código de documentos escribe debe existir en la fuente.

const ROOT = path.resolve(__dirname, "../..");
const FILES = [
  "modules/documents/build.ts",
  "modules/documents/build-exam.ts",
  "modules/documents/build-piar.ts",
  "modules/documents/render-pdf.ts",
  "modules/resources/schemas.ts",
  "modules/piar/schemas.ts",
];

function codeChars(file: string): Set<string> {
  const chars = new Set<string>();
  for (const line of readFileSync(path.join(ROOT, file), "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    for (const c of line.replace(/\/\/.*$/, "")) if (c.codePointAt(0)! > 127) chars.add(c);
  }
  return chars;
}

describe("glifos de los documentos (SPEC-0011 T10)", () => {
  const files = vfs as unknown as Record<string, string>;
  const fonts = ["Roboto-Regular.ttf", "Roboto-Medium.ttf", "Roboto-Italic.ttf"].map(
    (name) => fontkit.create(Buffer.from(files[name]!, "base64")) as fontkit.Font,
  );

  it("cada carácter no ASCII de los textos de los documentos existe en la Roboto del PDF", () => {
    const missing = FILES.flatMap((file) =>
      [...codeChars(file)]
        .filter((c) => fonts.some((f) => !f.hasGlyphForCodePoint(c.codePointAt(0)!)))
        .map((c) => `${file}: «${c}» U+${c.codePointAt(0)!.toString(16).toUpperCase()}`),
    );
    expect(missing).toEqual([]);
  });

  it("la flecha no está en la fuente (por eso la clave usa un guion largo)", () => {
    expect(fonts[0]!.hasGlyphForCodePoint(0x2192)).toBe(false);
    expect(fonts[0]!.hasGlyphForCodePoint(0x2013)).toBe(true);
  });
});
