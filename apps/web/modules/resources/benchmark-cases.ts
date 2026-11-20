import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { redactContactData } from "@/lib/text";
import { itemTexts } from "./edits";
import type { Blueprint } from "./schemas";
import type { ResourceContent, ResourceContextSnapshot } from "./types";

// SPEC-0021 RN-13 (ADR-0016): recursos que el docente calificó mal, como casos de regresión del
// benchmark del AI Engine. Herramienta interna: cruza colegios a propósito y por eso no recibe un
// TenantContext; nunca se expone en la app. El caso sale anonimizado:
//  - sin ids de docente, colegio, curso ni recurso (solo un id opaco con sal);
//  - sin correos ni teléfonos;
//  - nunca nada del PIAR (vive en otra tabla y no se consulta aquí).

/** RN-13: 1 a 2 estrellas con comentario cuentan como queja del recurso entero. */
export const LOW_RATING = 2;
const TEXT_MAX = 600;

export type BenchmarkCase = {
  id: string;
  type: "QUIZ" | "WORKSHOP" | "EXAM";
  subject: string;
  gradeLabel: string;
  topic: string;
  topicDescription: string | null;
  objectives: string[];
  dba: { code: string; statement: string; evidences: string[] }[];
  difficulty: string;
  durationMinutes: number;
  itemCount: number | null;
  questionTypes: string[] | null;
  structure: string | null;
  cognitiveDistribution: Record<string, number>;
  rating: number | null;
  complaints: { item: string | null; comment: string }[];
};

const clean = (value: string) => redactContactData(value).replace(/\s+/g, " ").trim();

const opaqueId = (salt: string, resourceId: string) =>
  createHash("sha256").update(`${salt}:${resourceId}`).digest("hex").slice(0, 16);

/** Extrae los casos. `salt` hace que el id no se pueda revertir pero sea estable entre corridas. */
export async function extractBenchmarkCases(salt: string): Promise<BenchmarkCase[]> {
  if (salt.length < 16) throw new Error("La sal debe tener al menos 16 caracteres");
  const resources = await db.resource.findMany({
    where: {
      currentVersion: { gte: 1 },
      OR: [
        { itemFeedback: { some: { rating: "DOWN", comment: { not: null } } } },
        { rating: { lte: LOW_RATING }, ratingComment: { not: null } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      blueprint: true,
      context: true,
      rating: true,
      ratingComment: true,
      itemFeedback: {
        where: { rating: "DOWN", comment: { not: null } },
        select: { itemKey: true, comment: true },
      },
      versions: { where: { number: 1 }, select: { content: true } },
    },
  });

  return resources.map((r) => {
    const blueprint = r.blueprint as unknown as Blueprint;
    const context = r.context as unknown as ResourceContextSnapshot;
    const generated = r.versions[0]
      ? itemTexts({ type: r.type, content: r.versions[0].content } as unknown as ResourceContent)
      : new Map<string, string>();
    const complaints = [
      ...r.itemFeedback.map((f) => ({
        item: generated.has(f.itemKey) ? clean(generated.get(f.itemKey)!).slice(0, TEXT_MAX) : null,
        comment: clean(f.comment!).slice(0, 300),
      })),
      ...(r.rating !== null && r.rating <= LOW_RATING && r.ratingComment
        ? [{ item: null, comment: clean(r.ratingComment).slice(0, 300) }]
        : []),
    ];
    return {
      id: opaqueId(salt, r.id),
      type: r.type,
      subject: context.subject,
      gradeLabel: context.grade,
      topic: clean(context.topic.title),
      topicDescription: context.topic.description ? clean(context.topic.description) : null,
      objectives: context.objectives.map((o) => clean(o.statement)),
      dba: context.dba.map((d) => ({ code: d.code, statement: d.statement, evidences: [] })),
      difficulty: blueprint.difficulty,
      durationMinutes: blueprint.durationMinutes,
      itemCount: "itemCount" in blueprint ? blueprint.itemCount : null,
      questionTypes: blueprint.type === "QUIZ" ? blueprint.questionTypes : null,
      // Un formato propio (CUSTOM) no viaja: el caso se corre con la estructura más usada.
      structure:
        blueprint.type === "WORKSHOP"
          ? blueprint.structure === "CUSTOM"
            ? "START_DEVELOPMENT_CLOSE"
            : blueprint.structure
          : null,
      cognitiveDistribution: blueprint.cognitiveDistribution,
      rating: r.rating,
      complaints,
    };
  });
}
