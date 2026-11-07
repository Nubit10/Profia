import Link from "next/link";
import { HiOutlineArchiveBox, HiOutlineCalendarDays, HiOutlineSparkles } from "react-icons/hi2";
import { EmptyState } from "@/components/empty-state";
import { PlanResources } from "@/components/plan-resources";
import { buttonVariants } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import type { CoursePlan } from "@/modules/planning/client";
import {
  groupByPlan,
  type QuickResourceRequest,
  type ResourceSummary,
} from "@/modules/resources/client";
import { TopicQuickCreate } from "./topic-quick-create";

/**
 * Biblioteca del curso (SPEC-0008 §2), agrupada Periodo → Unidad → Tema en el orden de la
 * planeación (SPEC-0014 RN-09, CA-0014-14 a 16). Los temas sin recursos ofrecen crearlos.
 */
export function ResourcesLibrary({
  courseId,
  plan,
  resources,
  includeArchived,
  quickCreate,
}: {
  courseId: string;
  plan: CoursePlan;
  resources: ResourceSummary[];
  includeArchived: boolean;
  quickCreate: (input: QuickResourceRequest) => Promise<ActionResult<{ id: string }>>;
}) {
  const groups = groupByPlan(
    plan,
    resources.map((r) => ({ ...r, courseId })),
    { includeEmpty: true },
  );
  const hasTopics = plan.units.some((u) => !u.archived && u.topics.some((t) => !t.archived));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link
          href={`/courses/${courseId}?tab=recursos${includeArchived ? "" : "&archivados=1"}`}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground max-sm:min-h-11"
        >
          <HiOutlineArchiveBox aria-hidden />
          {includeArchived ? "Ocultar archivados" : "Ver archivados"}
        </Link>
      </div>
      {resources.length === 0 && !hasTopics ? (
        <EmptyState
          icon={HiOutlineCalendarDays}
          title="Todavía no hay recursos en este curso"
          description="Los recursos se crean desde los temas. Planea tus temas y la IA te prepara talleres, quices y exámenes."
          action={
            <Link
              href={`/courses/${courseId}?tab=planeacion`}
              className={buttonVariants({ variant: "outline" })}
            >
              <HiOutlineSparkles aria-hidden />
              Ir a la planeación
            </Link>
          }
        />
      ) : (
        <PlanResources
          groups={groups}
          idPrefix={`c-${courseId}`}
          label="este curso"
          emptyTopic={(topic) => (
            <TopicQuickCreate courseId={courseId} topic={topic} action={quickCreate} />
          )}
        />
      )}
    </div>
  );
}
