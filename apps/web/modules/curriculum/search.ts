import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { rateLimited } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { getLimiter } from "@/lib/rate-limit";
import { getMyCourse } from "@/modules/courses";
import type { TenantContext } from "@/modules/tenancy";
import type { CurriculumSearchResult } from "./search-types";
import type { CurriculumReference } from "./types";

// Cliente del contrato docs/ai/contracts/retrieval-curriculum.v1.md (SPEC-0005).

const TIMEOUT_MS = 3_000;

const engineResponse = z.object({
  results: z.array(z.object({ code: z.string(), score: z.number() })),
  meta: z.object({
    provider: z.string(),
    denseModel: z.string(),
    catalogVersion: z.string().nullable(),
    latencyMs: z.number(),
  }),
});

export type { CurriculumSearchResult } from "./search-types";

type Fetcher = typeof fetch;

/**
 * Búsqueda semántica en los referentes del curso (área y grado del curso). Si el AI Engine no
 * está configurado, falla o tarda más de 3 s, devuelve "unavailable" y la página usa el filtro
 * literal (RN-05).
 */
export async function searchCourseCurriculum(
  ctx: TenantContext,
  courseId: string,
  query: string,
  fetcher: Fetcher = fetch,
): Promise<CurriculumSearchResult> {
  const course = await getMyCourse(ctx, courseId);
  // RN-07: 30 búsquedas por minuto por usuario.
  if (!(await getLimiter("curriculum-search", 30, 60_000).consume(ctx.userId)).allowed) {
    throw rateLimited();
  }

  const { AI_ENGINE_URL, AI_ENGINE_TOKEN } = getEnv();
  if (!AI_ENGINE_URL || !AI_ENGINE_TOKEN) return { status: "unavailable" };

  const isTransition = course.grade === "TRANSICION";
  const area = isTransition ? "TRANSICION" : course.curriculumAreaId;
  if (!area) return { status: "ok", references: [] };

  let codes: string[];
  try {
    const response = await fetcher(new URL("/v1/retrieval/curriculum", AI_ENGINE_URL), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${AI_ENGINE_TOKEN}` },
      // RN-04 / plan maestro §18: solo la consulta y los filtros; ningún dato personal.
      body: JSON.stringify({ query, area, grade: course.grade, limit: 8 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 401) {
      logger.error("ai_engine.unauthorized"); // token mal configurado
      return { status: "unavailable" };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = engineResponse.parse(await response.json());
    codes = body.results.map((r) => r.code);
    logger.info("ai_engine.retrieval", {
      results: codes.length,
      latencyMs: body.meta.latencyMs,
      model: body.meta.denseModel,
    });
  } catch (error) {
    logger.warn("ai_engine.unavailable", { error });
    return { status: "unavailable" };
  }

  return { status: "ok", references: await hydrate(codes) };
}

/**
 * RN-02: el texto mostrado sale de PostgreSQL, no del índice, y solo de fuentes publicadas
 * (un índice desactualizado no puede mostrar ítems reemplazados).
 */
async function hydrate(codes: string[]): Promise<CurriculumReference[]> {
  if (codes.length === 0) return [];
  const items = await db.curriculumItem.findMany({
    where: { code: { in: codes }, source: { status: "PUBLISHED" } },
    select: {
      code: true,
      type: true,
      number: true,
      component: true,
      statement: true,
      evidences: true,
      page: true,
      source: {
        select: {
          issuer: true,
          title: true,
          version: true,
          year: true,
          url: true,
          reviewStatus: true,
        },
      },
    },
  });
  const byCode = new Map(items.map((i) => [i.code, i]));
  return codes.flatMap((code) => {
    const item = byCode.get(code);
    if (!item) return [];
    const { source, page, ...rest } = item;
    return [
      {
        ...rest,
        citation: {
          issuer: source.issuer,
          title: source.title,
          version: source.version,
          year: source.year,
          page,
          url: source.url,
          reviewed: source.reviewStatus === "APPROVED",
        },
      },
    ];
  });
}
