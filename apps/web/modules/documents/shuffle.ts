// Barajado determinista para las versiones del quiz (SPEC-0009 RN-07): la misma semilla da siempre
// el mismo orden, así la hoja B y su clave coinciden aunque se descarguen por separado.

export const VARIANTS = ["A", "B", "C", "D"] as const;
export type Variant = (typeof VARIANTS)[number];

/** FNV-1a de 32 bits. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: generador pseudoaleatorio pequeño y suficiente para barajar. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates con semilla. Si con 2 o más elementos el resultado queda igual al original, se rota
 * una posición: una versión distinta debe verse distinta.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const next = random(hash(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  if (out.length > 1 && out.every((item, i) => item === items[i])) out.push(out.shift()!);
  return out;
}
