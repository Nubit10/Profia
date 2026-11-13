import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  HiOutlineArrowLeft,
  HiOutlineBookOpen,
  HiOutlineCalendarDays,
  HiOutlineRectangleStack,
} from "react-icons/hi2";
import { AiAvatar } from "@/components/brand/ai-avatar";
import { ScrollableRow } from "@/components/scrollable-row";
import { buttonVariants } from "@/components/ui/button";
import { subjectTint } from "@/lib/subject-tint";
import { LINKABLE_AREAS } from "@/lib/curriculum-areas";
import { DomainError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { linkSubjectToAreaAction } from "@/modules/courses";
import { courseTitle } from "@/modules/courses/client";
import { searchCurriculumAction } from "@/modules/curriculum";
import * as generation from "@/modules/generation";
import * as planning from "@/modules/planning";
import { listCourseResources, quickCreateResourceAction } from "@/modules/resources";
import { requireTenant } from "@/modules/tenancy";
import { LinkSubjectArea } from "./link-subject-area";
import { PlanningView } from "./planning/planning-view";
import { ReferencesView } from "./references-view";
import { ResourcesLibrary } from "./resources-library";

export const metadata: Metadata = { title: "Curso" };

const TABS = [
  { id: "planeacion", label: "Planeación", icon: HiOutlineCalendarDays },
  { id: "recursos", label: "Recursos", icon: HiOutlineRectangleStack },
  // Decisión 4 de SPEC-0012: "Referentes" se llama "DBA y Estándares" en la UI.
  // En el celular, "DBA": las tres pestañas caben completas sin cortarse.
  { id: "referentes", label: "DBA y Estándares", short: "DBA", icon: HiOutlineBookOpen },
] as const;
type Tab = (typeof TABS)[number]["id"];

async function load(courseId: string, includeArchived: boolean) {
  const ctx = await requireTenant();
  try {
    // getCoursePlanning valida que el curso sea del docente y trae también sus referentes.
    const [data, copyTargets, resources, plans] = await Promise.all([
      planning.getCoursePlanning(ctx, courseId, { includeArchived }),
      planning.listCopyTargets(ctx, courseId),
      listCourseResources(ctx, courseId, { includeArchived }),
      planning.listCoursePlans(ctx, [courseId]),
    ]);
    const plan = plans[0] ?? { courseId, periods: [], units: [] };
    return { data, copyTargets, resources, plan };
  } catch (error) {
    // CA-0004-07 / CA-0006-08: curso de otro docente o de otro espacio → 404.
    if (error instanceof DomainError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code)) notFound();
    throw error;
  }
}

export default async function CoursePage({
  params,
  searchParams,
}: PageProps<"/courses/[courseId]">) {
  const { courseId } = await params;
  const { tab, archivados } = await searchParams;
  const active: Tab = TABS.find((t) => t.id === tab)?.id ?? "planeacion";
  const includeArchived = archivados === "1";
  const { data, copyTargets, resources, plan } = await load(courseId, includeArchived);
  const { course, areaName } = data;

  const tint = subjectTint(course.subjectId);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/courses"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground max-sm:min-h-11"
        >
          <HiOutlineArrowLeft aria-hidden />
          Volver a cursos
        </Link>
        {/* Celular: sin tarjeta, solo el curso (el botón flotante "Crear" ya está a mano).
            Escritorio: tarjeta con "Crear con IA". */}
        <div className="flex items-center gap-3 sm:gap-4 sm:rounded-3xl sm:border sm:border-border sm:bg-card sm:p-6 sm:shadow-soft">
          <span
            aria-hidden
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold sm:size-14 sm:text-2xl",
              tint.bg,
              tint.fg,
            )}
          >
            {course.subjectName.charAt(0)}
          </span>
          {/* SPEC-0013 CA-0013-25: el texto tiene una base de ancho, así el botón baja a su propia
              línea en el celular en vez de partir el título. */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* El grado y el grupo no se separan: nunca empieza una línea con "· 6°". */}
            <h1 className="text-xl font-extrabold sm:text-3xl">
              {course.subjectName}
              <span className="whitespace-nowrap">
                {courseTitle(course).slice(course.subjectName.length)}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Año {course.academicYear}
              {areaName ? ` · Área curricular: ${areaName}` : ""}
            </p>
          </div>
          <Link
            href={`/create?courseId=${course.id}`}
            className={cn(buttonVariants({ variant: "brand", size: "lg" }), "max-sm:hidden")}
          >
            <AiAvatar size={20} tone="light" />
            Crear con IA
          </Link>
        </div>
      </div>

      {/* Pestañas en una línea con subrayado; si no caben, la fila se desliza (patrón CliqCut). */}
      <ScrollableRow
        as="nav"
        label="Secciones del curso"
        className="-mx-4 border-b border-border sm:mx-0"
        rowClassName="gap-1 px-4 sm:gap-2 sm:px-0"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = active === t.id;
          return (
            <Link
              key={t.id}
              href={`/courses/${course.id}?tab=${t.id}`}
              aria-current={on ? "page" : undefined}
              data-active={on ? "" : undefined}
              aria-label={t.label}
              className={cn(
                "relative flex min-h-11 shrink-0 items-center gap-2 rounded-t-lg px-3 text-sm font-semibold whitespace-nowrap transition",
                "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
                on
                  ? "text-brand-strong after:bg-brand"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {"short" in t ? (
                <>
                  <span className="sm:hidden">{t.short}</span>
                  <span className="max-sm:hidden">{t.label}</span>
                </>
              ) : (
                t.label
              )}
            </Link>
          );
        })}
      </ScrollableRow>

      {active === "planeacion" ? (
        <PlanningView
          planning={data}
          includeArchived={includeArchived}
          copyTargets={copyTargets}
          actions={{
            setPeriods: planning.setCoursePeriodsAction,
            createUnit: planning.createUnitAction,
            updateUnit: planning.updateUnitAction,
            createTopic: planning.createTopicAction,
            updateTopic: planning.updateTopicAction,
            createObjective: planning.createObjectiveAction,
            updateObjective: planning.updateObjectiveAction,
            move: planning.moveItemAction,
            archive: planning.setItemArchivedAction,
            copy: planning.copyPlanningAction,
            searchCurriculum: searchCurriculumAction,
            objectivesBatch: {
              propose: generation.proposeObjectivesBatchAction,
              accept: planning.acceptObjectivesBatchAction,
            },
            quickCreate: quickCreateResourceAction,
            proposal: {
              propose: generation.proposePlanningAction,
              accept: planning.acceptPlanningProposalAction,
            },
            suggestions: {
              suggest: generation.suggestObjectivesAction,
              accept: generation.acceptSuggestionAction,
              discard: generation.discardSuggestionAction,
              rate: generation.rateSuggestionAction,
            },
          }}
        />
      ) : active === "recursos" ? (
        <ResourcesLibrary
          courseId={course.id}
          plan={plan}
          resources={resources}
          includeArchived={includeArchived}
          quickCreate={quickCreateResourceAction}
        />
      ) : !data.hasArea ? (
        <LinkSubjectArea
          subjectId={course.subjectId}
          subjectName={course.subjectName}
          areas={LINKABLE_AREAS.map((a) => ({ id: a.id, name: a.name }))}
          action={linkSubjectToAreaAction}
        />
      ) : (
        <ReferencesView
          courseId={course.id}
          searchAction={searchCurriculumAction}
          references={data.references}
          emptyForGrade={data.references.length === 0}
        />
      )}
    </div>
  );
}
