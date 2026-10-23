import Link from "next/link";
import { HiOutlineArchiveBox, HiOutlineSparkles } from "react-icons/hi2";
import { EmptyState } from "@/components/empty-state";
import { ResourceList } from "@/components/resource-list";
import { buttonVariants } from "@/components/ui/button";
import type { ResourceSummary } from "@/modules/resources/client";

/** Biblioteca del curso (SPEC-0008 §2): talleres y quices con su estado. */
export function ResourcesLibrary({
  courseId,
  resources,
  includeArchived,
}: {
  courseId: string;
  resources: ResourceSummary[];
  includeArchived: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link
          href={`/courses/${courseId}?tab=recursos${includeArchived ? "" : "&archivados=1"}`}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <HiOutlineArchiveBox aria-hidden />
          {includeArchived ? "Ocultar archivados" : "Ver archivados"}
        </Link>
      </div>
      {resources.length === 0 ? (
        <EmptyState
          icon={HiOutlineSparkles}
          title="Todavía no hay recursos en este curso"
          description="Elige un tema y la IA te prepara un taller o un quiz que luego revisas."
          action={
            <Link
              href={`/create?courseId=${courseId}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Crear taller o quiz
            </Link>
          }
        />
      ) : (
        <ResourceList
          resources={resources.map((r) => ({ ...r, courseId }))}
          label="Recursos del curso"
        />
      )}
    </div>
  );
}
