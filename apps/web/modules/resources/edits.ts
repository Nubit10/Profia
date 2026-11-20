import type { ResourceContent } from "./types";

// SPEC-0021: qué cambió el docente entre la versión de la IA y la última. Lo usan las señales para
// proponer preferencias (RN-01) y las métricas implícitas (RN-15). Funciones puras, sin la base.

/** Ediciones menores a esto (tildes, una coma) no cuentan como señal (§7). */
export const MIN_EDIT_RATIO = 0.1;
/** Largo máximo de cada texto que se compara y que viaja al AI Engine (contrato v1). */
export const MAX_ITEM_TEXT = 600;

const compact = (value: string) => value.replace(/\s+/g, " ").trim();

/** Texto de cada ítem por su id estable: lo que el docente ve y edita. */
export function itemTexts(data: ResourceContent): Map<string, string> {
  const texts = new Map<string, string>();
  if (data.type === "QUIZ") {
    for (const q of data.content.questions) {
      const options = q.options.length ? ` Opciones: ${q.options.join(" | ")}` : "";
      texts.set(q.id, compact(`${q.stem}${options}`));
    }
  } else if (data.type === "EXAM") {
    for (const q of data.content.sections.flatMap((s) => s.questions)) {
      const options = q.options.length ? ` Opciones: ${q.options.join(" | ")}` : "";
      const pairs = q.pairs.length
        ? ` Parejas: ${q.pairs.map((p) => `${p.left} → ${p.right}`).join(" | ")}`
        : "";
      texts.set(q.id, compact(`${q.stem}${options}${pairs}`));
    }
  } else if (data.type === "LESSON_PLAN") {
    // SPEC-0024: sin ids por ítem; las sesiones y los criterios van por su posición.
    for (const ses of data.content.sessions) {
      texts.set(
        `session-${ses.number}`,
        compact(`${ses.title}. ${ses.start} ${ses.development} ${ses.closure}`),
      );
    }
    data.content.rubric.forEach((r, i) =>
      texts.set(
        `rubric-${i + 1}`,
        compact(`${r.criterion}: ${r.superior} | ${r.high} | ${r.basic} | ${r.low}`),
      ),
    );
  } else {
    for (const a of data.content.moments.flatMap((m) => m.activities)) {
      texts.set(a.id, compact(`${a.title}. ${a.instructions}`));
    }
  }
  return texts;
}

/** Distancia de edición (Levenshtein) dividida por el largo mayor: 0 = igual, 1 = todo distinto. */
export function editRatio(a: string, b: string): number {
  const x = a.slice(0, MAX_ITEM_TEXT);
  const y = b.slice(0, MAX_ITEM_TEXT);
  if (x === y) return 0;
  if (!x.length || !y.length) return 1;
  let previous = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[y.length]! / Math.max(x.length, y.length);
}

export type ItemEdit = { id: string; before: string; after: string; ratio: number };

export type VersionDiff = {
  /** Ítems que siguen y cambiaron al menos `MIN_EDIT_RATIO`. */
  edited: ItemEdit[];
  /** Proporción media editada sobre los ítems de la IA que siguen (0 a 1). */
  editedShare: number;
  deleted: number;
  added: number;
};

/** Compara la versión de la IA con la última del docente, ítem por ítem (por id estable). */
export function compareVersions(
  generated: ResourceContent,
  latest: ResourceContent,
  skip: ReadonlySet<string> = new Set(),
): VersionDiff {
  const before = itemTexts(generated);
  const after = itemTexts(latest);
  const edited: ItemEdit[] = [];
  let ratios = 0;
  let kept = 0;
  for (const [id, text] of before) {
    const next = after.get(id);
    if (next === undefined || skip.has(id)) continue;
    const ratio = editRatio(text, next);
    kept += 1;
    ratios += ratio;
    if (ratio >= MIN_EDIT_RATIO) {
      edited.push({
        id,
        before: text.slice(0, MAX_ITEM_TEXT),
        after: next.slice(0, MAX_ITEM_TEXT),
        ratio,
      });
    }
  }
  return {
    edited,
    editedShare: kept ? ratios / kept : 0,
    deleted: [...before.keys()].filter((id) => !after.has(id)).length,
    added: [...after.keys()].filter((id) => !before.has(id)).length,
  };
}
