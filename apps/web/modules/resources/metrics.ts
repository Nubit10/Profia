import "server-only";
import { db } from "@/lib/db";
import { compareVersions } from "./edits";
import type { ResourceContent } from "./types";

// --- Métricas para mejorar los prompts (SPEC-0008 §6) ----------------------------------------

/**
 * Agregado por versión de prompt y modelo, sin datos personales ni textos. Uso interno: se revisa
 * antes de crear una versión nueva de un prompt.
 */
export async function promptQualityMetrics() {
  const logs = await db.generationLog.findMany({
    // SPEC-0011: el examen deja una fila por sección (RN-10); cuenta una vez y suma sus tokens.
    where: { task: { in: ["quiz", "workshop", "exam"] }, status: "OK", entityType: "resource" },
    select: {
      id: true,
      entityId: true,
      promptVersion: true,
      model: true,
      tokens: true,
      qualityWarnings: true,
    },
  });
  const resources = await db.resource.findMany({
    where: { id: { in: logs.map((l) => l.entityId) } },
    select: {
      id: true,
      type: true,
      status: true,
      rating: true,
      currentVersion: true,
      itemFeedback: { select: { rating: true } },
      _count: { select: { regenerations: true } },
    },
  });
  const byId = new Map(resources.map((r) => [r.id, r]));
  // SPEC-0021 RN-15: señales implícitas (cuánto editó, qué borró, qué usó sin cambios).
  const diffs = await implicitSignals(resources);
  const exported = new Set(
    (
      await db.auditLog.findMany({
        where: { action: "resource.exported", entityId: { in: resources.map((r) => r.id) } },
        select: { entityId: true },
        distinct: ["entityId"],
      })
    ).map((a) => a.entityId),
  );
  const groups = new Map<
    string,
    {
      promptVersion: string;
      model: string;
      rows: typeof resources;
      tokensByResource: Map<string, number>;
      warnings: number[];
    }
  >();
  for (const log of logs) {
    const key = `${log.promptVersion}|${log.model}`;
    const group = groups.get(key) ?? {
      promptVersion: log.promptVersion ?? "?",
      model: log.model ?? "?",
      rows: [],
      tokensByResource: new Map<string, number>(),
      warnings: [],
    };
    if (log.qualityWarnings !== null) group.warnings.push(log.qualityWarnings);
    const resource = byId.get(log.entityId);
    if (resource && !group.tokensByResource.has(resource.id)) group.rows.push(resource);
    group.tokensByResource.set(
      log.entityId,
      (group.tokensByResource.get(log.entityId) ?? 0) + (log.tokens ?? 0),
    );
    groups.set(key, group);
  }
  const average = (values: number[], digits = 3) =>
    values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10 ** digits) /
        10 ** digits
      : null;
  return [...groups.values()].map(({ promptVersion, model, rows, tokensByResource, warnings }) => {
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
      // SPEC-0021 RN-15.
      editedShare: average(rows.map((r) => diffs.get(r.id)?.editedShare ?? 0)),
      itemsDeleted: rows.reduce((a, r) => a + (diffs.get(r.id)?.deleted ?? 0), 0),
      itemsAdded: rows.reduce((a, r) => a + (diffs.get(r.id)?.added ?? 0), 0),
      exportedUnedited: rows.filter((r) => r.currentVersion === 1 && exported.has(r.id)).length,
      readyUnedited: rows.filter((r) => r.currentVersion === 1 && r.status === "READY").length,
      averageQualityWarnings: average(warnings, 2),
    };
  });
}

/** Diferencias entre la versión de la IA y la última de cada recurso editado (sin textos). */
async function implicitSignals(
  resources: { id: string; type: ResourceContent["type"]; currentVersion: number }[],
) {
  const edited = resources.filter((r) => r.currentVersion > 1);
  const diffs = new Map<string, ReturnType<typeof compareVersions>>();
  if (!edited.length) return diffs;
  const versions = await db.resourceVersion.findMany({
    where: {
      OR: edited.flatMap((r) => [
        { resourceId: r.id, number: 1 },
        { resourceId: r.id, number: r.currentVersion },
      ]),
    },
    select: { resourceId: true, number: true, content: true },
  });
  for (const r of edited) {
    const first = versions.find((v) => v.resourceId === r.id && v.number === 1);
    const last = versions.find((v) => v.resourceId === r.id && v.number === r.currentVersion);
    if (!first || !last) continue;
    const as = (content: unknown) => ({ type: r.type, content }) as unknown as ResourceContent;
    diffs.set(r.id, compareVersions(as(first.content), as(last.content)));
  }
  return diffs;
}

/** SPEC-0021 RN-15: cuántas preferencias propuestas se aceptan (agregado, sin textos ni ids). */
export async function preferenceSuggestionMetrics() {
  const rows = await db.preferenceSuggestion.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (status: string) => rows.find((r) => r.status === status)?._count._all ?? 0;
  const accepted = count("ACCEPTED");
  const declined = count("DECLINED");
  return {
    proposed: accepted + declined + count("PENDING"),
    accepted,
    declined,
    pending: count("PENDING"),
    acceptanceRate:
      accepted + declined ? Math.round((accepted / (accepted + declined)) * 1000) / 1000 : null,
  };
}
