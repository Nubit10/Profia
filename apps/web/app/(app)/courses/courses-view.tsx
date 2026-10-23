"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  HiOutlineArchiveBox,
  HiOutlineArrowUturnLeft,
  HiOutlineEllipsisVertical,
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineSquares2X2,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/action-result";
import { subjectTint } from "@/lib/subject-tint";
import { cn } from "@/lib/utils";
import { courseTitle, type CourseInput, type Grade } from "@/modules/courses/client";
import { CourseForm, type Option } from "./course-form";

export type CourseItem = {
  id: string;
  subjectId: string;
  subjectName: string;
  grade: Grade;
  groupName: string;
  academicYear: string;
  campusId: string;
  campusName: string;
  archived: boolean;
};

type Props = {
  spaceName: string;
  courses: CourseItem[];
  subjects: Option[];
  campuses: Option[];
  createCourse: (input: CourseInput) => Promise<ActionResult<{ id: string }>>;
  updateCourse: (input: CourseInput & { courseId: string }) => Promise<ActionResult>;
  setCourseArchived: (input: { courseId: string; archived: boolean }) => Promise<ActionResult>;
};

/** Diálogo para crear o editar un curso; lo usan "Mis cursos" y el Inicio. */
export function CourseDialog({
  editing,
  onClose,
  subjects,
  campuses,
  createCourse,
  updateCourse,
}: {
  editing: CourseItem | "new" | null;
  onClose: () => void;
  subjects: Option[];
  campuses: Option[];
  createCourse: Props["createCourse"];
  updateCourse?: Props["updateCourse"];
}) {
  const router = useRouter();
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing === "new" ? "Nuevo curso" : "Editar curso"}</DialogTitle>
          <DialogDescription>
            Un curso es una asignatura que dictas en un grado y grupo.
          </DialogDescription>
        </DialogHeader>
        {editing !== null && (
          <CourseForm
            key={editing === "new" ? "new" : editing.id}
            course={editing === "new" ? undefined : editing}
            subjects={subjects}
            campuses={campuses}
            onSubmit={(values) =>
              editing === "new" || !updateCourse
                ? createCourse(values)
                : updateCourse({ ...values, courseId: editing.id })
            }
            onDone={() => {
              sileo.success({ title: editing === "new" ? "Curso creado" : "Curso actualizado" });
              onClose();
              router.refresh();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CoursesView(props: Props) {
  const { courses, subjects, campuses } = props;
  const router = useRouter();
  const [editing, setEditing] = useState<CourseItem | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isPending, startTransition] = useTransition();

  const visible = courses.filter((c) => c.archived === showArchived);
  const archivedCount = courses.filter((c) => c.archived).length;
  const showCampus = campuses.length > 1;

  const archive = (course: CourseItem, archived: boolean) =>
    startTransition(async () => {
      const result = await props.setCourseArchived({ courseId: course.id, archived });
      if (!result.ok) {
        sileo.error({ title: "No pudimos actualizar el curso", description: result.error });
        return;
      }
      sileo.success({ title: archived ? "Curso archivado" : "Curso restaurado" });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={props.spaceName}
        title="Mis cursos"
        description="Cada curso es una asignatura en un grado y grupo. Entra a uno para planear y crear material."
        actions={
          <Button size="lg" onClick={() => setEditing("new")}>
            <HiOutlinePlus aria-hidden />
            Nuevo curso
          </Button>
        }
      />

      {visible.length === 0 ? (
        showArchived ? (
          <EmptyState
            icon={HiOutlineArchiveBox}
            title="No tienes cursos archivados"
            description="Los cursos que archives aparecerán aquí."
          />
        ) : (
          <EmptyState
            icon={HiOutlineSquares2X2}
            title="Aún no tienes cursos"
            description="Crea tu primer curso para empezar a planear y generar talleres y quices."
            action={<Button onClick={() => setEditing("new")}>Crear mi primer curso</Button>}
          />
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Cursos">
          {visible.map((course) => {
            const tint = subjectTint(course.subjectId);
            return (
              <li key={course.id}>
                <article className="group relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold",
                        tint.bg,
                        tint.fg,
                      )}
                    >
                      {course.subjectName.charAt(0)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h2 className="text-base leading-snug font-bold">
                        {course.archived ? (
                          courseTitle(course)
                        ) : (
                          <Link
                            href={`/courses/${course.id}`}
                            className="after:absolute after:inset-0 after:rounded-2xl hover:text-brand-strong"
                          >
                            {courseTitle(course)}
                          </Link>
                        )}
                      </h2>
                      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Año {course.academicYear}</span>
                        {showCampus && <Badge variant="secondary">{course.campusName}</Badge>}
                        {course.archived && <Badge variant="outline">Archivado</Badge>}
                      </p>
                    </div>
                    {course.archived ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => archive(course, false)}
                        className="relative z-10"
                      >
                        <HiOutlineArrowUturnLeft aria-hidden />
                        Restaurar
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Opciones de ${courseTitle(course)}`}
                          className="relative z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <HiOutlineEllipsisVertical className="size-5" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(course)}>
                            <HiOutlinePencilSquare aria-hidden />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isPending}
                            onClick={() => archive(course, true)}
                          >
                            <HiOutlineArchiveBox aria-hidden />
                            Archivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {(archivedCount > 0 || showArchived) && (
        <Button variant="link" className="w-fit px-0" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Ver cursos activos" : `Ver archivados (${archivedCount})`}
        </Button>
      )}

      <CourseDialog
        editing={editing}
        onClose={() => setEditing(null)}
        subjects={subjects}
        campuses={campuses}
        createCourse={props.createCourse}
        updateCourse={props.updateCourse}
      />
    </div>
  );
}
