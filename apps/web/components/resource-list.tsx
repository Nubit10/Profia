import Link from "next/link";
import {
  HiOutlineChevronRight,
  HiOutlineClipboardDocumentCheck,
  HiOutlinePencilSquare,
} from "react-icons/hi2";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  RESOURCE_TYPE_LABELS,
  STATUS_LABELS,
  type ResourceStatus,
  type ResourceSummary,
} from "@/modules/resources/client";

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

const STATUS_VARIANT: Record<ResourceStatus, "success" | "brand" | "info" | "warning" | "outline"> =
  {
    READY: "success",
    DRAFT: "brand",
    GENERATING: "info",
    FAILED: "warning",
    ARCHIVED: "outline",
  };

export function StatusBadge({ status }: { status: ResourceStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}

type Item = ResourceSummary & { courseId: string; courseTitle?: string };

/** Lista de talleres y quices con tipo, estado y fecha (SPEC-0012). */
export function ResourceList({
  resources,
  label,
  showCourse = false,
  className,
}: {
  resources: Item[];
  /** Nombre accesible de la lista. */
  label: string;
  showCourse?: boolean;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft",
        className,
      )}
      aria-label={label}
    >
      {resources.map((r) => {
        const Icon = r.type === "QUIZ" ? HiOutlineClipboardDocumentCheck : HiOutlinePencilSquare;
        return (
          <li key={r.id}>
            <Link
              href={`/courses/${r.courseId}/resources/${r.id}`}
              className="group flex items-center gap-3 p-4 transition hover:bg-brand-softer"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{r.title}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {showCourse && r.courseTitle ? `${r.courseTitle} · ` : ""}Tema: {r.topicTitle}
                </span>
              </span>
              <span className="hidden flex-col items-end gap-1 sm:flex">
                <span className="flex items-center gap-1.5">
                  <Badge variant="outline">{RESOURCE_TYPE_LABELS[r.type]}</Badge>
                  <StatusBadge status={r.status} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {dateFormat.format(r.updatedAt)}
                </span>
              </span>
              <span className="sm:hidden">
                <StatusBadge status={r.status} />
              </span>
              <HiOutlineChevronRight
                className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
