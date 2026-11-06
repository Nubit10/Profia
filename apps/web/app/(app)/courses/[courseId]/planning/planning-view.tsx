"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { IconType } from "react-icons";
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArchiveBox,
  HiOutlineArrowDown,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineArrowUp,
  HiOutlineArrowUturnLeft,
  HiOutlineCalendarDays,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClipboardDocumentList,
  HiOutlineDocumentDuplicate,
  HiOutlineDocumentText,
  HiOutlineEllipsisHorizontal,
  HiOutlineExclamationTriangle,
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { SelectField } from "@/components/forms/select-field";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/action-result";
import type { CurriculumSearchResult } from "@/modules/curriculum/client";
import { cn } from "@/lib/utils";
import type {
  CoursePeriodsInput,
  CoursePlanning,
  ObjectiveInput,
  PlanningKind,
  PlanningObjective,
  PlanningTopic,
  PlanningUnit,
  ProposeObjectivesInput,
  TopicInput,
  UnitInput,
} from "@/modules/planning/client";
import type { QuickResourceRequest } from "@/modules/resources/client";
import { ObjectiveForm, PeriodsForm, TopicForm, UnitForm } from "./planning-forms";
import { ObjectivesBatchPanel, type ObjectivesBatchActions } from "./objectives-batch-panel";
import { ProposalPanel, type ProposalActions, type ProposalScope } from "./proposal-panel";
import { SuggestPanel, type SuggestActions } from "./suggest-panel";
import { useRun } from "./use-run";

type A<I, O = void> = (input: I) => Promise<ActionResult<O>>;

export type PlanningActions = {
  setPeriods: A<CoursePeriodsInput>;
  createUnit: A<UnitInput>;
  updateUnit: A<Omit<UnitInput, "courseId"> & { unitId: string }>;
  createTopic: A<TopicInput>;
  updateTopic: A<Omit<TopicInput, "unitId"> & { topicId: string }>;
  createObjective: A<ObjectiveInput>;
  updateObjective: A<Omit<ObjectiveInput, "topicId"> & { objectiveId: string }>;
  move: A<{ kind: PlanningKind; id: string; direction: "up" | "down" }>;
  archive: A<{ kind: PlanningKind; id: string; archived: boolean }>;
  suggestions: SuggestActions;
  /** SPEC-0014: proponer unidades y temas con IA y agregarlos. */
  proposal: ProposalActions;
  /** SPEC-0014: objetivos en bloque para una unidad o un periodo. */
  objectivesBatch: ObjectivesBatchActions;
  /** SPEC-0014 RN-07: crear un recurso con un toque, con los valores recomendados. */
  quickCreate: A<QuickResourceRequest, { id: string }>;
  /** SPEC-0013 RN-04: búsqueda curricular para sugerir DBA al escribir un objetivo. */
  searchCurriculum: A<{ courseId: string; query: string }, CurriculumSearchResult>;
  copy: A<
    { fromCourseId: string; toCourseId: string },
    { units: number; topics: number; objectives: number }
  >;
};

type DialogState =
  | { type: "unit"; unit?: PlanningUnit; periodNumber?: number | null }
  | { type: "topic"; unitId: string; topic?: PlanningTopic }
  | { type: "objective"; topicId: string; objective?: PlanningObjective }
  | { type: "periods" }
  | { type: "copy" }
  | { type: "suggest"; topicId: string; topicTitle: string }
  | { type: "proposalPick" }
  | { type: "proposal"; target: ProposalScope; label: string }
  | { type: "objectivesBatch"; target: ProposeObjectivesInput; label: string }
  | null;

type Props = {
  planning: CoursePlanning;
  includeArchived: boolean;
  copyTargets: { id: string; groupName: string; academicYear: string }[];
  actions: PlanningActions;
};

const DIALOG_TITLES: Record<NonNullable<DialogState>["type"], [string, string]> = {
  unit: ["Unidad", "Agrupa temas de un periodo."],
  topic: ["Tema", "Un tema reúne objetivos y sesiones de clase."],
  objective: ["Objetivo de aprendizaje", "Redáctalo y vincúlalo a los DBA del curso."],
  periods: ["Periodos del curso", "Entre 1 y 6 periodos. Las fechas son opcionales."],
  suggest: [
    "Sugerir objetivos con IA",
    "Propuestas basadas en los DBA del curso. Tú decides cuáles usar.",
  ],
  proposalPick: [
    "Proponer temas con IA",
    "Profe arma unidades y temas a partir de los DBA del grado. Tú revisas antes de agregar.",
  ],
  objectivesBatch: [
    "Objetivos propuestos",
    "Uno a tres por tema, con sus DBA. Edita o desmarca los que no quieras; nada se guarda hasta que aceptes.",
  ],
  proposal: [
    "Propuesta de temas",
    "Cambia los títulos, quita lo que no quieras y agrega el resto. Nada se guarda hasta que lo agregues.",
  ],
  copy: [
    "Copiar planeación",
    "Crea una copia independiente en otro de tus cursos de la misma asignatura y grado.",
  ],
};

/**
 * SPEC-0013 CA-0013-07: las acciones de unidad, tema y objetivo viven en un menú "⋯" (un solo
 * control a la vista por elemento). Los nombres accesibles de cada opción no cambian.
 */
function ItemActions({
  kind,
  id,
  archived,
  label,
  onEdit,
  actions,
  extra,
}: {
  kind: PlanningKind;
  id: string;
  archived: boolean;
  label: string;
  onEdit: () => void;
  actions: PlanningActions;
  /** Opciones adicionales, como "Crear examen de esta unidad". */
  extra?: ({ label: string; icon: IconType } & ({ href: string } | { onClick: () => void }))[];
}) {
  const { run, isPending } = useRun();
  if (archived) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => run(() => actions.archive({ kind, id, archived: false }), "Restaurado")}
      >
        <HiOutlineArrowUturnLeft aria-hidden />
        Restaurar
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Opciones de ${label}`}
        disabled={isPending}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0")}
      >
        <HiOutlineEllipsisHorizontal className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {extra?.map((item) =>
          "href" in item ? (
            <DropdownMenuItem key={item.label} render={<Link href={item.href} />}>
              <item.icon aria-hidden />
              {item.label}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.label} onClick={item.onClick}>
              <item.icon aria-hidden />
              {item.label}
            </DropdownMenuItem>
          ),
        )}
        {extra && extra.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem aria-label={`Editar ${label}`} onClick={onEdit}>
          <HiOutlinePencilSquare aria-hidden />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={`Subir ${label}`}
          onClick={() => run(() => actions.move({ kind, id, direction: "up" }))}
        >
          <HiOutlineArrowUp aria-hidden />
          Subir
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={`Bajar ${label}`}
          onClick={() => run(() => actions.move({ kind, id, direction: "down" }))}
        >
          <HiOutlineArrowDown aria-hidden />
          Bajar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          aria-label={`Archivar ${label}`}
          onClick={() => run(() => actions.archive({ kind, id, archived: true }), "Archivado")}
        >
          <HiOutlineArchiveBox aria-hidden />
          Archivar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ObjectiveItem({
  objective,
  warnWithoutDba,
  onEdit,
  actions,
}: {
  objective: PlanningObjective;
  warnWithoutDba: boolean;
  onEdit: () => void;
  actions: PlanningActions;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p
          className={objective.archived ? "text-sm text-muted-foreground line-through" : "text-sm"}
        >
          {objective.statement}
        </p>
        <ItemActions
          kind="objective"
          id={objective.id}
          archived={objective.archived}
          label={`objetivo «${objective.statement.slice(0, 40)}»`}
          onEdit={onEdit}
          actions={actions}
        />
      </div>
      {objective.links.length === 0 ? (
        warnWithoutDba && (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <HiOutlineExclamationTriangle aria-hidden />
            Sin DBA vinculado
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-1.5" aria-label="DBA vinculados">
          {objective.links.map((link) => (
            <li key={link.code} className="rounded-md bg-muted/60 p-2 text-xs">
              <details>
                <summary className="cursor-pointer">
                  <span className="font-medium">DBA {link.number}</span>
                  {link.evidences.length > 0 && ` · ${link.evidences.length} evidencia(s)`}
                  {link.superseded && (
                    <Badge variant="outline" className="ml-2">
                      versión anterior del MEN
                    </Badge>
                  )}
                </summary>
                <p className="mt-1.5">{link.statement}</p>
                {link.evidences.length > 0 && (
                  <ul className="mt-1 ml-4 list-disc">
                    {link.evidences.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
                <a
                  href={`${link.citation.url}#page=${link.citation.page}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-muted-foreground underline"
                >
                  {link.citation.title}, {link.citation.version} ({link.citation.year}) · pág.{" "}
                  {link.citation.page}
                  <HiOutlineArrowTopRightOnSquare className="size-3" aria-hidden />
                </a>
              </details>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function PlanningView({ planning, includeArchived, copyTargets, actions }: Props) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [copyTarget, setCopyTarget] = useState(copyTargets[0]?.id ?? "");
  const { run, isPending } = useRun();
  const router = useRouter();
  const close = () => setDialog(null);
  // Al guardar un formulario: cerrar y traer la planeación actualizada del servidor.
  const done = () => {
    setDialog(null);
    router.refresh();
  };
  const { course, periods, units, coverage } = planning;
  // SPEC-0014 CA-0014-07: sin DBA en el catálogo, la IA no tiene de dónde proponer.
  const canPropose = planning.hasArea && coverage.total > 0;
  const proposeFor = (target: ProposalScope, label: string) =>
    setDialog({ type: "proposal", target, label });
  const [quickPending, startQuick] = useTransition();
  const [quickKey, setQuickKey] = useState<string | null>(null);
  /** RN-07: genera con los valores recomendados y lleva a la página del recurso. */
  const quick = (key: string, input: QuickResourceRequest, label: string) => {
    setQuickKey(key);
    startQuick(async () => {
      const result = await actions.quickCreate(input);
      if (!result.ok) {
        setQuickKey(null);
        // El cupo se revisa antes de llamar a la IA: el mensaje dice cuándo se puede (CA-0014-11).
        sileo.error({ title: `No pudimos crear el ${label}`, description: result.error });
        return;
      }
      sileo.success({
        title: `${label.charAt(0).toUpperCase()}${label.slice(1)} en preparación`,
        description: "Puedes salir de esta página: lo encontrarás en Mis recursos.",
      });
      router.push(`/courses/${course.id}/resources/${result.data!.id}`);
    });
  };
  const busyWith = (key: string) => quickPending && quickKey === key;
  const proposeObjectives = (target: ProposeObjectivesInput, label: string) =>
    setDialog({ type: "objectivesBatch", target, label });
  const proposePeriod = (number: number, name: string) =>
    proposeFor({ scope: "PERIOD", courseId: course.id, periodNumber: number }, name);

  const groups = [
    ...periods.map((p) => ({
      key: `p${p.number}`,
      period: p,
      units: units.filter((u) => u.periodNumber === p.number),
    })),
    { key: "none", period: null, units: units.filter((u) => u.periodNumber === null) },
  ].filter((g) => g.period || g.units.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setDialog({ type: "unit" })}>
          <HiOutlinePlus aria-hidden />
          Nueva unidad
        </Button>
        {canPropose && (
          <Button variant="outline" onClick={() => setDialog({ type: "proposalPick" })}>
            <HiOutlineSparkles aria-hidden />
            Proponer temas con IA
          </Button>
        )}
        <Button variant="outline" onClick={() => setDialog({ type: "periods" })}>
          <HiOutlineCalendarDays aria-hidden />
          Periodos
        </Button>
        {copyTargets.length > 0 && units.length > 0 && (
          <Button variant="outline" onClick={() => setDialog({ type: "copy" })}>
            <HiOutlineDocumentDuplicate aria-hidden />
            Copiar a otro curso
          </Button>
        )}
        <Link
          href={`/courses/${course.id}?tab=planeacion${includeArchived ? "" : "&archivados=1"}`}
          className="ml-auto flex items-center text-sm text-muted-foreground underline max-sm:min-h-11"
        >
          {includeArchived ? "Ocultar archivados" : "Ver archivados"}
        </Link>
      </div>

      {planning.hasArea && coverage.total > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              Cobertura de DBA: {coverage.covered.length} de {coverage.total}
            </CardTitle>
            <CardDescription>DBA del grado que ya están en un tema o un objetivo.</CardDescription>
          </CardHeader>
          {coverage.pending.length > 0 && (
            <CardContent>
              <details>
                <summary className="cursor-pointer text-sm">
                  Ver DBA pendientes ({coverage.pending.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-1 text-sm" aria-label="DBA pendientes">
                  {coverage.pending.map((p) => (
                    <li key={p.code}>
                      <span className="font-medium">DBA {p.number}.</span> {p.statement}
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          )}
        </Card>
      )}

      {units.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Empieza tu planeación</CardTitle>
            <CardDescription>
              {canPropose
                ? "Profe puede proponerte las unidades y los temas de todo el año a partir de los DBA del grado. Tú revisas y decides qué agregar."
                : "Crea unidades por periodo, agrega temas y redacta objetivos. Con esa estructura Profe podrá ayudarte a generar materiales."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canPropose ? (
              <Button
                variant="outline"
                onClick={() => proposeFor({ scope: "YEAR", courseId: course.id }, "Todo el año")}
              >
                <HiOutlineSparkles aria-hidden />
                Proponer el año con IA
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Esta asignatura no tiene DBA en el catálogo, así que Profe no puede proponer temas.
                Agrégalos a mano.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {groups.map((group) => (
        <section
          key={group.key}
          className="flex flex-col gap-3"
          aria-labelledby={`${group.key}-title`}
        >
          {group.units.length === 0 ? (
            // SPEC-0013 CA-0013-08: un periodo vacío ocupa una sola línea.
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-border px-4 py-1.5">
              <h2
                id={`${group.key}-title`}
                className="flex items-baseline gap-2 text-base font-semibold"
              >
                {group.period ? group.period.name : "Sin periodo"}
              </h2>
              <span className="mr-auto text-sm text-muted-foreground">Sin unidades</span>
              {canPropose && group.period && (
                <Button
                  variant="ghost"
                  onClick={() => proposePeriod(group.period!.number, group.period!.name)}
                >
                  <HiOutlineSparkles aria-hidden />
                  Proponer temas con IA
                  <span className="sr-only"> para {group.period.name}</span>
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() =>
                  setDialog({ type: "unit", periodNumber: group.period?.number ?? null })
                }
              >
                <HiOutlinePlus aria-hidden />
                Agregar unidad
                <span className="sr-only">
                  {" "}
                  en {group.period ? group.period.name : "sin periodo"}
                </span>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id={`${group.key}-title`}
                  className="flex items-baseline gap-2 text-lg font-semibold"
                >
                  {group.period ? group.period.name : "Sin periodo"}
                  {group.period?.startDate && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {group.period.startDate} – {group.period.endDate ?? "…"}
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap items-center gap-1">
                  {canPropose && group.period && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => proposePeriod(group.period!.number, group.period!.name)}
                    >
                      <HiOutlineSparkles aria-hidden />
                      Proponer temas con IA
                      <span className="sr-only"> para {group.period.name}</span>
                    </Button>
                  )}
                  {/* SPEC-0011 §7: un periodo sin temas activos no ofrece examen. */}
                  {group.period &&
                    group.units.some((u) => !u.archived && u.topics.some((t) => !t.archived)) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Opciones de ${group.period.name}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                            "shrink-0",
                          )}
                        >
                          <HiOutlineEllipsisHorizontal className="size-5" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          {canPropose && (
                            <DropdownMenuItem
                              onClick={() =>
                                proposeObjectives(
                                  {
                                    scope: "PERIOD",
                                    courseId: course.id,
                                    periodNumber: group.period!.number,
                                  },
                                  group.period!.name,
                                )
                              }
                            >
                              <HiOutlineSparkles aria-hidden />
                              Proponer objetivos
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            disabled={quickPending}
                            onClick={() =>
                              quick(
                                `period-${group.period!.number}`,
                                {
                                  type: "EXAM",
                                  scope: {
                                    kind: "PERIOD",
                                    courseId: course.id,
                                    periodNumber: group.period!.number,
                                  },
                                },
                                "examen",
                              )
                            }
                          >
                            <HiOutlineClipboardDocumentList aria-hidden />
                            Crear examen del periodo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            render={
                              <Link
                                href={`/create?type=EXAM&courseId=${planning.course.id}&scope=PERIOD:${group.period.number}`}
                              />
                            }
                          >
                            <HiOutlineAdjustmentsHorizontal aria-hidden />
                            Ajustar examen del periodo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                </div>
              </div>

              <ol
                className="flex flex-col gap-3"
                aria-label={`Unidades de ${group.period?.name ?? "sin periodo"}`}
              >
                {group.units.map((unit) => (
                  <li key={unit.id}>
                    <Card className={unit.archived ? "opacity-60" : undefined}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle>{unit.title}</CardTitle>
                            {unit.description && (
                              <CardDescription>{unit.description}</CardDescription>
                            )}
                          </div>
                          <ItemActions
                            kind="unit"
                            id={unit.id}
                            archived={unit.archived}
                            label={`unidad «${unit.title}»`}
                            onEdit={() => setDialog({ type: "unit", unit })}
                            actions={actions}
                            extra={
                              unit.archived
                                ? undefined
                                : [
                                    ...(canPropose && unit.periodNumber !== null
                                      ? [
                                          {
                                            label: "Proponer temas",
                                            icon: HiOutlineSparkles,
                                            onClick: () =>
                                              proposeFor(
                                                { scope: "UNIT", unitId: unit.id },
                                                unit.title,
                                              ),
                                          },
                                        ]
                                      : []),
                                    ...(unit.topics.some((t) => !t.archived)
                                      ? [
                                          ...(canPropose
                                            ? [
                                                {
                                                  label: "Proponer objetivos",
                                                  icon: HiOutlineSparkles,
                                                  onClick: () =>
                                                    proposeObjectives(
                                                      { scope: "UNIT", unitId: unit.id },
                                                      unit.title,
                                                    ),
                                                },
                                              ]
                                            : []),
                                          {
                                            label: "Crear examen de esta unidad",
                                            icon: HiOutlineClipboardDocumentList,
                                            onClick: () =>
                                              quick(
                                                `unit-${unit.id}`,
                                                {
                                                  type: "EXAM",
                                                  scope: { kind: "UNIT", unitId: unit.id },
                                                },
                                                "examen",
                                              ),
                                          },
                                          {
                                            label: "Ajustar examen de esta unidad",
                                            href: `/create?type=EXAM&courseId=${planning.course.id}&scope=UNIT:${unit.id}`,
                                            icon: HiOutlineAdjustmentsHorizontal,
                                          },
                                        ]
                                      : []),
                                  ]
                            }
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <ol className="flex flex-col gap-3" aria-label={`Temas de ${unit.title}`}>
                          {unit.topics.map((topic) => (
                            <li key={topic.id} className="rounded-lg border bg-muted/30 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3
                                    className={
                                      topic.archived
                                        ? "font-medium text-muted-foreground line-through"
                                        : "font-medium"
                                    }
                                  >
                                    {topic.title}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    {topic.plannedSessions
                                      ? `${topic.plannedSessions} sesiones`
                                      : "Sesiones sin definir"}
                                    {topic.description ? ` · ${topic.description}` : ""}
                                  </p>
                                </div>
                                <ItemActions
                                  kind="topic"
                                  id={topic.id}
                                  archived={topic.archived}
                                  label={`tema «${topic.title}»`}
                                  onEdit={() =>
                                    setDialog({ type: "topic", unitId: unit.id, topic })
                                  }
                                  actions={actions}
                                  extra={[
                                    {
                                      label: "Ajustar antes de crear",
                                      href: `/create?courseId=${planning.course.id}&topicId=${topic.id}`,
                                      icon: HiOutlineAdjustmentsHorizontal,
                                    },
                                  ]}
                                />
                              </div>
                              <ol
                                className="mt-2 flex flex-col gap-2"
                                aria-label={`Objetivos de ${topic.title}`}
                              >
                                {topic.objectives.map((objective) => (
                                  <ObjectiveItem
                                    key={objective.id}
                                    objective={objective}
                                    warnWithoutDba={planning.areaHasItems}
                                    onEdit={() =>
                                      setDialog({ type: "objective", topicId: topic.id, objective })
                                    }
                                    actions={actions}
                                  />
                                ))}
                              </ol>
                              {!topic.archived && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() =>
                                    setDialog({ type: "objective", topicId: topic.id })
                                  }
                                >
                                  <HiOutlinePlus aria-hidden />
                                  Agregar objetivo
                                </Button>
                              )}
                              {!topic.archived && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() =>
                                    setDialog({
                                      type: "suggest",
                                      topicId: topic.id,
                                      topicTitle: topic.title,
                                    })
                                  }
                                >
                                  <HiOutlineSparkles aria-hidden />
                                  Sugerir objetivos con IA
                                </Button>
                              )}
                              {!topic.archived &&
                                (
                                  [
                                    ["QUIZ", "quiz", "Crear quiz", HiOutlineClipboardDocumentCheck],
                                    ["WORKSHOP", "taller", "Crear taller", HiOutlineDocumentText],
                                  ] as const
                                ).map(([type, noun, text, Icon]) => (
                                  <Button
                                    key={type}
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 border-brand-border text-brand-strong hover:bg-brand-soft"
                                    disabled={quickPending}
                                    aria-busy={busyWith(`${type}-${topic.id}`)}
                                    onClick={() =>
                                      quick(
                                        `${type}-${topic.id}`,
                                        { type, topicId: topic.id },
                                        noun,
                                      )
                                    }
                                  >
                                    <Icon aria-hidden />
                                    {busyWith(`${type}-${topic.id}`) ? "Creando…" : text}
                                    <span className="sr-only"> de «{topic.title}»</span>
                                  </Button>
                                ))}
                            </li>
                          ))}
                        </ol>
                        {!unit.archived && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            onClick={() => setDialog({ type: "topic", unitId: unit.id })}
                          >
                            <HiOutlinePlus aria-hidden />
                            Agregar tema
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      ))}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent
          className={
            dialog?.type === "proposal" || dialog?.type === "objectivesBatch"
              ? "sm:max-w-2xl"
              : "sm:max-w-xl"
          }
        >
          {dialog && (
            <DialogHeader>
              <DialogTitle>
                {dialog.type === "proposal"
                  ? `Propuesta de temas · ${dialog.label}`
                  : dialog.type === "objectivesBatch"
                    ? `Objetivos propuestos · ${dialog.label}`
                    : DIALOG_TITLES[dialog.type][0]}
              </DialogTitle>
              <DialogDescription>{DIALOG_TITLES[dialog.type][1]}</DialogDescription>
            </DialogHeader>
          )}
          {dialog?.type === "unit" && (
            <UnitForm
              courseId={course.id}
              periods={periods}
              initial={dialog.unit}
              defaultPeriod={dialog.periodNumber}
              onSubmit={(v) =>
                dialog.unit
                  ? actions.updateUnit({
                      unitId: dialog.unit.id,
                      title: v.title,
                      description: v.description,
                      periodNumber: v.periodNumber,
                    })
                  : actions.createUnit(v)
              }
              onDone={done}
            />
          )}
          {dialog?.type === "topic" && (
            <TopicForm
              unitId={dialog.unitId}
              initial={dialog.topic}
              onSubmit={(v) =>
                dialog.topic
                  ? actions.updateTopic({
                      topicId: dialog.topic.id,
                      title: v.title,
                      description: v.description,
                      plannedSessions: v.plannedSessions,
                    })
                  : actions.createTopic(v)
              }
              onDone={done}
            />
          )}
          {dialog?.type === "objective" && (
            <ObjectiveForm
              topicId={dialog.topicId}
              references={planning.references.filter((r) => r.type === "DBA")}
              hasArea={planning.hasArea}
              suggestDba={async (query) => {
                const result = await actions.searchCurriculum({
                  courseId: planning.course.id,
                  query,
                });
                if (!result.ok || result.data?.status !== "ok") return null;
                return result.data.references.filter((r) => r.type === "DBA").map((r) => r.code);
              }}
              initial={
                dialog.objective && {
                  statement: dialog.objective.statement,
                  links: dialog.objective.links.map((l) => ({
                    code: l.code,
                    evidenceIndexes: l.evidenceIndexes,
                  })),
                }
              }
              onSubmit={(v) =>
                dialog.objective
                  ? actions.updateObjective({
                      objectiveId: dialog.objective.id,
                      statement: v.statement,
                      links: v.links,
                    })
                  : actions.createObjective(v)
              }
              onDone={done}
            />
          )}
          {dialog?.type === "proposalPick" && (
            <div className="flex flex-col gap-2" role="group" aria-label="Para qué periodo">
              {periods.map((p) => {
                const count = units.filter(
                  (u) => u.periodNumber === p.number && !u.archived,
                ).length;
                return (
                  <Button
                    key={p.number}
                    variant="outline"
                    className="h-auto justify-between py-2.5"
                    onClick={() => proposePeriod(p.number, p.name)}
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {count === 0 ? "Vacío" : count === 1 ? "1 unidad" : `${count} unidades`}
                    </span>
                  </Button>
                );
              })}
              <Button
                variant="outline"
                className="h-auto justify-between py-2.5"
                onClick={() => proposeFor({ scope: "YEAR", courseId: course.id }, "Todo el año")}
              >
                <span className="font-semibold">Todo el año</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Reparte los {coverage.total} DBA entre los periodos
                </span>
              </Button>
            </div>
          )}
          {dialog?.type === "objectivesBatch" && (
            <ObjectivesBatchPanel
              key={JSON.stringify(dialog.target)}
              target={dialog.target}
              actions={actions.objectivesBatch}
              onDone={close}
            />
          )}
          {dialog?.type === "proposal" && (
            <ProposalPanel
              key={JSON.stringify(dialog.target)}
              target={dialog.target}
              actions={actions.proposal}
              onDone={close}
            />
          )}
          {dialog?.type === "suggest" && (
            <SuggestPanel topicId={dialog.topicId} actions={actions.suggestions} />
          )}
          {dialog?.type === "periods" && (
            <PeriodsForm
              courseId={course.id}
              periods={periods}
              onSubmit={actions.setPeriods}
              onDone={done}
            />
          )}
          {dialog?.type === "copy" && (
            <div className="flex flex-col gap-4">
              <SelectField
                id="copy-target"
                value={copyTarget}
                onChange={setCopyTarget}
                options={copyTargets.map((t) => ({
                  value: t.id,
                  label: `${course.subjectName}${t.groupName ? ` · ${t.groupName}` : ""} · ${t.academicYear}`,
                }))}
              />
              <p className="text-sm text-muted-foreground">
                Se agregará al final de la planeación de ese curso. Lo archivado no se copia.
              </p>
              <Button
                disabled={!copyTarget || isPending}
                onClick={() =>
                  run(
                    () => actions.copy({ fromCourseId: course.id, toCourseId: copyTarget }),
                    "Planeación copiada",
                    close,
                  )
                }
              >
                Copiar planeación
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
