import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { createCourseAction, listMyCourses, listSubjects } from "@/modules/courses";
import { courseTitle } from "@/modules/courses/client";
import { listCampuses } from "@/modules/institutions";
import { createQuickTopicAction, listTopicOutline } from "@/modules/planning";
import * as resources from "@/modules/resources";
import type { ExamScope } from "@/modules/resources/client";
import { requireTenant } from "@/modules/tenancy";
import { CreateWizard, type WizardKind } from "./create-wizard";

export const metadata: Metadata = { title: "Crear con IA" };

const KINDS: WizardKind[] = ["WORKSHOP", "QUIZ", "EXAM", "PLAN"];

/** `scope=UNIT:<id>` o `scope=PERIOD:<n>`: de dónde partió el examen (SPEC-0011). */
function parseScope(value: unknown): ExamScope {
  if (typeof value !== "string") return { kind: "TOPICS" };
  const [kind, ref] = value.split(":");
  if (kind === "UNIT" && ref) return { kind: "UNIT", unitId: ref };
  const n = Number(ref);
  if (kind === "PERIOD" && Number.isInteger(n) && n >= 1 && n <= 6) {
    return { kind: "PERIOD", periodNumber: n };
  }
  return { kind: "TOPICS" };
}

const timeFormat = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/**
 * Asistente de creación (SPEC-0012): qué crear → curso y tema → ajustes → confirmar. El paso sale
 * de la URL, así que volver atrás o recargar no pierde el avance (RN-04).
 */
export default async function CreatePage({ searchParams }: PageProps<"/create">) {
  const ctx = await requireTenant();
  if (!ctx.roles.includes("TEACHER")) redirect("/dashboard");

  const params = await searchParams;
  const kind = KINDS.find((k) => k === params.type) ?? null;
  const step = params.step === "confirmar" ? "confirm" : "settings";

  const [courses, outline, quota, subjects, campuses] = await Promise.all([
    listMyCourses(ctx),
    listTopicOutline(ctx),
    resources.getQuotaStatus(ctx),
    listSubjects(ctx),
    ctx.institutionType === "SCHOOL" ? listCampuses(ctx) : Promise.resolve([]),
  ]);

  // Con un solo curso no hay nada que elegir.
  const requestedCourse = courses.find((c) => c.id === params.courseId) ?? null;
  const course = requestedCourse ?? (courses.length === 1 ? courses[0]! : null);
  const topicIds = new Set(
    (outline.find((o) => o.courseId === course?.id)?.units ?? []).flatMap((u) =>
      u.topics.map((t) => t.id),
    ),
  );
  const topicId =
    typeof params.topicId === "string" && topicIds.has(params.topicId) ? params.topicId : null;

  const ignoreForeign = (error: unknown) => {
    if (
      error instanceof DomainError &&
      ["NOT_FOUND", "FORBIDDEN", "INVALID"].includes(error.code)
    ) {
      return null;
    }
    throw error;
  };

  let formContext: resources.ResourceFormContext | null = null;
  if ((kind === "WORKSHOP" || kind === "QUIZ") && topicId) {
    formContext = await resources.getResourceFormContext(ctx, topicId).catch(ignoreForeign);
  }

  // SPEC-0011: el examen usa varios temas del curso (`topics=a,b,c`).
  const scope = parseScope(params.scope);
  const examTopicIds =
    typeof params.topics === "string"
      ? params.topics.split(",").filter((id) => topicIds.has(id))
      : [];
  let examContext: resources.ExamFormContext | null = null;
  if (kind === "EXAM" && examTopicIds.length > 0) {
    examContext = await resources.getExamFormContext(ctx, examTopicIds).catch(ignoreForeign);
  }
  // Temas marcados al llegar desde "Crear examen de esta unidad / del periodo".
  const units = outline.find((o) => o.courseId === course?.id)?.units ?? [];
  const marked =
    typeof params.seleccion === "string"
      ? params.seleccion.split(",").filter((id) => topicIds.has(id))
      : [];
  const preselected =
    examTopicIds.length > 0
      ? examTopicIds
      : marked.length > 0
        ? marked
        : scope.kind === "UNIT"
          ? (units.find((u) => u.id === scope.unitId)?.topics.map((t) => t.id) ?? [])
          : scope.kind === "PERIOD"
            ? units
                .filter((u) => u.periodNumber === scope.periodNumber)
                .flatMap((u) => u.topics.map((t) => t.id))
            : [];

  return (
    <CreateWizard
      kind={kind}
      step={step}
      courses={courses.map((c) => ({
        id: c.id,
        title: courseTitle(c),
        subjectId: c.subjectId,
        subjectName: c.subjectName,
      }))}
      outline={outline}
      courseId={course?.id ?? null}
      topicId={topicId}
      formContext={formContext}
      exam={{ scope, preselected, context: examContext }}
      quota={{
        used: quota.used,
        limit: quota.limit,
        freesAtLabel: quota.freesAt ? timeFormat.format(quota.freesAt) : null,
      }}
      subjects={subjects.map(({ id, name }) => ({ id, name }))}
      campuses={campuses.map(({ id, name }) => ({ id, name }))}
      actions={{
        createCourse: createCourseAction,
        createQuickTopic: createQuickTopicAction,
        createResource: resources.createResourceAction,
        preferences: {
          add: resources.addPreferenceAction,
          update: resources.updatePreferenceAction,
          remove: resources.deletePreferenceAction,
        },
      }}
    />
  );
}
