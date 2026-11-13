// Tipos mínimos de fontkit (no trae los suyos), solo lo que usa tests/unit/document-glyphs.test.ts.
declare module "fontkit" {
  export interface Font {
    hasGlyphForCodePoint(codePoint: number): boolean;
  }
  export function create(buffer: Buffer): Font;
}
