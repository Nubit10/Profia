import "server-only";
import { after } from "next/server";
import { db, Prisma, type DbClient } from "@/lib/db";
import { conflict, invalid, notFound, rateLimited } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { getLimiter } from "@/lib/rate-limit";
import { redactContactData } from "@/lib/text";
import { recordAudit } from "@/modules/audit";
import { getMyCourse } from "@/modules/courses";
import {
  defaultFormatId,
  getFormatSnapshot,
  listFormats,
  type FormatSnapshot,
} from "@/modules/formats";
import {
  requestExam,
  requestExamItem,
  requestItem,
  requestQuiz,
  requestWorkshop,
  type EngineExamContext,
  type EngineResourceContext,
  type EngineResourceMeta,
} from "@/modules/generation";
import {
  getTopicGenerationContext,
  getTopicsGenerationContext,
  type TopicsGenerationContext,
} from "@/modules/planning";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import {
  engineExamQuestion,
  engineItem,
  examFromEngine,
  findItem,
  itemKeys,
  quizFromEngine,
  replaceItem,
  sanitizeContent,
  toActivity,
  toExamQuestion,
  toQuestion,
  topicKey,
  workshopFromEngine,
} from "./content";
import { generationQueue } from "./queue";
import {
  DEFAULT_GRADING_SCALE,
  EXAM_QUOTA_COST,
  RESOURCE_TYPE_LABELS,
  activitySchema,
  examContentSchema,
  examQuestionSchema,
  examTotalPoints,
  gradingScaleSchema,
  quizContentSchema,
  quizQuestionSchema,
  workshopContentSchema,
  type Blueprint,
  type ExamScope,
  type GradingScale,
  type PreferenceInput,
  type ResourceType,
} from "./schemas";
import type {
  ExamFormContext,
  FailureReason,
  RegenerateResult,
  ResourceContent,
  ResourceContextSnapshot,
  ResourceDetail,
  ResourceFormContext,
  ResourceStatus,
  ResourceSummary,
  TeacherPreferenceView,
} from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** RN-06: cupo por docente (plan gratuito de Groq, ADR-0007). Las fallidas no cuentan. */
export const DAILY_LIMIT = 10;
export const MAX_IN_FLIGHT = 3;
const REGENERATIONS_PER_HOUR = 30;
/** ADR-0008 §5: una generación que lleva más que esto se considera interrumpida. */
const STALE_MS = 5 * 60 * 1000;
/**
 * SPEC-0011: el examen son varias llamadas seguidas (hasta 280 s de timeout en el cliente). Margen
 * para que una generación viva no se marque como interrumpida.
 */
const EXAM_STALE_MS = 6 * 60 * 1000;
/** RN-07: preferencias que viajan en cada generación. */
const MAX_PREFERENCES = 5;
const MAX_PREFERENCES_CHARS = 500;

export type Scheduler = (task: () => Promise<void>) => void;
export type GenerationDeps = { fetcher?: typeof fetch; schedule?: Scheduler };

/** ADR-0008: la generación corre después de responder. En tests se inyecta otro planificador. */
const runAfterResponse: Scheduler = (task) => after(task);

type Snapshot = Omit<ResourceContextSnapshot, "dba"> & {
  dba: (ResourceContextSnapshot["dba"][number] & { evidences: string[] })[];
};

// --- Contexto y preferencias -----------------------------------------------------------------

async function applicablePreferences(ctx: TenantContext, courseId: string) {
  const rows = await db.teacherPreference.findMany({
    where: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      OR: [{ courseId }, { courseId: null }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, text: true, courseId: true, active: true },
  });
  return rows.map((p): TeacherPreferenceView => ({
    id: p.id,
    text: p.text,
    scope: p.courseId ? "COURSE" : "ALL",
    active: p.active,
  }));
}

/** Las más recientes que caben en el límite (RN-07). */
function preferencesForPrompt(prefs: TeacherPreferenceView[], excluded: string[]): string[] {
  const out: string[] = [];
  let chars = 0;
  for (const p of prefs) {
    if (!p.active || excluded.includes(p.id) || out.length >= MAX_PREFERENCES) continue;
    if (chars + p.text.length > MAX_PREFERENCES_CHARS) break;
    out.push(redactContactData(p.text));
    chars += p.text.length;
  }
  return out;
}

/** SPEC-0011 RN-11: un examen gasta 2 recursos del cupo; talleres y quices, 1. */
export const quotaCost = (type: ResourceType) => (type === "EXAM" ? EXAM_QUOTA_COST : 1);

export async function quotaFor(client: DbClient, ctx: TenantContext) {
  const [rows, inFlight] = await Promise.all([
    client.resource.findMany({
      where: {
        institutionId: ctx.institutionId,
        membershipId: ctx.membershipId,
        generationId: { not: null },
        status: { not: "FAILED" },
        createdAt: { gt: new Date(Date.now() - DAY) },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, type: true },
    }),
    client.resource.count({
      where: {
        institutionId: ctx.institutionId,
        membershipId: ctx.membershipId,
        status: "GENERATING",
      },
    }),
  ]);
  const used = rows.reduce((sum, r) => sum + quotaCost(r.type), 0);
  /** Cuándo vuelve a haber cupo para `cost` recursos (null si ya lo hay). */
  const freesAtFor = (cost: number) => {
    let pending = used + cost - DAILY_LIMIT;
    if (pending <= 0) return null;
    for (const row of rows) {
      pending -= quotaCost(row.type);
      if (pending <= 0) return new Date(row.createdAt.getTime() + DAY);
    }
    return null;
  };
  return { used, inFlight, freesAt: freesAtFor(1), freesAtFor };
}

/** Datos para el formulario del blueprint (SPEC-0008 §5). */
export async function getResourceFormContext(
  ctx: TenantContext,
  topicId: string,
): Promise<ResourceFormContext> {
  requireRole(ctx, "TEACHER");
  const context = await getTopicGenerationContext(ctx, topicId); // NOT_FOUND si es ajeno
  const [preferences, quota, formats, defaultFormat] = await Promise.all([
    applicablePreferences(ctx, context.courseId),
    recoverStale(ctx).then(() => quotaFor(db, ctx)),
    listFormats(ctx),
    defaultFormatId(ctx),
  ]);
  return {
    courseId: context.courseId,
    grade: context.gradeCode,
    gradeLabel: context.grade,
    subject: context.subject,
    topic: { id: context.topicId, title: context.topic.title },
    objectives: context.objectives,
    hasDba: context.dba.length > 0,
    preferences,
    formats: formats.map((f) => ({
      id: f.id,
      name: f.name,
      scope: f.scope,
      sections: f.structure.sections.map(({ title, kind }) => ({ title, kind })),
    })),
    defaultFormatId: defaultFormat,
    quota: {
      used: quota.used,
      limit: DAILY_LIMIT,
      inFlight: quota.inFlight,
      maxInFlight: MAX_IN_FLIGHT,
    },
  };
}

/** Datos del asistente para un examen de varios temas del mismo curso (SPEC-0011 §2). */
export async function getExamFormContext(
  ctx: TenantContext,
  topicIds: string[],
): Promise<ExamFormContext> {
  requireRole(ctx, "TEACHER");
  const context = await getTopicsGenerationContext(ctx, topicIds); // NOT_FOUND si es ajeno
  const [preferences, quota] = await Promise.all([
    applicablePreferences(ctx, context.courseId),
    recoverStale(ctx).then(() => quotaFor(db, ctx)),
  ]);
  return {
    courseId: context.courseId,
    grade: context.gradeCode,
    gradeLabel: context.grade,
    subject: context.subject,
    topics: context.topics.map((t) => ({
      id: t.id,
      title: t.title,
      unitTitle: t.unit.title,
      periodName: t.periodName,
      objectives: t.objectives,
    })),
    hasDba: context.dba.length > 0,
    preferences,
    quota: {
      used: quota.used,
      limit: DAILY_LIMIT,
      inFlight: quota.inFlight,
      maxInFlight: MAX_IN_FLIGHT,
      cost: EXAM_QUOTA_COST,
    },
  };
}

/** Título del examen según de dónde partió el docente (unidad, periodo o temas sueltos). */
function examTitle(scope: ExamScope, context: TopicsGenerationContext) {
  const topics = context.topics;
  if (scope.kind === "UNIT") {
    const unit = topics.find((t) => t.unit.id === scope.unitId)?.unit;
    if (unit) return `Examen: ${unit.title}`;
  }
  if (scope.kind === "PERIOD") {
    const period = topics.find((t) => t.periodNumber === scope.periodNumber)?.periodName;
    if (period) return `Examen del ${period.charAt(0).toLowerCase()}${period.slice(1)}`;
  }
  const first = topics[0]!.title;
  if (topics.length === 1) return `Examen: ${first}`;
  const rest = topics.length - 1;
  return `Examen: ${first} y ${rest} ${rest === 1 ? "tema más" : "temas más"}`;
}

/** Resumen de los temas para listas y encabezados ("Suma, Resta y Recta numérica"). */
const topicsLabel = (titles: string[]) => {
  const label =
    titles.length <= 1 ? (titles[0] ?? "") : `${titles.slice(0, -1).join(", ")} y ${titles.at(-1)}`;
  return label.length > 200 ? `${label.slice(0, 197)}…` : label;
};

/** SPEC-0011: contexto de todos los temas; RN-12 copia temas, objetivos y DBA en el examen. */
async function prepareExam(ctx: TenantContext, blueprint: Extract<Blueprint, { type: "EXAM" }>) {
  const context = await getTopicsGenerationContext(ctx, blueprint.topicIds);
  const objectives = blueprint.objectiveIds.map((id) => {
    const objective = context.topics.flatMap((t) => t.objectives).find((o) => o.id === id);
    if (!objective) throw invalid("Uno de los objetivos no pertenece a los temas del examen");
    return objective;
  });
  const linked = new Set(objectives.flatMap((o) => o.dbaCodes));
  const dba = (linked.size ? context.dba.filter((d) => linked.has(d.code)) : context.dba).slice(
    0,
    40,
  );
  const preferences = preferencesForPrompt(
    await applicablePreferences(ctx, context.courseId),
    blueprint.excludedPreferenceIds,
  );
  const topics = context.topics.map(({ id, title, description }) => ({ id, title, description }));
  const snapshot: Snapshot = {
    subject: context.subject,
    grade: context.grade,
    topic: { id: topics[0]!.id, title: topicsLabel(topics.map((t) => t.title)), description: null },
    topics,
    periods: [...new Set(context.topics.map((t) => t.periodName).filter((p): p is string => !!p))],
    objectives: objectives.map(({ id, statement }) => ({ id, statement })),
    dba: dba.map(({ code, number, statement, evidences }) => ({
      code,
      number,
      statement,
      evidences,
    })),
  };
  return {
    courseId: context.courseId,
    snapshot,
    preferences,
    format: null,
    title: examTitle(blueprint.scope, context),
  };
}

/** RN-08: los temas viajan con su clave (T1…); el texto del docente, sin correos ni teléfonos. */
function engineExamContext(
  snapshot: Snapshot,
  difficulty: Blueprint["difficulty"],
  notes: string | null,
  preferences: string[],
): EngineExamContext {
  return {
    subject: snapshot.subject,
    grade: snapshot.grade,
    // T8: título y descripción los escribe el docente; viajan sin correos ni teléfonos.
    topics: (snapshot.topics ?? [snapshot.topic]).map((t, i) => ({
      key: topicKey(i),
      title: redactContactData(t.title),
      description: t.description ? redactContactData(t.description) : null,
    })),
    objectives: snapshot.objectives.map((o) => o.statement),
    dba: snapshot.dba.map(({ code, statement, evidences }) => ({ code, statement, evidences })),
    difficulty,
    notes: notes ? redactContactData(notes) : null,
    preferences,
  };
}

/** Contexto pedagógico del blueprint: objetivos elegidos y sus DBA (o los del grado). */
/** `presetFormat`: al reintentar se usa la copia guardada en el taller (RN-05 de SPEC-0010). */
async function prepare(
  ctx: TenantContext,
  blueprint: Exclude<Blueprint, { type: "EXAM" }>,
  presetFormat?: FormatSnapshot | null,
) {
  const context = await getTopicGenerationContext(ctx, blueprint.topicId);
  const objectives = blueprint.objectiveIds.map((id) => {
    const objective = context.objectives.find((o) => o.id === id);
    if (!objective) throw invalid("Uno de los objetivos no pertenece al tema");
    return objective;
  });
  // Solo los DBA de los objetivos elegidos: menos tokens y preguntas más enfocadas. Si los
  // objetivos no tienen DBA vinculados (o no se eligió ninguno), van los del grado.
  const linked = new Set(objectives.flatMap((o) => o.dbaCodes));
  const dba = linked.size ? context.dba.filter((d) => linked.has(d.code)) : context.dba;
  const preferences = preferencesForPrompt(
    await applicablePreferences(ctx, context.courseId),
    blueprint.excludedPreferenceIds,
  );
  const snapshot: Snapshot = {
    subject: context.subject,
    grade: context.grade,
    topic: { id: context.topicId, ...context.topic },
    objectives: objectives.map(({ id, statement }) => ({ id, statement })),
    dba: dba.map(({ code, number, statement, evidences }) => ({
      code,
      number,
      statement,
      evidences,
    })),
  };
  // SPEC-0010: el formato elegido se copia en el taller (RN-05).
  const format =
    presetFormat !== undefined
      ? presetFormat
      : blueprint.type === "WORKSHOP" && blueprint.structure === "CUSTOM" && blueprint.formatId
        ? await getFormatSnapshot(ctx, blueprint.formatId)
        : null;
  if (format && blueprint.type === "WORKSHOP") {
    const activitySections = format.structure.sections.filter(
      (s) => s.kind === "ACTIVITIES",
    ).length;
    if (blueprint.itemCount < activitySections) {
      throw invalid(
        `Tu formato tiene ${activitySections} secciones de actividades: pide al menos ${activitySections} actividades`,
        "itemCount",
      );
    }
  }
  return {
    courseId: context.courseId,
    snapshot,
    preferences,
    format,
    title: `${RESOURCE_TYPE_LABELS[blueprint.type]}: ${snapshot.topic.title}`,
  };
}

/** RN-02: solo contexto pedagógico; texto libre del docente sin correos ni teléfonos. */
function engineContext(
  snapshot: Snapshot,
  difficulty: Blueprint["difficulty"],
  notes: string | null,
  preferences: string[],
): EngineResourceContext {
  return {
    subject: snapshot.subject,
    grade: snapshot.grade,
    topic: { title: snapshot.topic.title, description: snapshot.topic.description },
    objectives: snapshot.objectives.map((o) => o.statement),
    dba: snapshot.dba.map(({ code, statement, evidences }) => ({ code, statement, evidences })),
    difficulty,
    notes: notes ? redactContactData(notes) : null,
    preferences,
  };
}

// --- Generación en segundo plano (ADR-0008) --------------------------------------------------

type Job = {
  resourceId: string;
  institutionId: string;
  membershipId: string;
  blueprint: Blueprint;
  snapshot: Snapshot;
  preferences: string[];
  format: FormatSnapshot | null;
  title: string;
};

async function logGeneration(
  client: DbClient,
  job: Job,
  task: string,
  status: "OK" | "INVALID" | "UNAVAILABLE",
  meta?: EngineResourceMeta,
) {
  return client.generationLog.create({
    data: {
      institutionId: job.institutionId,
      membershipId: job.membershipId,
      task,
      entityType: "resource",
      entityId: job.resourceId,
      status,
      ...(meta && {
        provider: meta.provider,
        model: meta.model,
        promptVersion: meta.promptVersion,
        attempts: meta.attempts,
        latencyMs: meta.latencyMs,
        tokens: meta.tokens,
      }),
    },
    select: { id: true },
  });
}

async function fail(job: Job, reason: FailureReason, generationId: string | null) {
  await db.resource.updateMany({
    where: { id: job.resourceId, status: "GENERATING" },
    data: { status: "FAILED", failureReason: reason, generationId },
  });
}

/** Guarda la versión 1 generada si el recurso sigue en "generando". */
async function saveGenerated(
  tx: Prisma.TransactionClient,
  job: Job,
  data: ResourceContent,
  generationId: string,
) {
  const { count } = await tx.resource.updateMany({
    where: { id: job.resourceId, status: "GENERATING" },
    data: {
      status: "DRAFT",
      title: data.content.title,
      generationId,
      failureReason: null,
      currentVersion: 1,
    },
  });
  // Si se marcó como interrumpida mientras tanto, no se sobrescribe nada.
  if (count === 0) return;
  await tx.resourceVersion.deleteMany({ where: { resourceId: job.resourceId } });
  await tx.resourceVersion.create({
    data: {
      institutionId: job.institutionId,
      resourceId: job.resourceId,
      number: 1,
      source: "AI",
      content: data.content as Prisma.InputJsonValue,
    },
  });
}

/** SPEC-0011: el examen se genera por secciones; cada llamada queda en `generation_logs`. */
async function runExamGeneration(
  job: Job & { blueprint: Extract<Blueprint, { type: "EXAM" }> },
  fetcher: typeof fetch,
) {
  const { blueprint, snapshot } = job;
  const result = await requestExam(
    {
      ...engineExamContext(snapshot, blueprint.difficulty, blueprint.notes, job.preferences),
      durationMinutes: blueprint.durationMinutes,
      sections: blueprint.sections.map((s) => ({
        questionType: s.questionType,
        questionCount: s.questionCount,
        pointsPerQuestion: s.pointsPerQuestion,
        instructions: s.instructions ? redactContactData(s.instructions) : null,
      })),
      cognitiveDistribution: blueprint.cognitiveDistribution,
    },
    fetcher,
  );
  if (result.status !== "ok") {
    const log = await logGeneration(
      db,
      job,
      "exam",
      result.status === "invalid" ? "INVALID" : "UNAVAILABLE",
    );
    await fail(job, result.status, log.id);
    return;
  }
  const allowed = new Set(snapshot.dba.map((d) => d.code));
  const topics = (snapshot.topics ?? [snapshot.topic]).map(({ id, title }) => ({ id, title }));
  const content = examFromEngine(
    result.data.exam,
    {
      title: job.title,
      durationMinutes: blueprint.durationMinutes,
      targetPoints: blueprint.totalPoints,
      topics,
      instructions: blueprint.sections.map((s) => s.instructions),
    },
    allowed,
  );
  const { meta } = result.data;
  await db.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const call of meta.calls) {
      const log = await logGeneration(tx, job, "exam", "OK", {
        provider: call.provider,
        model: call.model,
        promptVersion: meta.promptVersion,
        attempts: call.attempts,
        latencyMs: call.latencyMs,
        tokens: call.tokens,
      });
      ids.push(log.id);
    }
    await saveGenerated(tx, job, { type: "EXAM", content }, ids[0]!);
  });
}

/** Llama al AI Engine y guarda el resultado. Nunca lanza: corre fuera de la petición. */
export async function runGeneration(job: Job, fetcher: typeof fetch = fetch): Promise<void> {
  const { blueprint, snapshot } = job;
  try {
    if (blueprint.type === "EXAM") {
      await generationQueue.run(() => runExamGeneration({ ...job, blueprint }, fetcher));
      return;
    }
    const task = blueprint.type === "QUIZ" ? "quiz" : "workshop";
    await generationQueue.run(async () => {
      const context = engineContext(
        snapshot,
        blueprint.difficulty,
        blueprint.notes,
        job.preferences,
      );
      const result =
        blueprint.type === "QUIZ"
          ? await requestQuiz(
              {
                ...context,
                durationMinutes: blueprint.durationMinutes,
                itemCount: blueprint.itemCount,
                questionTypes: blueprint.questionTypes,
                cognitiveDistribution: blueprint.cognitiveDistribution,
              },
              fetcher,
            )
          : await requestWorkshop(
              {
                ...context,
                durationMinutes: blueprint.durationMinutes,
                itemCount: blueprint.itemCount,
                structure: blueprint.structure,
                // RN-02 de SPEC-0010: las secciones fijas no se envían a la IA.
                ...(job.format && {
                  customSections: job.format.structure.sections
                    .filter((s) => s.kind !== "FIXED")
                    .map((s) => ({
                      title: s.title,
                      kind: s.kind as "ACTIVITIES" | "TEXT",
                      purpose: redactContactData(s.purpose),
                    })),
                }),
                cognitiveDistribution: blueprint.cognitiveDistribution,
              },
              fetcher,
            );

      if (result.status !== "ok") {
        const log = await logGeneration(
          db,
          job,
          task,
          result.status === "invalid" ? "INVALID" : "UNAVAILABLE",
        );
        await fail(job, result.status, log.id);
        return;
      }

      const allowed = new Set(snapshot.dba.map((d) => d.code));
      const data: ResourceContent =
        "quiz" in result.data
          ? { type: "QUIZ", content: quizFromEngine(result.data.quiz, allowed) }
          : { type: "WORKSHOP", content: workshopFromEngine(result.data.workshop, allowed) };

      await db.$transaction(async (tx) => {
        const log = await logGeneration(tx, job, task, "OK", result.data.meta);
        await saveGenerated(tx, job, data, log.id);
      });
    });
  } catch (error) {
    logger.error("resource.generation_failed", { resourceId: job.resourceId, error });
    await fail(job, "unavailable", null).catch(() => undefined);
  }
}

async function enqueue(
  ctx: TenantContext,
  blueprint: Blueprint,
  deps: GenerationDeps,
  existing?: { id: string; format: FormatSnapshot | null },
): Promise<{ id: string }> {
  const { courseId, snapshot, preferences, format, title } =
    blueprint.type === "EXAM"
      ? await prepareExam(ctx, blueprint)
      : await prepare(ctx, blueprint, existing?.format);
  const topicIds = blueprint.type === "EXAM" ? blueprint.topicIds : [blueprint.topicId];
  const existingId = existing?.id;
  const cost = quotaCost(blueprint.type);

  const resource = await db.$transaction(async (tx) => {
    // Serializa las solicitudes del mismo docente para que el cupo no se pase en paralelo.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.membershipId}))`;
    const quota = await quotaFor(tx, ctx);
    if (quota.inFlight >= MAX_IN_FLIGHT) {
      throw rateLimited(
        `Ya tienes ${MAX_IN_FLIGHT} recursos generándose. Espera a que terminen para pedir otro.`,
      );
    }
    if (quota.used + cost > DAILY_LIMIT) {
      const at = quota.freesAtFor(cost)?.toLocaleTimeString("es-CO", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Bogota",
      });
      const left = Math.max(0, DAILY_LIMIT - quota.used);
      // CA-0011-11: el examen cuesta 2; con 1 disponible se avisa sin llamar a la IA.
      throw rateLimited(
        left > 0
          ? `Un examen usa ${cost} de tus recursos con IA y te ${left === 1 ? "queda 1" : `quedan ${left}`}.${at ? ` Podrás generarlo desde las ${at}.` : ""}`
          : `Llegaste al límite de ${DAILY_LIMIT} recursos con IA en 24 horas.${at ? ` Podrás generar otro desde las ${at}.` : ""}`,
      );
    }
    const data = {
      status: "GENERATING" as const,
      failureReason: null,
      // Marca de "generado con IA" para el cupo; se reemplaza por el id del log al terminar.
      generationId: "pending",
      blueprint: blueprint as Prisma.InputJsonValue,
      context: snapshot as Prisma.InputJsonValue,
      formatSnapshot: format ? (format as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    };
    const saved = existingId
      ? await tx.resource.update({ where: { id: existingId }, data, select: { id: true } })
      : await tx.resource.create({
          data: {
            ...data,
            institutionId: ctx.institutionId,
            membershipId: ctx.membershipId,
            courseId,
            topicId: topicIds[0]!,
            type: blueprint.type,
            title,
          },
          select: { id: true },
        });
    if (!existingId) {
      // SPEC-0011 T2: todos los temas que cubre el recurso.
      await tx.resourceTopic.createMany({
        data: topicIds.map((topicId, position) => ({
          resourceId: saved.id,
          topicId,
          position,
          institutionId: ctx.institutionId,
        })),
      });
    }
    await recordAudit(tx, {
      action: "resource.generation_requested",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "resource",
      entityId: saved.id,
      metadata: { type: blueprint.type, retry: !!existingId },
    });
    return saved;
  });

  const job: Job = {
    resourceId: resource.id,
    institutionId: ctx.institutionId,
    membershipId: ctx.membershipId,
    blueprint,
    snapshot,
    preferences,
    format,
    title,
  };
  (deps.schedule ?? runAfterResponse)(() => runGeneration(job, deps.fetcher));
  return resource;
}

/** CA-0008-01/02/04: crea el recurso en "generando" y responde; la IA trabaja después. */
export async function createResource(
  ctx: TenantContext,
  blueprint: Blueprint,
  deps: GenerationDeps = {},
) {
  requireRole(ctx, "TEACHER");
  return enqueue(ctx, blueprint, deps);
}

/** Reintenta una generación fallida con el mismo blueprint. */
export async function retryResource(
  ctx: TenantContext,
  resourceId: string,
  deps: GenerationDeps = {},
) {
  requireRole(ctx, "TEACHER");
  const resource = await ownResource(ctx, resourceId);
  if (resource.status !== "FAILED")
    throw invalid("Solo se puede reintentar una generación fallida");
  return enqueue(ctx, resource.blueprint as Blueprint, deps, {
    id: resource.id,
    format: resource.formatSnapshot as unknown as FormatSnapshot | null,
  });
}

// --- Lectura ---------------------------------------------------------------------------------

/** ADR-0008 §5: lo que lleva demasiado en "generando" se marca como interrumpido. */
export async function recoverStale(ctx: TenantContext) {
  const now = Date.now();
  await db.resource.updateMany({
    where: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      status: "GENERATING",
      OR: [
        { type: { not: "EXAM" }, updatedAt: { lt: new Date(now - STALE_MS) } },
        { type: "EXAM", updatedAt: { lt: new Date(now - EXAM_STALE_MS) } },
      ],
    },
    data: { status: "FAILED", failureReason: "interrupted" },
  });
}

async function ownResource(ctx: TenantContext, resourceId: string) {
  const resource = await db.resource.findFirst({
    where: { id: resourceId, institutionId: ctx.institutionId, membershipId: ctx.membershipId },
  });
  if (!resource) throw notFound();
  return resource;
}

export const summary = (r: {
  id: string;
  type: ResourceType;
  status: ResourceStatus;
  title: string;
  context: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): ResourceSummary => ({
  id: r.id,
  type: r.type,
  status: r.status,
  title: r.title,
  topicTitle: (r.context as unknown as Snapshot).topic.title,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/** Biblioteca del curso (SPEC-0008 §2). */
export async function listCourseResources(
  ctx: TenantContext,
  courseId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<ResourceSummary[]> {
  await getMyCourse(ctx, courseId); // NOT_FOUND si el curso es ajeno
  await recoverStale(ctx);
  const rows = await db.resource.findMany({
    where: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      courseId,
      ...(opts.includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      title: true,
      context: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map(summary);
}

async function currentContent(resourceId: string, version: number, type: ResourceType) {
  if (version === 0) return null;
  const row = await db.resourceVersion.findUnique({
    where: { resourceId_number: { resourceId, number: version } },
    select: { content: true },
  });
  if (!row) return null;
  return { type, content: row.content } as ResourceContent;
}

export async function getResource(ctx: TenantContext, resourceId: string): Promise<ResourceDetail> {
  requireRole(ctx, "TEACHER");
  await recoverStale(ctx);
  const resource = await ownResource(ctx, resourceId);
  const [data, log, feedback] = await Promise.all([
    currentContent(resource.id, resource.currentVersion, resource.type),
    resource.generationId && resource.generationId !== "pending"
      ? db.generationLog.findFirst({
          where: { id: resource.generationId, institutionId: ctx.institutionId },
          select: { model: true, promptVersion: true },
        })
      : null,
    db.resourceItemFeedback.findMany({
      where: { resourceId: resource.id },
      select: { itemKey: true, rating: true, comment: true },
    }),
  ]);
  const context = resource.context as unknown as Snapshot;
  return {
    ...summary(resource),
    courseId: resource.courseId,
    failureReason: resource.failureReason as FailureReason | null,
    blueprint: resource.blueprint as Blueprint,
    context: {
      ...context,
      dba: context.dba.map(({ code, number, statement }) => ({ code, number, statement })),
    },
    version: resource.currentVersion,
    model: log?.model ?? null,
    promptVersion: log?.promptVersion ?? null,
    data,
    format: (resource.formatSnapshot as unknown as FormatSnapshot | null) ?? null,
    rating: resource.rating,
    ratingComment: resource.ratingComment,
    itemFeedback: Object.fromEntries(
      feedback.map((f) => [f.itemKey, { rating: f.rating, comment: f.comment }]),
    ),
    canEdit: true,
    gradingScale: resource.type === "EXAM" ? scaleOf(resource.gradingScale) : null,
  };
}

/** RN-14: la escala guardada o la predeterminada (3,0 como nota mínima, lineal). */
function scaleOf(value: Prisma.JsonValue | null): GradingScale {
  const parsed = gradingScaleSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_GRADING_SCALE;
}

/** Temas del examen tal como se copiaron al generarlo (RN-12). */
const snapshotTopics = (context: Prisma.JsonValue) => {
  const snapshot = context as unknown as Snapshot;
  return (snapshot.topics ?? [snapshot.topic]).map(({ id, title }) => ({ id, title }));
};

/**
 * CA-0011-16: el docente ajusta la nota mínima o el puntaje de aprobación de la clave. No crea
 * versión nueva del contenido: la escala vive aparte y la próxima descarga la refleja.
 */
export async function setGradingScale(ctx: TenantContext, resourceId: string, input: unknown) {
  requireRole(ctx, "TEACHER");
  const resource = await editable(ctx, resourceId);
  if (resource.type !== "EXAM") throw invalid("La escala de notas solo aplica a exámenes");
  const scale = gradingScaleSchema.safeParse(input);
  if (!scale.success) throw invalid(scale.error.issues[0]?.message ?? "Escala inválida");
  const data = await currentContent(resource.id, resource.currentVersion, resource.type);
  if (data?.type === "EXAM" && scale.data.passingPoints !== null) {
    const total = examTotalPoints(data.content);
    if (scale.data.passingPoints >= total) {
      throw invalid(
        `El puntaje para aprobar debe ser menor que el total (${total})`,
        "passingPoints",
      );
    }
  }
  await db.$transaction(async (tx) => {
    await tx.resource.update({
      where: { id: resource.id },
      data: { gradingScale: scale.data as Prisma.InputJsonValue },
    });
    await recordAudit(tx, {
      action: "resource.grading_scale_updated",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "resource",
      entityId: resource.id,
      metadata: { passingGrade: scale.data.passingGrade },
    });
  });
}

/** Estado liviano para el sondeo mientras se genera (ADR-0008 §3). */
export async function getResourceStatus(ctx: TenantContext, resourceId: string) {
  requireRole(ctx, "TEACHER");
  await recoverStale(ctx);
  const resource = await ownResource(ctx, resourceId);
  return { status: resource.status, failureReason: resource.failureReason as FailureReason | null };
}

// --- Edición y estados (RN-01, RN-08) --------------------------------------------------------

const EDITABLE: ResourceStatus[] = ["DRAFT", "READY"];

async function editable(ctx: TenantContext, resourceId: string) {
  const resource = await ownResource(ctx, resourceId);
  if (!EDITABLE.includes(resource.status)) throw invalid("Este recurso no se puede editar ahora");
  return resource;
}

async function saveVersion(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
  resource: { id: string; currentVersion: number; context: Prisma.JsonValue },
  data: ResourceContent,
) {
  const allowed = new Set((resource.context as unknown as Snapshot).dba.map((d) => d.code));
  const clean = sanitizeContent(data, allowed);
  const keys = itemKeys(clean);
  if (new Set(keys).size !== keys.length) throw invalid("Hay ítems con el mismo identificador");
  const number = resource.currentVersion + 1;
  // Concurrencia optimista: si otra pestaña guardó antes, la versión ya no coincide.
  const { count } = await tx.resource.updateMany({
    where: { id: resource.id, currentVersion: resource.currentVersion },
    data: { currentVersion: number, title: clean.content.title },
  });
  if (count === 0)
    throw conflict("El recurso cambió en otra pestaña. Recarga para ver la última versión.");
  await tx.resourceVersion.create({
    data: {
      institutionId: ctx.institutionId,
      resourceId: resource.id,
      number,
      source: "TEACHER",
      content: clean.content as Prisma.InputJsonValue,
    },
  });
  return number;
}

/** CA-0008-06: cada guardado es una versión nueva; la generada (1) se conserva. */
export async function saveResourceContent(
  ctx: TenantContext,
  resourceId: string,
  expectedVersion: number,
  content: unknown,
) {
  requireRole(ctx, "TEACHER");
  const resource = await editable(ctx, resourceId);
  if (resource.currentVersion !== expectedVersion) {
    throw conflict("El recurso cambió en otra pestaña. Recarga para ver la última versión.");
  }
  const schema =
    resource.type === "QUIZ"
      ? quizContentSchema
      : resource.type === "EXAM"
        ? examContentSchema
        : workshopContentSchema;
  const result = schema.safeParse(content);
  if (!result.success) throw invalid(result.error.issues[0]?.message ?? "Contenido inválido");
  // RN-02 y RN-12: los temas del examen no se cambian al editar; salen de la copia guardada.
  const parsed = (
    resource.type === "EXAM"
      ? { type: "EXAM", content: { ...result.data, topics: snapshotTopics(resource.context) } }
      : { type: resource.type, content: result.data }
  ) as ResourceContent;
  return db.$transaction(async (tx) => {
    const number = await saveVersion(tx, ctx, resource, parsed);
    await recordAudit(tx, {
      action: "resource.edited",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "resource",
      entityId: resource.id,
      metadata: { version: number },
    });
    return { version: number };
  });
}

const TRANSITIONS: Record<
  string,
  { from: ResourceStatus[]; action: Parameters<typeof recordAudit>[1]["action"] }
> = {
  READY: { from: ["DRAFT"], action: "resource.ready" },
  DRAFT: { from: ["READY"], action: "resource.reopened" },
  ARCHIVED: { from: ["DRAFT", "READY", "FAILED"], action: "resource.archived" },
};

/** RN-01: solo el docente marca un recurso como listo. Archivar no borra nada. */
export async function setResourceStatus(
  ctx: TenantContext,
  resourceId: string,
  status: "READY" | "DRAFT" | "ARCHIVED" | "RESTORE",
) {
  requireRole(ctx, "TEACHER");
  const resource = await ownResource(ctx, resourceId);
  const restore = status === "RESTORE";
  const target: ResourceStatus = restore ? (resource.currentVersion ? "DRAFT" : "FAILED") : status;
  const rule = restore
    ? { from: ["ARCHIVED"] as ResourceStatus[], action: "resource.restored" as const }
    : TRANSITIONS[status]!;
  if (!rule.from.includes(resource.status)) throw invalid("Ese cambio de estado no es posible");
  await db.$transaction(async (tx) => {
    await tx.resource.update({ where: { id: resource.id }, data: { status: target } });
    await recordAudit(tx, {
      action: rule.action,
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "resource",
      entityId: resource.id,
    });
  });
}

/** Copia independiente en borrador (no usa la IA ni el cupo). */
export async function duplicateResource(ctx: TenantContext, resourceId: string) {
  requireRole(ctx, "TEACHER");
  const resource = await ownResource(ctx, resourceId);
  const data = await currentContent(resource.id, resource.currentVersion, resource.type);
  if (!data) throw invalid("Este recurso todavía no tiene contenido");
  const title = `Copia de ${data.content.title}`.slice(0, 200);
  return db.$transaction(async (tx) => {
    const copy = await tx.resource.create({
      data: {
        institutionId: ctx.institutionId,
        membershipId: ctx.membershipId,
        courseId: resource.courseId,
        topicId: resource.topicId,
        type: resource.type,
        status: "DRAFT",
        title,
        blueprint: resource.blueprint as Prisma.InputJsonValue,
        context: resource.context as Prisma.InputJsonValue,
        formatSnapshot: resource.formatSnapshot ?? Prisma.DbNull,
        gradingScale: resource.gradingScale ?? Prisma.DbNull,
        currentVersion: 1,
        versions: {
          create: {
            number: 1,
            source: "TEACHER",
            content: { ...data.content, title } as Prisma.InputJsonValue,
          },
        },
      },
      select: { id: true },
    });
    const topics = await tx.resourceTopic.findMany({
      where: { resourceId: resource.id, institutionId: ctx.institutionId },
      select: { topicId: true, position: true },
    });
    await tx.resourceTopic.createMany({
      data: topics.map((t) => ({ ...t, resourceId: copy.id, institutionId: ctx.institutionId })),
    });
    await recordAudit(tx, {
      action: "resource.duplicated",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "resource",
      entityId: copy.id,
      metadata: { from: resource.id },
    });
    return copy;
  });
}

// --- Regenerar una pregunta o actividad (CA-0008-07) -----------------------------------------

export async function regenerateItem(
  ctx: TenantContext,
  resourceId: string,
  itemKey: string,
  instruction: string,
  fetcher: typeof fetch = fetch,
): Promise<RegenerateResult> {
  requireRole(ctx, "TEACHER");
  const resource = await editable(ctx, resourceId);
  const data = await currentContent(resource.id, resource.currentVersion, resource.type);
  const found = data && findItem(data, itemKey);
  if (!found) throw notFound();
  const limit = await getLimiter("ai-item-regenerate", REGENERATIONS_PER_HOUR, HOUR).consume(
    ctx.membershipId,
  );
  if (!limit.allowed) throw rateLimited();

  const blueprint = resource.blueprint as Blueprint;
  const snapshot = resource.context as unknown as Snapshot;
  const preferences = preferencesForPrompt(
    await applicablePreferences(ctx, resource.courseId),
    blueprint.excludedPreferenceIds ?? [],
  );
  const cleanInstruction = redactContactData(instruction);
  const allowed = new Set(snapshot.dba.map((d) => d.code));
  let result: Awaited<ReturnType<typeof requestItem>> | Awaited<ReturnType<typeof requestExamItem>>;
  let proposal: ReturnType<typeof toQuestion | typeof toActivity | typeof toExamQuestion> | null =
    null;

  if (found.kind === "EXAM_QUESTION") {
    // SPEC-0011 CA-0011-06: mismo tipo y mismos puntos; los temas viajan con su clave.
    const topicIds = snapshotTopics(resource.context).map((t) => t.id);
    const examResult = await requestExamItem(
      {
        ...engineExamContext(snapshot, blueprint.difficulty, blueprint.notes, preferences),
        current: engineExamQuestion(found.item, topicIds),
        points: found.item.points,
        instruction: cleanInstruction,
        otherItems: found.others.slice(0, 40),
      },
      fetcher,
    );
    result = examResult;
    if (examResult.status === "ok") {
      proposal = toExamQuestion(
        examResult.data.item,
        found.item.points,
        topicIds,
        allowed,
        itemKey,
      );
    }
  } else {
    if (blueprint.type === "EXAM") throw notFound();
    const itemResult = await requestItem(
      {
        ...engineContext(snapshot, blueprint.difficulty, blueprint.notes, preferences),
        kind: found.kind,
        current: engineItem(found),
        instruction: cleanInstruction,
        durationMinutes: blueprint.durationMinutes,
        questionTypes: blueprint.type === "QUIZ" ? blueprint.questionTypes : [],
        moment: found.kind === "WORKSHOP_ACTIVITY" ? found.moment : null,
        otherItems: found.others.slice(0, 20),
      },
      fetcher,
    );
    result = itemResult;
    if (itemResult.status === "ok") {
      proposal =
        found.kind === "QUIZ_QUESTION"
          ? toQuestion(itemResult.data.item as Parameters<typeof toQuestion>[0], allowed)
          : toActivity(itemResult.data.item as Parameters<typeof toActivity>[0], allowed);
    }
  }

  const job = {
    resourceId: resource.id,
    institutionId: ctx.institutionId,
    membershipId: ctx.membershipId,
  } as Job;
  const status =
    result.status === "ok" ? "OK" : result.status === "invalid" ? "INVALID" : "UNAVAILABLE";

  // La indicación queda registrada aunque la IA no responda (CA-0008-07).
  const regeneration = await db.$transaction(async (tx) => {
    const log = await logGeneration(
      tx,
      job,
      "item_regenerate",
      status,
      result.status === "ok" ? result.data.meta : undefined,
    );
    const created = await tx.itemRegeneration.create({
      data: {
        institutionId: ctx.institutionId,
        resourceId: resource.id,
        itemKey,
        instruction: cleanInstruction,
        generationId: log.id,
        proposal: proposal ? (proposal as Prisma.InputJsonValue) : undefined,
        decision: proposal ? "PENDING" : "DISCARDED",
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: "resource.item_regenerated",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "resource",
      entityId: resource.id,
      metadata: { regenerationId: created.id, status },
    });
    return created;
  });

  if (result.status !== "ok" || !proposal)
    return { status: result.status === "ok" ? "invalid" : result.status };
  return { status: "ok", proposal: { regenerationId: regeneration.id, itemKey, item: proposal } };
}

/** El docente decide si la propuesta reemplaza al ítem (versión nueva) o la descarta. */
export async function decideRegeneration(
  ctx: TenantContext,
  regenerationId: string,
  accept: boolean,
) {
  requireRole(ctx, "TEACHER");
  const regeneration = await db.itemRegeneration.findFirst({
    where: {
      id: regenerationId,
      institutionId: ctx.institutionId,
      resource: { membershipId: ctx.membershipId },
    },
  });
  if (!regeneration) throw notFound();
  if (regeneration.decision !== "PENDING") throw invalid("Esta propuesta ya fue decidida");
  const resource = await editable(ctx, regeneration.resourceId);

  return db.$transaction(async (tx) => {
    const { count } = await tx.itemRegeneration.updateMany({
      where: { id: regeneration.id, decision: "PENDING" },
      data: { decision: accept ? "ACCEPTED" : "DISCARDED", decidedAt: new Date() },
    });
    if (count === 0) throw invalid("Esta propuesta ya fue decidida");
    if (!accept) return { version: resource.currentVersion };

    const data = await currentContent(resource.id, resource.currentVersion, resource.type);
    if (!data || !findItem(data, regeneration.itemKey)) {
      throw invalid("El ítem ya no existe en el recurso");
    }
    const item =
      resource.type === "QUIZ"
        ? quizQuestionSchema.parse(regeneration.proposal)
        : resource.type === "EXAM"
          ? examQuestionSchema.parse(regeneration.proposal)
          : activitySchema.parse(regeneration.proposal);
    const number = await saveVersion(
      tx,
      ctx,
      resource,
      replaceItem(data, regeneration.itemKey, item),
    );
    await recordAudit(tx, {
      action: "resource.edited",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "resource",
      entityId: resource.id,
      metadata: { version: number, regenerationId: regeneration.id },
    });
    return { version: number };
  });
}

// --- Evaluación docente (CA-0008-08) ---------------------------------------------------------

export async function rateResource(
  ctx: TenantContext,
  resourceId: string,
  rating: number,
  comment: string | null,
) {
  requireRole(ctx, "TEACHER");
  const resource = await ownResource(ctx, resourceId);
  if (!resource.currentVersion) throw invalid("Este recurso todavía no tiene contenido");
  await db.resource.update({
    where: { id: resource.id },
    data: { rating, ratingComment: comment || null, ratedAt: new Date() },
  });
}

export async function rateItem(
  ctx: TenantContext,
  resourceId: string,
  itemKey: string,
  rating: "UP" | "DOWN",
  comment: string | null,
) {
  requireRole(ctx, "TEACHER");
  const resource = await ownResource(ctx, resourceId);
  const data = await currentContent(resource.id, resource.currentVersion, resource.type);
  if (!data || !findItem(data, itemKey)) throw notFound();
  await db.resourceItemFeedback.upsert({
    where: { resourceId_itemKey: { resourceId: resource.id, itemKey } },
    create: {
      institutionId: ctx.institutionId,
      resourceId: resource.id,
      itemKey,
      rating,
      comment: comment || null,
    },
    update: { rating, comment: comment || null },
  });
}

// --- Preferencias del docente (RN-07, CA-0008-09) --------------------------------------------

export async function listPreferences(ctx: TenantContext, courseId: string) {
  requireRole(ctx, "TEACHER");
  await getMyCourse(ctx, courseId);
  return applicablePreferences(ctx, courseId);
}

export async function addPreference(ctx: TenantContext, courseId: string, input: PreferenceInput) {
  requireRole(ctx, "TEACHER");
  await getMyCourse(ctx, courseId);
  return db.teacherPreference.create({
    data: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      courseId: input.scope === "COURSE" ? courseId : null,
      text: input.text,
    },
    select: { id: true },
  });
}

async function ownPreference(ctx: TenantContext, preferenceId: string) {
  const preference = await db.teacherPreference.findFirst({
    where: { id: preferenceId, institutionId: ctx.institutionId, membershipId: ctx.membershipId },
    select: { id: true },
  });
  if (!preference) throw notFound();
  return preference;
}

/** Activar/desactivar o cambiar el alcance. Para "solo este curso" se usa el curso abierto. */
export async function updatePreference(
  ctx: TenantContext,
  preferenceId: string,
  change: { active?: boolean; scope?: "COURSE" | "ALL"; courseId?: string },
) {
  requireRole(ctx, "TEACHER");
  const preference = await ownPreference(ctx, preferenceId);
  if (change.scope === "COURSE") {
    if (!change.courseId) throw invalid("Falta el curso");
    await getMyCourse(ctx, change.courseId);
  }
  await db.teacherPreference.update({
    where: { id: preference.id },
    data: {
      ...(change.active !== undefined && { active: change.active }),
      ...(change.scope && { courseId: change.scope === "COURSE" ? change.courseId : null }),
    },
  });
}

export async function deletePreference(ctx: TenantContext, preferenceId: string) {
  requireRole(ctx, "TEACHER");
  const preference = await ownPreference(ctx, preferenceId);
  await db.teacherPreference.delete({ where: { id: preference.id } });
}

// --- Exportación (SPEC-0009) -----------------------------------------------------------------

/** Contenido de una versión concreta para exportar (RN-01). Solo borradores y listos (RN-05). */
export async function getResourceForExport(
  ctx: TenantContext,
  resourceId: string,
  version?: number,
) {
  requireRole(ctx, "TEACHER");
  const resource = await ownResource(ctx, resourceId);
  if (!EDITABLE.includes(resource.status)) {
    throw conflict("Este recurso no se puede descargar mientras no esté en borrador o listo");
  }
  const number = version ?? resource.currentVersion;
  if (!Number.isInteger(number) || number < 1 || number > resource.currentVersion) throw notFound();
  const data = await currentContent(resource.id, number, resource.type);
  if (!data) throw notFound();
  const context = resource.context as unknown as Snapshot;
  return {
    id: resource.id,
    type: resource.type,
    status: resource.status,
    courseId: resource.courseId,
    topicId: resource.topicId,
    version: number,
    data,
    format: (resource.formatSnapshot as unknown as FormatSnapshot | null) ?? null,
    gradingScale: resource.type === "EXAM" ? scaleOf(resource.gradingScale) : null,
    context: {
      ...context,
      dba: context.dba.map(({ code, number: n, statement }) => ({ code, number: n, statement })),
    },
  };
}
