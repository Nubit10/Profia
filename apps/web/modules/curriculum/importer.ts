import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { curriculumFileSchema, documentKeyOf, type CurriculumFile } from "./file-schema";

export type ImportReport = {
  sourceKey: string;
  status: "created" | "updated" | "unchanged";
  items: { created: number; updated: number; unchanged: number };
  superseded: string[];
};

export class CurriculumImportError extends Error {
  override name = "CurriculumImportError";
}

/** Valida un archivo; el mensaje nombra el archivo y el campo con problemas (CA-0004-02). */
export function parseCurriculumFile(json: unknown, fileName: string): CurriculumFile {
  const parsed = curriculumFileSchema.safeParse(json);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues
    .slice(0, 10)
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new CurriculumImportError(`${fileName} no es válido:\n${issues}`);
}

const hashOf = (file: CurriculumFile) =>
  createHash("sha256").update(JSON.stringify(file)).digest("hex");

const sameItem = (
  a: { statement: string; evidences: string[]; page: number; component: string | null },
  b: CurriculumFile["items"][number],
) =>
  a.statement === b.statement &&
  a.page === b.page &&
  (a.component ?? null) === (b.component ?? null) &&
  JSON.stringify(a.evidences) === JSON.stringify(b.evidences);

/**
 * Importa un archivo del catálogo en una sola transacción (RN-03):
 * - mismo contenido → no escribe nada;
 * - misma fuente y versión con cambios (p. ej. una corrección) → actualiza en sitio, sin borrar ítems;
 * - una versión nueva → la anterior queda SUPERSEDED y sus ítems se conservan (RN-02).
 */
export async function importCurriculumFile(file: CurriculumFile): Promise<ImportReport> {
  const contentHash = hashOf(file);
  const { source, review, items } = file;
  const documentKey = documentKeyOf(source.key);

  return db.$transaction(async (tx) => {
    const existing = await tx.curriculumSource.findUnique({
      where: { key: source.key },
      select: { id: true, contentHash: true },
    });
    const report: ImportReport = {
      sourceKey: source.key,
      status: existing ? "updated" : "created",
      items: { created: 0, updated: 0, unchanged: 0 },
      superseded: [],
    };
    if (existing?.contentHash === contentHash) {
      return {
        ...report,
        status: "unchanged",
        items: { created: 0, updated: 0, unchanged: items.length },
      };
    }

    const sourceData = {
      documentKey,
      issuer: source.issuer,
      title: source.title,
      documentType: source.documentType,
      areaId: source.area,
      version: source.version,
      year: source.year,
      isbn: source.isbn ?? null,
      url: source.url,
      landingUrl: source.landingUrl ?? null,
      sha256: source.sha256,
      usageNote: source.usageNote,
      reviewStatus: review.status,
      reviewedBy: review.reviewedBy,
      reviewedAt: review.reviewedAt ? new Date(review.reviewedAt) : null,
      contentHash,
      status: "PUBLISHED" as const,
    };
    const saved = existing
      ? await tx.curriculumSource.update({ where: { id: existing.id }, data: sourceData })
      : await tx.curriculumSource.create({ data: { key: source.key, ...sourceData } });

    const current = await tx.curriculumItem.findMany({
      where: { sourceId: saved.id },
      select: { code: true, statement: true, evidences: true, page: true, component: true },
    });
    const byCode = new Map(current.map((i) => [i.code, i]));
    const incoming = new Set(items.map((i) => i.code));
    const removed = current.filter((i) => !incoming.has(i.code)).map((i) => i.code);
    if (removed.length > 0) {
      // Los ítems pueden estar vinculados a planificación o recursos: no se borran. Una versión
      // que quita ítems se publica como fuente nueva (ADR-0005).
      throw new CurriculumImportError(
        `${source.key}: el archivo quita ítems ya publicados (${removed.slice(0, 5).join(", ")}). Publícalo como una versión nueva.`,
      );
    }

    for (const item of items) {
      const data = {
        type: item.type,
        areaId: item.area,
        grade: item.grade ?? null,
        gradeFrom: item.gradeFrom ?? null,
        gradeTo: item.gradeTo ?? null,
        number: item.number,
        component: item.component ?? null,
        statement: item.statement,
        evidences: item.evidences,
        page: item.page,
      };
      const previous = byCode.get(item.code);
      if (!previous) {
        await tx.curriculumItem.create({ data: { code: item.code, sourceId: saved.id, ...data } });
        report.items.created += 1;
      } else if (!sameItem(previous, item)) {
        await tx.curriculumItem.update({ where: { code: item.code }, data });
        report.items.updated += 1;
      } else {
        report.items.unchanged += 1;
      }
    }

    const older = await tx.curriculumSource.findMany({
      where: { documentKey, key: { not: source.key }, status: "PUBLISHED" },
      select: { id: true, key: true },
    });
    if (older.length > 0) {
      await tx.curriculumSource.updateMany({
        where: { id: { in: older.map((o) => o.id) } },
        data: { status: "SUPERSEDED" },
      });
      report.superseded = older.map((o) => o.key);
    }
    return report;
  });
}

/** Para tests y el comando: parsea e importa a partir del JSON ya leído. */
export async function importCurriculumJson(json: unknown, fileName: string) {
  return importCurriculumFile(parseCurriculumFile(json, fileName));
}
