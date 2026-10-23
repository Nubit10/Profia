"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  HiOutlineArchiveBox,
  HiOutlineArrowDown,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineArrowUp,
  HiOutlineArrowUturnLeft,
  HiOutlineCalendarDays,
  HiOutlineClipboardDocumentList,
  HiOutlineDocumentDuplicate,
  HiOutlineDocumentText,
  HiOutlineExclamationTriangle,
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineSparkles,
} from "react-icons/hi2";
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
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import type {
  CoursePeriodsInput,
  CoursePlanning,
  ObjectiveInput,
  PlanningKind,
  PlanningObjective,
  PlanningTopic,
  PlanningUnit,
  TopicInput,
  UnitInput,
} from "@/modules/planning/client";
import { ObjectiveForm, PeriodsForm, TopicForm, UnitForm } from "./planning-forms";
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
  copy: A<
    { fromCourseId: string; toCourseId: string },
    { units: number; topics: number; objectives: number }
  >;
};

type DialogState =
  | { type: "unit"; unit?: PlanningUnit }
  | { type: "topic"; unitId: string; topic?: PlanningTopic }
  | { type: "objective"; topicId: string; objective?: PlanningObjective }
  | { type: "periods" }
  | { type: "copy" }
  | { type: "suggest"; topicId: string; topicTitle: string }
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
  copy: [
    "Copiar planeación",
    "Crea una copia independiente en otro de tus cursos de la misma asignatura y grado.",
  ],
};

function ItemActions({
  kind,
  id,
  archived,
  label,
  onEdit,
  actions,
}: {
  kind: PlanningKind;
  id: string;
  archived: boolean;
  label: string;
  onEdit: () => void;
  actions: PlanningActions;
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
    <span className="flex shrink-0 items-center">
      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${label}`} onClick={onEdit}>
        <HiOutlinePencilSquare aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Subir ${label}`}
        disabled={isPending}
        onClick={() => run(() => actions.move({ kind, id, direction: "up" }))}
      >
        <HiOutlineArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Bajar ${label}`}
        disabled={isPending}
        onClick={() => run(() => actions.move({ kind, id, direction: "down" }))}
      >
        <HiOutlineArrowDown aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Archivar ${label}`}
        disabled={isPending}
        onClick={() => run(() => actions.archive({ kind, id, archived: true }), "Archivado")}
      >
        <HiOutlineArchiveBox aria-hidden />
      </Button>
    </span>
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
          className="ml-auto text-sm text-muted-foreground underline"
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
            <CardDescription>DBA del grado vinculados a al menos un objetivo.</CardDescription>
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
              Crea unidades por periodo, agrega temas y redacta objetivos vinculados a los DBA. Con
              esa estructura Profe podrá ayudarte a generar materiales.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {groups.map((group) => (
        <section
          key={group.key}
          className="flex flex-col gap-3"
          aria-labelledby={`${group.key}-title`}
        >
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
            {/* SPEC-0011 §7: un periodo sin temas activos no ofrece examen. */}
            {group.period &&
              group.units.some((u) => !u.archived && u.topics.some((t) => !t.archived)) && (
                <Link
                  href={`/create?type=EXAM&courseId=${planning.course.id}&scope=PERIOD:${group.period.number}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  <HiOutlineClipboardDocumentList aria-hidden />
                  Crear examen del periodo
                </Link>
              )}
          </div>
          {group.units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin unidades en este periodo.</p>
          ) : (
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
                        <div className="flex items-center gap-1">
                          {!unit.archived && unit.topics.some((t) => !t.archived) && (
                            <Link
                              href={`/create?type=EXAM&courseId=${planning.course.id}&scope=UNIT:${unit.id}`}
                              className={buttonVariants({ variant: "ghost", size: "sm" })}
                            >
                              <HiOutlineClipboardDocumentList aria-hidden />
                              Crear examen de esta unidad
                            </Link>
                          )}
                          <ItemActions
                            kind="unit"
                            id={unit.id}
                            archived={unit.archived}
                            label={`unidad «${unit.title}»`}
                            onEdit={() => setDialog({ type: "unit", unit })}
                            actions={actions}
                          />
                        </div>
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
                                onEdit={() => setDialog({ type: "topic", unitId: unit.id, topic })}
                                actions={actions}
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
                                onClick={() => setDialog({ type: "objective", topicId: topic.id })}
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
                            {!topic.archived && (
                              <Link
                                href={`/create?courseId=${planning.course.id}&topicId=${topic.id}`}
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "mt-2 border-brand-border text-brand-strong hover:bg-brand-soft",
                                )}
                              >
                                <HiOutlineDocumentText aria-hidden />
                                Crear taller o quiz
                              </Link>
                            )}
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
          )}
        </section>
      ))}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {dialog && (
            <DialogHeader>
              <DialogTitle>{DIALOG_TITLES[dialog.type][0]}</DialogTitle>
              <DialogDescription>{DIALOG_TITLES[dialog.type][1]}</DialogDescription>
            </DialogHeader>
          )}
          {dialog?.type === "unit" && (
            <UnitForm
              courseId={course.id}
              periods={periods}
              initial={dialog.unit}
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
