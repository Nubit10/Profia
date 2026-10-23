import "server-only";
import { db } from "@/lib/db";

// --- Métricas para mejorar los prompts (SPEC-0008 §6) ----------------------------------------

/**
 * Agregado por versión de prompt y modelo, sin datos personales ni textos. Uso interno: se revisa
 * antes de crear una versión nueva de un prompt.
 */
export async function promptQualityMetrics() {
  const logs = await db.generationLog.findMany({
    // SPEC-0011: el examen deja una fila por sección (RN-10); cuenta una vez y suma sus tokens.
    where: { task: { in: ["quiz", "workshop", "exam"] }, status: "OK", entityType: "resource" },
    select: { id: true, entityId: true, promptVersion: true, model: true, tokens: true },
  });
  const resources = await db.resource.findMany({
    where: { id: { in: logs.map((l) => l.entityId) } },
    select: {
      id: true,
      rating: true,
      currentVersion: true,
      itemFeedback: { select: { rating: true } },
      _count: { select: { regenerations: true } },
    },
  });
  const byId = new Map(resources.map((r) => [r.id, r]));
  const groups = new Map<
    string,
    {
      promptVersion: string;
      model: string;
      rows: typeof resources;
      tokensByResource: Map<string, number>;
    }
  >();
  for (const log of logs) {
    const key = `${log.promptVersion}|${log.model}`;
    const group = groups.get(key) ?? {
      promptVersion: log.promptVersion ?? "?",
      model: log.model ?? "?",
      rows: [],
      tokensByResource: new Map<string, number>(),
    };
    const resource = byId.get(log.entityId);
    if (resource && !group.tokensByResource.has(resource.id)) group.rows.push(resource);
    group.tokensByResource.set(
      log.entityId,
      (group.tokensByResource.get(log.entityId) ?? 0) + (log.tokens ?? 0),
    );
    groups.set(key, group);
  }
  return [...groups.values()].map(({ promptVersion, model, rows, tokensByResource }) => {
    const tokens = [...tokensByResource.values()].filter((t) => t > 0);
    const rated = rows.filter((r) => r.rating !== null);
    const items = rows.flatMap((r) => r.itemFeedback);
    return {
      promptVersion,
      model,
      resources: rows.length,
      rated: rated.length,
      averageRating: rated.length
        ? Math.round((rated.reduce((a, r) => a + r.rating!, 0) / rated.length) * 100) / 100
        : null,
      itemsRated: items.length,
      downRate: items.length
        ? Math.round((items.filter((i) => i.rating === "DOWN").length / items.length) * 1000) / 1000
        : null,
      editedRate: rows.length
        ? Math.round((rows.filter((r) => r.currentVersion > 1).length / rows.length) * 1000) / 1000
        : null,
      regenerations: rows.reduce((a, r) => a + r._count.regenerations, 0),
      averageTokens: tokens.length
        ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length)
        : null,
    };
  });
}
