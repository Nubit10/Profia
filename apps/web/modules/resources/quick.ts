import "server-only";
import { invalid } from "@/lib/errors";
import { getCoursePlanning, getUnitCourseId } from "@/modules/planning";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import {
  EXAM_LIMITS,
  WORKSHOP_STRUCTURES,
  blueprintSchema,
  defaultsForGrade,
  distributePoints,
  examDefaultsForGrade,
  type Blueprint,
} from "./schemas";
import { createResource, getResourceFormContext, type GenerationDeps } from "./service";

// SPEC-0014 RN-07 (F-05): un recurso con un toque, con los valores recomendados del grado. Es el
// mismo blueprint que arma el asistente sin tocar nada, así que pasa por la misma generación
// (SPEC-0008/0011), el mismo cupo y los mismos avisos.

export type QuickResourceInput =
  | { type: "QUIZ" | "WORKSHOP"; topicId: string }
  | {
      type: "EXAM";
      scope:
        | { kind: "UNIT"; unitId: string }
        | { kind: "PERIOD"; courseId: string; periodNumber: number };
    };

/** Blueprint de quiz o taller con los valores del asistente sin cambios. */
export async function quickTopicBlueprint(
  ctx: TenantContext,
  type: "QUIZ" | "WORKSHOP",
  topicId: string,
): Promise<Blueprint> {
  const context = await getResourceFormContext(ctx, topicId); // NOT_FOUND si es ajeno
  const defaults = defaultsForGrade(context.grade);
  const base = {
    topicId: context.topic.id,
    // RN-07: todos los objetivos del tema (el blueprint admite hasta 5).
    objectiveIds: context.objectives.slice(0, 5).map((o) => o.id),
    durationMinutes: defaults.durationMinutes,
    difficulty: defaults.difficulty,
    cognitiveDistribution: defaults.distribution,
    notes: null,
    excludedPreferenceIds: [],
  };
  if (type === "QUIZ") {
    return blueprintSchema.parse({
      ...base,
      type,
      itemCount: defaults.quizCount,
      questionTypes: defaults.questionTypes,
    });
  }
  // SPEC-0010 RN-08: el formato predeterminado del docente (o del colegio), si tiene.
  const format = context.formats.find((f) => f.id === context.defaultFormatId);
  const minimum = format
    ? Math.max(2, format.sections.filter((s) => s.kind === "ACTIVITIES").length)
    : WORKSHOP_STRUCTURES.START_DEVELOPMENT_CLOSE.moments.length;
  return blueprintSchema.parse({
    ...base,
    type,
    itemCount: Math.max(defaults.workshopCount, minimum),
    // SPEC-0016 RN-01: con un toque se repite la última elección del docente sobre el DUA.
    udl: context.lastUdl,
    ...(format
      ? { structure: "CUSTOM", formatId: format.id }
      : { structure: "START_DEVELOPMENT_CLOSE" }),
  });
}

/** Blueprint del examen de una unidad o un periodo, con todos sus temas activos. */
export async function quickExamBlueprint(
  ctx: TenantContext,
  scope: Extract<QuickResourceInput, { type: "EXAM" }>["scope"],
): Promise<Blueprint> {
  const courseId =
    scope.kind === "UNIT" ? await getUnitCourseId(ctx, scope.unitId) : scope.courseId;
  const planning = await getCoursePlanning(ctx, courseId); // NOT_FOUND si es ajeno
  const units = planning.units.filter(
    (u) =>
      !u.archived &&
      (scope.kind === "UNIT" ? u.id === scope.unitId : u.periodNumber === scope.periodNumber),
  );
  const topicIds = units.flatMap((u) => u.topics.filter((t) => !t.archived).map((t) => t.id));
  if (topicIds.length === 0) throw invalid("No hay temas para evaluar todavía");
  if (topicIds.length > EXAM_LIMITS.topics.max) {
    throw invalid(
      `Son ${topicIds.length} temas y un examen cubre hasta ${EXAM_LIMITS.topics.max}. Usa "Ajustar antes" para elegirlos.`,
    );
  }
  const defaults = examDefaultsForGrade(planning.course.grade);
  return blueprintSchema.parse({
    type: "EXAM",
    scope:
      scope.kind === "UNIT"
        ? { kind: "UNIT", unitId: scope.unitId }
        : { kind: "PERIOD", periodNumber: scope.periodNumber },
    topicIds,
    objectiveIds: [],
    durationMinutes: defaults.durationMinutes,
    difficulty: defaults.difficulty,
    totalPoints: 100,
    sections: distributePoints(defaults.sections, 100).map((s) => ({ ...s, instructions: null })),
    cognitiveDistribution: defaults.distribution,
    notes: null,
    excludedPreferenceIds: [],
  });
}

/** CA-0014-10/11: arma el blueprint recomendado y empieza a generar (cupo y avisos de siempre). */
export async function createResourceQuick(
  ctx: TenantContext,
  input: QuickResourceInput,
  deps: GenerationDeps = {},
) {
  requireRole(ctx, "TEACHER");
  const blueprint =
    input.type === "EXAM"
      ? await quickExamBlueprint(ctx, input.scope)
      : await quickTopicBlueprint(ctx, input.type, input.topicId);
  return createResource(ctx, blueprint, deps);
}
