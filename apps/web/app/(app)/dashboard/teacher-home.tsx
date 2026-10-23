"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { IconType } from "react-icons";
import {
  HiOutlineArrowRight,
  HiOutlineCalendarDays,
  HiOutlineClipboardDocumentCheck,
  HiOutlineFolderOpen,
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { TutorialCard } from "@/components/app-shell/tutorial";
import { EmptyState } from "@/components/empty-state";
import { ResourceList, StatusBadge } from "@/components/resource-list";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { subjectTint } from "@/lib/subject-tint";
import { cn } from "@/lib/utils";
import type { CourseInput } from "@/modules/courses/client";
import { RESOURCE_TYPE_LABELS, type NextStep, type TeacherHome } from "@/modules/resources/client";
import type { Option } from "../courses/course-form";
import { CourseDialog } from "../courses/courses-view";

type Props = {
  userName: string;
  spaceName: string;
  home: TeacherHome;
  showTutorial: boolean;
  subjects: Option[];
  campuses: Option[];
  createCourse: (input: CourseInput) => Promise<ActionResult<{ id: string }>>;
  dismissTutorial: () => Promise<ActionResult>;
};

const QUICK: { label: string; description: string; href: string; icon: IconType }[] = [
  {
    label: "Taller",
    description: "Actividades por momentos",
    href: "/create?type=WORKSHOP",
    icon: HiOutlinePencilSquare,
  },
  {
    label: "Quiz",
    description: "Preguntas con su clave",
    href: "/create?type=QUIZ",
    icon: HiOutlineClipboardDocumentCheck,
  },
  {
    label: "Planeación",
    description: "Periodos, unidades y temas",
    href: "/create?type=PLAN",
    icon: HiOutlineCalendarDays,
  },
];

/** Texto y destino de la tarjeta "Siguiente paso" (RN-02). */
function nextStepView(step: NextStep) {
  switch (step.kind) {
    case "CREATE_COURSE":
      return {
        title: "Crea tu primer curso",
        text: "Elige asignatura, grado y grupo. Toma menos de un minuto y luego planeas tus temas.",
        cta: "Crear mi primer curso",
        href: null,
      };
    case "PLAN":
      return {
        title: "Planea los temas de tu curso",
        text: `Agrega los temas que vas a enseñar en ${step.courseTitle}. Con ellos Profe prepara tu material.`,
        cta: "Planear ahora",
        href: `/courses/${step.courseId}?tab=planeacion`,
      };
    case "FIRST_WORKSHOP":
      return {
        title: "Crea tu primer taller",
        text: `Para «${step.topicTitle}» de ${step.courseTitle}. La IA lo prepara en segundos y tú lo revisas.`,
        cta: "Crear mi primer taller",
        href: `/create?type=WORKSHOP&courseId=${step.courseId}&topicId=${step.topicId}`,
      };
    case "OPEN_LAST":
      return {
        title: "Sigue donde quedaste",
        text: `${step.resource.title} · ${step.resource.courseTitle}`,
        cta: `Abrir ${RESOURCE_TYPE_LABELS[step.resource.type].toLowerCase()}`,
        href: `/courses/${step.resource.courseId}/resources/${step.resource.id}`,
      };
  }
}

export function TeacherHomeView(props: Props) {
  const { home } = props;
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [tutorial, setTutorial] = useState(props.showTutorial);
  const [, startTransition] = useTransition();
  const step = nextStepView(home.nextStep);

  const dismissTutorial = () => {
    setTutorial(false);
    startTransition(async () => {
      await props.dismissTutorial();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-brand-strong">{props.spaceName}</p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Hola, {props.userName}</h1>
        <p className="text-muted-foreground">¿Qué vas a preparar hoy?</p>
      </header>

      {tutorial && <TutorialCard onDismiss={dismissTutorial} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <section
          aria-labelledby="next-step-title"
          className="relative overflow-hidden rounded-3xl border border-brand-border bg-card p-6 shadow-soft sm:p-8 lg:col-span-2"
          data-testid="next-step"
        >
          <div aria-hidden className="absolute inset-0 bg-hero opacity-80" />
          <div className="relative flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-brand-strong">
              <HiOutlineSparkles aria-hidden />
              Siguiente paso
            </p>
            <h2 id="next-step-title" className="text-xl font-extrabold sm:text-2xl">
              {step.title}
            </h2>
            <p className="max-w-xl text-muted-foreground">{step.text}</p>
            {home.nextStep.kind === "OPEN_LAST" && (
              <div>
                <StatusBadge status={home.nextStep.resource.status} />
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {step.href ? (
                <Link href={step.href} className={buttonVariants({ variant: "brand", size: "xl" })}>
                  {step.cta}
                  <HiOutlineArrowRight aria-hidden />
                </Link>
              ) : (
                <Button variant="brand" size="xl" onClick={() => setCreatingCourse(true)}>
                  {step.cta}
                  <HiOutlineArrowRight aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="quick-title"
          className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 shadow-soft"
        >
          <h2 id="quick-title" className="text-base font-bold">
            Crear rápido
          </h2>
          <ul className="flex flex-col gap-2">
            {QUICK.map(({ label, description, href, icon: Icon }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-2xl border border-border p-3 transition hover:border-brand-border hover:bg-brand-softer"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong transition group-hover:bg-brand group-hover:text-white">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">Crear {label.toLowerCase()}</span>
                    <span className="text-sm text-muted-foreground">{description}</span>
                  </span>
                  <HiOutlineArrowRight
                    className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {home.courses.length > 0 && (
        <section aria-labelledby="courses-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="courses-title" className="text-lg font-extrabold">
              Tus cursos
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setCreatingCourse(true)}>
                <HiOutlinePlus aria-hidden />
                Nuevo curso
              </Button>
              <Link href="/courses" className={buttonVariants({ variant: "ghost" })}>
                Ver todos
                <HiOutlineArrowRight aria-hidden />
              </Link>
            </div>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Cursos">
            {home.courses.slice(0, 6).map((course) => {
              const tint = subjectTint(course.subjectId);
              return (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.id}`}
                    className="group flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
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
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-bold group-hover:text-brand-strong">
                        {course.title}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {course.topicCount === 0
                          ? "Sin temas todavía"
                          : `${course.topicCount} ${course.topicCount === 1 ? "tema" : "temas"}`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {home.courses.length > 0 && (
        <section aria-labelledby="recent-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="recent-title" className="text-lg font-extrabold">
              Recientes
            </h2>
            {home.recent.length > 0 && (
              <Link href="/resources" className={buttonVariants({ variant: "ghost" })}>
                Ver mis recursos
                <HiOutlineArrowRight aria-hidden />
              </Link>
            )}
          </div>
          {home.recent.length === 0 ? (
            <EmptyState
              icon={HiOutlineFolderOpen}
              title="Aquí verás tus talleres y quices"
              description="Lo que crees con IA queda guardado y lo puedes editar y descargar cuando quieras."
              action={
                <Link href="/create?type=QUIZ" className={buttonVariants({ variant: "outline" })}>
                  Crear un quiz
                </Link>
              }
            />
          ) : (
            <ResourceList resources={home.recent} label="Recursos recientes" showCourse />
          )}
        </section>
      )}

      <CourseDialog
        editing={creatingCourse ? "new" : null}
        onClose={() => setCreatingCourse(false)}
        subjects={props.subjects}
        campuses={props.campuses}
        createCourse={props.createCourse}
      />
    </div>
  );
}
