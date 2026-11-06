import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  HiOutlineArrowLeft,
  HiOutlineBookOpen,
  HiOutlineCalendarDays,
  HiOutlineRectangleStack,
  HiOutlineSparkles,
} from "react-icons/hi2";
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
import { listCourseResources } from "@/modules/resources";
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
  { id: "referentes", label: "DBA y Estándares", icon: HiOutlineBookOpen },
] as const;
type Tab = (typeof TABS)[number]["id"];

async function load(courseId: string, includeArchived: boolean) {
  const ctx = await requireTenant();
  try {
    // getCoursePlanning valida que el curso sea del docente y trae también sus referentes.
    const [data, copyTargets, resources] = await Promise.all([
      planning.getCoursePlanning(ctx, courseId, { includeArchived }),
      planning.listCopyTargets(ctx, courseId),
      listCourseResources(ctx, courseId, { includeArchived }),
    ]);
    return { data, copyTargets, resources };
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
  const { data, copyTargets, resources } = await load(courseId, includeArchived);
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
        <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <span
            aria-hidden
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold",
              tint.bg,
              tint.fg,
            )}
          >
            {course.subjectName.charAt(0)}
          </span>
          {/* SPEC-0013 CA-0013-25: el texto tiene una base de ancho, así el botón baja a su propia
              línea en el celular en vez de partir el título. */}
          <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
            <h1 className="text-2xl font-extrabold text-balance sm:text-3xl">
              {courseTitle(course)}
            </h1>
            <p className="text-muted-foreground">
              Año {course.academicYear}
              {areaName ? ` · Área curricular: ${areaName}` : ""}
            </p>
          </div>
          <Link
            href={`/create?courseId=${course.id}`}
            className={cn(buttonVariants({ variant: "brand", size: "lg" }), "max-sm:w-full")}
          >
            <HiOutlineSparkles aria-hidden />
            Crear con IA
          </Link>
        </div>
      </div>

      <nav
        aria-label="Secciones del curso"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card p-1 shadow-soft sm:flex"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={`/courses/${course.id}?tab=${t.id}`}
              aria-current={active === t.id ? "page" : undefined}
              className={cn(
                // En el celular las tres pestañas se ven completas (sin cortarse): columnas iguales.
                "flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-sm leading-tight font-semibold transition max-sm:flex-col max-sm:gap-1 max-sm:text-xs sm:shrink-0 sm:px-4 sm:whitespace-nowrap",
                active === t.id
                  ? "bg-brand text-white shadow-soft"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>

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
          resources={resources}
          includeArchived={includeArchived}
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
