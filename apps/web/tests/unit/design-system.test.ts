import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPEC-0012 RN-09/RN-10: los colores salen de los tokens de globals.css y el degradado de marca
// tiene contraste AA con texto blanco.

const ROOT = path.resolve(__dirname, "../..");

function files(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(full);
  }
  return out;
}

const PALETTE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
const LITERAL = /#[0-9a-fA-F]{3,8}\b|oklch\(|rgba?\(/;

describe("colores desde tokens (CA-0012-17)", () => {
  it("CA-0012-17: app/ y components/ (salvo components/ui) no usan colores literales", () => {
    const offenders = [...files(path.join(ROOT, "app")), ...files(path.join(ROOT, "components"))]
      .filter((f) => !f.includes(`${path.sep}components${path.sep}ui${path.sep}`))
      .filter((f) => !f.endsWith("globals.css"))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .map((line, i) => ({ line, at: `${path.relative(ROOT, f)}:${i + 1}` }))
          .filter(({ line }) => !line.trim().startsWith("//"))
          .filter(({ line }) => PALETTE.test(line) || LITERAL.test(line))
          .map(({ at }) => at),
      );
    expect(offenders).toEqual([]);
  });

  it("CA-0012-17: la paleta de marca está definida como tokens", () => {
    const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
    for (const token of ["--brand-from", "--brand-via", "--brand-to", "--brand-gradient"]) {
      expect(css).toContain(`${token}:`);
    }
    for (const utility of ["bg-brand-gradient", "text-brand-gradient"]) {
      expect(css).toContain(`@utility ${utility}`);
    }
  });
});

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe("contraste del degradado (RN-10)", () => {
  it("RN-10: cada punto del degradado tiene contraste AA con blanco y con el fondo", () => {
    const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
    const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1]!;
    const surface = token("surface");
    for (const stop of ["brand-from", "brand-via", "brand-to"]) {
      expect(contrast(token(stop), "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(stop), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
