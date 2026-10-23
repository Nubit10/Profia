import "server-only";
import { recordAuditSafely } from "@/modules/audit";
import { getMyCourse } from "@/modules/courses";
import { getLogo } from "@/modules/formats";
import { GRADE_LABELS } from "@/modules/courses/client";
import { getTopicPeriodName } from "@/modules/planning";
import { notFound } from "@/lib/errors";
import { getResourceForExport } from "@/modules/resources";
import {
  DEFAULT_GRADING_SCALE,
  RESOURCE_TYPE_LABELS,
  examTotalPoints,
} from "@/modules/resources/client";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { buildQuiz, buildWorkshop, type DocKind, type ExportContext } from "./build";
import { buildExam, formatPoints, hasAnswerSheet } from "./build-exam";
import { safeFilename } from "./filename";
import type { DocFormat, DocModel } from "./model";
import { renderDocx } from "./render-docx";
import { renderPdf } from "./render-pdf";
import type { Variant } from "./shuffle";

export type ExportRequest = {
  doc: DocKind;
  format: DocFormat;
  version?: number;
  variant: Variant;
};

export type ExportedFile = { filename: string; contentType: string; body: Buffer };

const CONTENT_TYPES: Record<DocFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

/** Arma el documento de una versión del recurso (RN-01) y registra la descarga (CA-0009-07). */
export async function exportResource(
  ctx: TenantContext,
  resourceId: string,
  request: ExportRequest,
): Promise<ExportedFile> {
  requireRole(ctx, "TEACHER");
  const resource = await getResourceForExport(ctx, resourceId, request.version);
  if (request.doc === "answers") {
    // RN-15: la hoja de respuestas solo existe en exámenes con selección múltiple o V/F.
    if (resource.data.type !== "EXAM" || !hasAnswerSheet(resource.data.content)) throw notFound();
  }
  const isExam = resource.data.type === "EXAM";
  const [course, topicPeriod] = await Promise.all([
    getMyCourse(ctx, resource.courseId),
    isExam ? Promise.resolve(null) : getTopicPeriodName(ctx, resource.topicId),
  ]);
  // El examen guarda la copia de sus periodos al generarse (RN-12).
  const period = isExam ? (resource.context.periods ?? []).join(", ") || null : topicPeriod;
  const topicsTitle = isExam
    ? (resource.context.topics ?? [resource.context.topic]).map((t) => t.title).join(", ")
    : resource.context.topic.title;
  const gradeGroup = [GRADE_LABELS[course.grade], course.groupName].filter(Boolean).join(" ");
  const school = ctx.institutionType === "SCHOOL";
  const logo = await getLogo(ctx);
  const date = dateFormat.format(new Date());

  const exportCtx: ExportContext = {
    resourceId: resource.id,
    version: resource.version,
    draft: resource.status === "DRAFT",
    dba: resource.context.dba,
    date,
    logo,
    institution: school ? ctx.institutionName : undefined,
    // SPEC-0010: valor de cada origen de campo para el encabezado del formato del docente.
    values: {
      INSTITUTION: school ? ctx.institutionName : "",
      CAMPUS: school ? (course.campusName ?? "") : "",
      TEACHER: ctx.userName,
      SUBJECT: course.subjectName,
      GRADE: GRADE_LABELS[course.grade],
      GROUP: course.groupName,
      GRADE_GROUP: gradeGroup,
      PERIOD: period ?? "",
      TOPIC: resource.context.topic.title,
      YEAR: course.academicYear,
      DATE: date,
      TITLE: resource.data.content.title,
    },
    header: [
      {
        label: school ? "Institución" : "Espacio",
        value: school ? ctx.institutionName : "Docente independiente",
      },
      ...(school && course.campusName ? [{ label: "Sede", value: course.campusName }] : []),
      { label: "Docente", value: ctx.userName },
      { label: "Asignatura", value: course.subjectName },
      { label: "Grado y grupo", value: gradeGroup },
      { label: "Periodo", value: period ?? "—" },
      { label: "Año", value: course.academicYear },
      { label: isExam ? "Temas" : "Tema", value: topicsTitle },
      ...(resource.data.type === "EXAM"
        ? [
            { label: "Duración", value: `${resource.data.content.durationMinutes} minutos` },
            { label: "Puntaje total", value: formatPoints(examTotalPoints(resource.data.content)) },
          ]
        : []),
    ],
  };

  // La hoja de respuestas es la misma para todas las versiones (RN-15).
  const variant = resource.type === "WORKSHOP" || request.doc === "answers" ? "A" : request.variant;
  const model: DocModel =
    resource.data.type === "QUIZ"
      ? buildQuiz(resource.data.content, exportCtx, request.doc, variant)
      : resource.data.type === "EXAM"
        ? buildExam(
            resource.data.content,
            exportCtx,
            request.doc,
            variant,
            resource.gradingScale ?? DEFAULT_GRADING_SCALE,
          )
        : buildWorkshop(resource.data.content, exportCtx, request.doc, resource.format);

  const body = request.format === "pdf" ? await renderPdf(model) : await renderDocx(model);

  await recordAuditSafely({
    action: "resource.exported",
    institutionId: ctx.institutionId,
    actorUserId: ctx.userId,
    entityType: "resource",
    entityId: resource.id,
    metadata: { version: resource.version, doc: request.doc, format: request.format, variant },
  });

  const keyLabel = resource.type === "WORKSHOP" ? "Guía del docente" : "Clave";
  return {
    filename: safeFilename(
      [
        request.doc === "key" ? keyLabel : request.doc === "answers" ? "Hoja de respuestas" : "",
        // "Examen: Números enteros" → "Examen - Números enteros".
        isExam
          ? resource.data.content.title.replace(/\s*:\s*/g, " - ")
          : RESOURCE_TYPE_LABELS[resource.type],
        isExam ? "" : resource.context.topic.title,
        gradeGroup.replace(/\s+/g, ""),
        variant !== "A" ? `Versión ${variant}` : "",
      ],
      request.format,
    ),
    contentType: CONTENT_TYPES[request.format],
    body,
  };
}
