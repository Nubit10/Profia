import Link from "next/link";
import {
  HiOutlineChevronRight,
  HiOutlineClipboardDocumentCheck,
  HiOutlinePencilSquare,
} from "react-icons/hi2";
import { Badge } from "@/components/ui/badge";
import { OfflineBadge } from "@/components/offline/offline-panel";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  RESOURCE_TYPE_LABELS,
  STATUS_LABELS,
  type ResourceStatus,
  type ResourceSummary,
} from "@/modules/resources/client";

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

type Item = ResourceSummary & { courseId: string; courseTitle?: string; version?: number };

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
                {/* En el celular el título ocupa hasta dos líneas en vez de cortarse a la mitad. */}
                <span className="line-clamp-2 font-semibold break-words sm:truncate">
                  {r.title}
                </span>
                <span className="line-clamp-2 text-sm text-muted-foreground sm:truncate">
                  {showCourse && r.courseTitle ? `${r.courseTitle} · ` : ""}Tema: {r.topicTitle}
                </span>
                {/* SPEC-0013 RN-14: si está guardado en este dispositivo para usarlo sin conexión. */}
                <span className="flex flex-wrap items-center gap-1.5 empty:hidden">
                  {/* En el celular el estado va debajo del título, no apretado contra la flecha. */}
                  <span className="sm:hidden">
                    <StatusBadge status={r.status} />
                  </span>
                  {r.version !== undefined && (
                    <OfflineBadge resourceId={r.id} version={r.version} />
                  )}
                </span>
              </span>
              <span className="hidden flex-col items-end gap-1 sm:flex">
                <span className="flex items-center gap-1.5">
                  <Badge variant="outline">{RESOURCE_TYPE_LABELS[r.type]}</Badge>
                  <StatusBadge status={r.status} />
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(r.updatedAt)}</span>
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
