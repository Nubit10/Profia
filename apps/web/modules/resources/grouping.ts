// SPEC-0014 RN-09 (F-04): cada recurso en un solo lugar de la planeación, Periodo → Unidad → Tema.
// Función pura: recibe la planeación actual del curso y sus recursos y no toca la base.
import type { CoursePlan } from "@/modules/planning/client";
import type { ResourceSummary } from "./types";

type Placeable = Pick<ResourceSummary, "id" | "type" | "topicIds">;

export type PlanTopicGroup<R> = { id: string; title: string; resources: R[] };

export type PlanUnitGroup<R> = {
  id: string;
  title: string;
  topics: PlanTopicGroup<R>[];
  /** Exámenes cuyos temas están todos en esta unidad. */
  exams: R[];
};

export type PlanPeriodGroup<R> = {
  /** null = unidades sin periodo. */
  number: number | null;
  name: string;
  units: PlanUnitGroup<R>[];
  /** Exámenes de varias unidades del mismo periodo. */
  exams: R[];
  /** Recursos de temas (o unidades) archivados de este periodo. */
  archived: { unitTitle: string; topicTitle: string; resources: R[] }[];
};

export type PlanGroups<R> = {
  periods: PlanPeriodGroup<R>[];
  /** Exámenes con temas de varios periodos. */
  yearExams: R[];
  /** Recursos cuyo tema ya no está en la planeación (no debería pasar: borrar un tema los borra). */
  unplaced: R[];
  /** Cuántos recursos quedaron ubicados en total (incluye exámenes y archivados). */
  count: number;
};

type TopicPlace = {
  periodNumber: number | null;
  unitId: string;
  unitTitle: string;
  topicTitle: string;
  archived: boolean;
};

/**
 * Agrupa los recursos según la planeación. Con `includeEmpty`, los temas activos sin recursos
 * también aparecen (CA-0014-15: "Recursos del curso" ofrece crearlos); sin él, solo los que tienen
 * algo (CA-0014-17: "Mis recursos"). Dentro de cada tema se conserva el orden recibido.
 */
export function groupByPlan<R extends Placeable>(
  plan: CoursePlan,
  resources: readonly R[],
  { includeEmpty = false }: { includeEmpty?: boolean } = {},
): PlanGroups<R> {
  const places = new Map<string, TopicPlace>();
  for (const unit of plan.units) {
    for (const topic of unit.topics) {
      places.set(topic.id, {
        periodNumber: unit.periodNumber,
        unitId: unit.id,
        unitTitle: unit.title,
        topicTitle: topic.title,
        archived: unit.archived || topic.archived,
      });
    }
  }

  const byTopic = new Map<string, R[]>();
  const unitExams = new Map<string, R[]>();
  const periodExams = new Map<number | null, R[]>();
  const archived = new Map<
    number | null,
    Map<string, { unitTitle: string; topicTitle: string; resources: R[] }>
  >();
  const yearExams: R[] = [];
  const unplaced: R[] = [];
  const push = <K>(map: Map<K, R[]>, key: K, r: R) => map.set(key, [...(map.get(key) ?? []), r]);
  const pushArchived = (place: TopicPlace, key: string, r: R) => {
    const inPeriod = archived.get(place.periodNumber) ?? new Map();
    const entry = inPeriod.get(key) ?? {
      unitTitle: place.unitTitle,
      topicTitle: place.topicTitle,
      resources: [],
    };
    entry.resources.push(r);
    inPeriod.set(key, entry);
    archived.set(place.periodNumber, inPeriod);
  };

  for (const r of resources) {
    const found = r.topicIds.map((id) => places.get(id)).filter((p): p is TopicPlace => !!p);
    if (found.length === 0) {
      unplaced.push(r);
      continue;
    }
    if (r.type !== "EXAM" || r.topicIds.length === 1) {
      const place = found[0]!;
      if (place.archived) pushArchived(place, r.topicIds[0]!, r);
      else push(byTopic, r.topicIds[0]!, r);
      continue;
    }
    // RN-09: el examen va en la unidad o el periodo de su alcance; si cruza periodos, en el año.
    const unitIds = new Set(found.map((p) => p.unitId));
    const periods = new Set(found.map((p) => p.periodNumber));
    if (unitIds.size === 1) {
      const place = found[0]!;
      const unitArchived = plan.units.find((u) => u.id === place.unitId)?.archived ?? false;
      if (unitArchived)
        pushArchived({ ...place, topicTitle: "Exámenes" }, `exam:${place.unitId}`, r);
      else push(unitExams, place.unitId, r);
    } else if (periods.size === 1) {
      push(periodExams, found[0]!.periodNumber, r);
    } else {
      yearExams.push(r);
    }
  }

  // Periodos del curso en orden; luego los que solo existen en unidades y al final "Sin periodo".
  const numbers = [
    ...new Set<number | null>([
      ...plan.periods.map((p) => p.number),
      ...plan.units
        .map((u) => u.periodNumber)
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b),
      ...(plan.units.some((u) => u.periodNumber === null) ? [null] : []),
    ]),
  ];
  const nameOf = (n: number | null) =>
    n === null ? "Sin periodo" : (plan.periods.find((p) => p.number === n)?.name ?? `Periodo ${n}`);

  const periods: PlanPeriodGroup<R>[] = numbers.map((number) => ({
    number,
    name: nameOf(number),
    units: plan.units
      .filter((u) => u.periodNumber === number && !u.archived)
      .map((u) => ({
        id: u.id,
        title: u.title,
        topics: u.topics
          .filter((t) => !t.archived)
          .map((t) => ({ id: t.id, title: t.title, resources: byTopic.get(t.id) ?? [] }))
          .filter((t) => includeEmpty || t.resources.length > 0),
        exams: unitExams.get(u.id) ?? [],
      }))
      .filter((u) => includeEmpty || u.topics.length > 0 || u.exams.length > 0),
    exams: periodExams.get(number) ?? [],
    archived: [...(archived.get(number)?.values() ?? [])],
  }));

  const kept = periods.filter(
    (p) =>
      p.units.length > 0 ||
      p.exams.length > 0 ||
      p.archived.length > 0 ||
      (includeEmpty && p.number !== null),
  );
  return {
    periods: kept,
    yearExams,
    unplaced,
    count: resources.length - unplaced.length,
  };
}
