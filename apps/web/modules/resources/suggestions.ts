import "server-only";
import { adjustmentLabel, type ResourceAdjustment } from "./adjustments";
import { after } from "next/server";
import { db } from "@/lib/db";
import { conflict, invalid, notFound } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { redactContactData } from "@/lib/text";
import { recordAudit } from "@/modules/audit";
import { getMyCourse, listMyCourses } from "@/modules/courses";
import { courseTitle } from "@/modules/courses/client";
import { requestPreferenceSuggestions, type EnginePreferenceSignal } from "@/modules/generation";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { compareVersions } from "./edits";
import type { AcceptSuggestionInput, ResourceType } from "./schemas";
import type { PendingSuggestion, ResourceContent, ResourceContextSnapshot } from "./types";

// SPEC-0021 Parte A (ADR-0016): ProfIA propone preferencias a partir de lo que hace el docente.
// Nada se usa al generar hasta que el docente acepta (teacher-in-control).

const DAY_MS = 24 * 60 * 60 * 1000;
/** RN-01: ventana de señales. */
export const SIGNAL_WINDOW_DAYS = 60;
/** RN-02: mínimo de recursos distintos con señales y una propuesta cada 7 días. */
export const MIN_RESOURCES_WITH_SIGNALS = 3;
export const SUGGESTION_EVERY_DAYS = 7;
/** RN-04: lo descartado no se vuelve a proponer igual en 90 días. */
export const DECLINED_MEMORY_DAYS = 90;
/** RN-06: una llamada al AI Engine al día por docente. */
export const CALLS_PER_DAY = 1;
const MAX_SIGNALS = 30;
const MAX_RESOURCES = 15;
const MAX_ACTIVE = 5;
const MAX_DECLINED = 10;
const COMMENT_MAX = 300;
const TASK = "preferences";

type Scheduler = (task: () => Promise<void>) => void;
export type SuggestionDeps = { fetcher?: typeof fetch; now?: Date; schedule?: Scheduler };

type Signal = EnginePreferenceSignal & { resourceId: string; courseId: string };

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sameText = (a: string, b: string) => {
  const x = normalize(a);
  const y = normalize(b);
  return x === y || (Math.min(x.length, y.length) >= 10 && (x.includes(y) || y.includes(x)));
};

const clean = (value: string) => redactContactData(value).trim().slice(0, COMMENT_MAX);

/** RN-01: las señales del docente desde `since`. Solo sus recursos; nunca nada del PIAR. */
async function collectSignals(ctx: TenantContext, since: Date): Promise<Signal[]> {
  const scope = { institutionId: ctx.institutionId, membershipId: ctx.membershipId };
  const resources = await db.resource.findMany({
    // Un recurso viejo cuenta si la señal es reciente (un 👎 no cambia `updatedAt` del recurso).
    where: {
      ...scope,
      status: { in: ["DRAFT", "READY"] },
      OR: [
        { updatedAt: { gte: since } },
        { ratedAt: { gte: since } },
        { itemFeedback: { some: { updatedAt: { gte: since } } } },
        { regenerations: { some: { decidedAt: { gte: since } } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      courseId: true,
      context: true,
      currentVersion: true,
      rating: true,
      ratingComment: true,
      ratedAt: true,
    },
  });
  if (!resources.length) return [];
  const ids = resources.map((r) => r.id);
  const [feedback, regenerations, adjustments] = await Promise.all([
    db.resourceItemFeedback.findMany({
      where: {
        institutionId: ctx.institutionId,
        resourceId: { in: ids },
        rating: "DOWN",
        comment: { not: null },
        updatedAt: { gte: since },
      },
      select: { resourceId: true, comment: true },
    }),
    db.itemRegeneration.findMany({
      where: {
        institutionId: ctx.institutionId,
        resourceId: { in: ids },
        decision: "ACCEPTED",
        decidedAt: { gte: since },
      },
      select: { resourceId: true, itemKey: true, instruction: true },
    }),
    // SPEC-0027 RN-09: los ajustes rápidos que el docente aceptó también dicen qué prefiere.
    db.resourceAdjustment.findMany({
      where: {
        institutionId: ctx.institutionId,
        resourceId: { in: ids },
        status: "ACCEPTED",
        decidedAt: { gte: since },
      },
      select: { resourceId: true, code: true },
    }),
  ]);

  const base = (r: (typeof resources)[number]) => {
    const context = r.context as unknown as ResourceContextSnapshot;
    return {
      resourceId: r.id,
      courseId: r.courseId,
      resourceType: r.type,
      subject: context.subject.slice(0, 80),
      grade: context.grade.slice(0, 20),
    };
  };
  const byId = new Map(resources.map((r) => [r.id, r]));
  const comments: Signal[] = [];
  const edits: Signal[] = [];

  for (const f of feedback) {
    comments.push({
      ...base(byId.get(f.resourceId)!),
      kind: "ITEM_DOWN",
      comment: clean(f.comment!),
    });
  }
  for (const g of regenerations) {
    comments.push({
      ...base(byId.get(g.resourceId)!),
      kind: "REGENERATION",
      comment: clean(g.instruction),
    });
  }
  for (const a of adjustments) {
    const resource = byId.get(a.resourceId)!;
    comments.push({
      ...base(resource),
      kind: "REGENERATION",
      comment: `Pidió el recurso completo «${adjustmentLabel(a.code as ResourceAdjustment, resource.type)}» y se quedó con esa versión`,
    });
  }
  for (const r of resources) {
    if (r.rating !== null && r.rating <= 3 && r.ratingComment && r.ratedAt && r.ratedAt >= since) {
      comments.push({ ...base(r), kind: "RESOURCE_COMMENT", comment: clean(r.ratingComment) });
    }
  }

  // Ediciones: versión de la IA frente a la última, sin los ítems regenerados (ya cuentan arriba).
  const edited = resources.filter((r) => r.currentVersion > 1).slice(0, MAX_RESOURCES);
  const versions = await db.resourceVersion.findMany({
    where: {
      resourceId: { in: edited.map((r) => r.id) },
      institutionId: ctx.institutionId,
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
    const regenerated = new Set(
      regenerations.filter((g) => g.resourceId === r.id).map((g) => g.itemKey),
    );
    const as = (content: unknown) =>
      ({ type: r.type as ResourceType, content }) as unknown as ResourceContent;
    const diff = compareVersions(as(first.content), as(last.content), regenerated);
    for (const e of diff.edited) {
      edits.push({
        ...base(r),
        kind: "EDIT",
        before: redactContactData(e.before),
        after: redactContactData(e.after),
      });
    }
  }
  // Los comentarios dicen más que las ediciones: van primero.
  return [...comments, ...edits].slice(0, MAX_SIGNALS);
}

/**
 * RN-02 a RN-06: si toca, pide al AI Engine de 1 a 3 preferencias y las guarda como propuestas.
 * Nunca lanza: corre después de responder y, si algo falla, no se muestra nada (CA-0021-08).
 */
export async function maybeProposePreferences(
  ctx: TenantContext,
  deps: SuggestionDeps = {},
): Promise<number> {
  try {
    if (!ctx.roles.includes("TEACHER")) return 0;
    const now = deps.now ?? new Date();
    const scope = { institutionId: ctx.institutionId, membershipId: ctx.membershipId };
    const [pending, last, calls] = await Promise.all([
      db.preferenceSuggestion.count({ where: { ...scope, status: "PENDING" } }),
      db.preferenceSuggestion.findFirst({
        where: scope,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      db.generationLog.count({
        where: { ...scope, task: TASK, createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
      }),
    ]);
    if (pending > 0 || calls >= CALLS_PER_DAY) return 0;
    if (last && now.getTime() - last.createdAt.getTime() < SUGGESTION_EVERY_DAYS * DAY_MS) return 0;

    const window = new Date(now.getTime() - SIGNAL_WINDOW_DAYS * DAY_MS);
    const since = last && last.createdAt > window ? last.createdAt : window;
    const signals = await collectSignals(ctx, since);
    if (new Set(signals.map((s) => s.resourceId)).size < MIN_RESOURCES_WITH_SIGNALS) return 0;

    const [active, declined] = await Promise.all([
      db.teacherPreference.findMany({
        where: { ...scope, active: true },
        orderBy: { createdAt: "desc" },
        take: MAX_ACTIVE,
        select: { id: true, text: true },
      }),
      db.preferenceSuggestion.findMany({
        where: {
          ...scope,
          status: "DECLINED",
          decidedAt: { gte: new Date(now.getTime() - DECLINED_MEMORY_DAYS * DAY_MS) },
        },
        orderBy: { decidedAt: "desc" },
        take: MAX_DECLINED,
        select: { text: true },
      }),
    ]);

    const result = await requestPreferenceSuggestions(
      {
        signals: signals.map(({ kind, resourceType, subject, grade, before, after, comment }) => ({
          kind,
          resourceType,
          subject,
          grade,
          ...(before !== undefined && { before }),
          ...(after !== undefined && { after }),
          ...(comment !== undefined && { comment }),
        })),
        activePreferences: active.map((p) => p.text.slice(0, 300)),
        declined: declined.map((d) => d.text.slice(0, 300)),
      },
      deps.fetcher,
    );
    if (result.status !== "ok") {
      await db.generationLog.create({
        data: {
          ...scope,
          task: TASK,
          entityType: "membership",
          entityId: ctx.membershipId,
          status: result.status === "invalid" ? "INVALID" : "UNAVAILABLE",
        },
      });
      return 0;
    }

    const { meta } = result.data;
    const known = [...active.map((p) => p.text), ...declined.map((d) => d.text)];
    const fresh = result.data.suggestions.filter((s) => !known.some((k) => sameText(k, s.text)));
    const courses = new Set(signals.map((s) => s.courseId));
    const courseId = courses.size === 1 ? [...courses][0]! : null;

    return await db.$transaction(async (tx) => {
      const log = await tx.generationLog.create({
        data: {
          ...scope,
          task: TASK,
          entityType: "membership",
          entityId: ctx.membershipId,
          status: "OK",
          provider: meta.provider,
          model: meta.model,
          promptVersion: meta.promptVersion,
          attempts: meta.attempts,
          latencyMs: meta.latencyMs,
          tokens: meta.tokens,
        },
        select: { id: true },
      });
      for (const s of fresh) {
        await tx.preferenceSuggestion.create({
          data: {
            ...scope,
            courseId,
            text: s.text.slice(0, 300),
            reason: s.reason.slice(0, 300),
            conflictsWithId:
              s.conflictsWith === null ? null : (active[s.conflictsWith]?.id ?? null),
            generationId: log.id,
          },
        });
      }
      if (fresh.length) {
        await recordAudit(tx, {
          action: "ai.preference_suggested",
          institutionId: ctx.institutionId,
          actorUserId: ctx.userId,
          entityType: "membership",
          entityId: ctx.membershipId,
          metadata: { count: fresh.length, signals: signals.length },
        });
      }
      return fresh.length;
    });
  } catch (error) {
    logger.warn("preference_suggestions.failed", { error });
    return 0;
  }
}

/** Corre la revisión después de responder (ADR-0008); en tests se inyecta `schedule`. */
export function schedulePreferenceCheck(ctx: TenantContext, deps: SuggestionDeps = {}) {
  if (!ctx.roles.includes("TEACHER")) return;
  const schedule = deps.schedule ?? ((task: () => Promise<void>) => after(task));
  try {
    schedule(async () => {
      await maybeProposePreferences(ctx, deps);
    });
  } catch (error) {
    // Fuera de una petición (scripts, pruebas) no hay `after()`: se omite, nunca rompe la acción.
    logger.info("preference_suggestions.not_scheduled", { error });
  }
}

/** La propuesta pendiente más reciente del docente (se muestra una a la vez). */
export async function pendingPreferenceSuggestions(
  ctx: TenantContext,
): Promise<PendingSuggestion[]> {
  requireRole(ctx, "TEACHER");
  const rows = await db.preferenceSuggestion.findMany({
    where: { institutionId: ctx.institutionId, membershipId: ctx.membershipId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { id: true, text: true, reason: true, courseId: true, conflictsWithId: true },
  });
  if (!rows.length) return [];
  const [courses, conflicts] = await Promise.all([
    listMyCourses(ctx),
    db.teacherPreference.findMany({
      where: {
        institutionId: ctx.institutionId,
        membershipId: ctx.membershipId,
        active: true,
        id: { in: rows.flatMap((r) => (r.conflictsWithId ? [r.conflictsWithId] : [])) },
      },
      select: { id: true, text: true },
    }),
  ]);
  return rows.map((r) => {
    const course = courses.find((c) => c.id === r.courseId);
    return {
      id: r.id,
      text: r.text,
      reason: r.reason,
      course: course ? { id: course.id, title: courseTitle(course) } : null,
      conflictsWith: conflicts.find((c) => c.id === r.conflictsWithId) ?? null,
    };
  });
}

async function ownSuggestion(ctx: TenantContext, suggestionId: string) {
  const row = await db.preferenceSuggestion.findFirst({
    where: { id: suggestionId, institutionId: ctx.institutionId, membershipId: ctx.membershipId },
    select: { id: true, status: true },
  });
  if (!row) throw notFound();
  if (row.status !== "PENDING") throw conflict("Ya la decidiste");
  return row;
}

/** RN-05: crea la preferencia con el texto y el alcance que eligió el docente. */
export async function acceptPreferenceSuggestion(ctx: TenantContext, input: AcceptSuggestionInput) {
  requireRole(ctx, "TEACHER");
  const suggestion = await ownSuggestion(ctx, input.suggestionId);
  if (input.scope === "COURSE") {
    if (!input.courseId) throw invalid("Elige el curso", "courseId");
    await getMyCourse(ctx, input.courseId);
  }
  const scope = { institutionId: ctx.institutionId, membershipId: ctx.membershipId };
  return db.$transaction(async (tx) => {
    const { count } = await tx.preferenceSuggestion.updateMany({
      where: { id: suggestion.id, ...scope, status: "PENDING" },
      data: { status: "ACCEPTED", decidedAt: new Date() },
    });
    if (count === 0) throw conflict("Ya la decidiste");
    const preference = await tx.teacherPreference.create({
      data: {
        ...scope,
        courseId: input.scope === "COURSE" ? input.courseId! : null,
        text: input.text,
      },
      select: { id: true },
    });
    if (input.deactivateIds.length) {
      await tx.teacherPreference.updateMany({
        where: { ...scope, id: { in: input.deactivateIds } },
        data: { active: false },
      });
    }
    await recordAudit(tx, {
      action: "preference_suggestion.accepted",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "preference_suggestion",
      entityId: suggestion.id,
      metadata: { preferenceId: preference.id, deactivated: input.deactivateIds.length },
    });
    return { preferenceId: preference.id };
  });
}

export async function declinePreferenceSuggestion(ctx: TenantContext, suggestionId: string) {
  requireRole(ctx, "TEACHER");
  const suggestion = await ownSuggestion(ctx, suggestionId);
  await db.$transaction(async (tx) => {
    const { count } = await tx.preferenceSuggestion.updateMany({
      where: {
        id: suggestion.id,
        institutionId: ctx.institutionId,
        membershipId: ctx.membershipId,
        status: "PENDING",
      },
      data: { status: "DECLINED", decidedAt: new Date() },
    });
    if (count === 0) throw conflict("Ya la decidiste");
    await recordAudit(tx, {
      action: "preference_suggestion.declined",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "preference_suggestion",
      entityId: suggestion.id,
    });
  });
}
