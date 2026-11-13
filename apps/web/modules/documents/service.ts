import "server-only";
import JSZip from "jszip";
import { recordAuditSafely } from "@/modules/audit";
import { getMyCourse } from "@/modules/courses";
import { getLogo } from "@/modules/formats";
import { GRADE_LABELS } from "@/modules/courses/client";
import { getTopicPeriodName } from "@/modules/planning";
import { notFound } from "@/lib/errors";
import { getPiarForExport } from "@/modules/piar";
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
import { buildPiar } from "./build-piar";
import { renderDocx } from "./render-docx";
import { renderPdf } from "./render-pdf";
import { VARIANTS, type Variant } from "./shuffle";

export type ExportRequest = {
  doc: DocKind;
  format: DocFormat;
  version?: number;
  variant: Variant;
  /** SPEC-0013 RN-14: guardar sin conexión no es una descarga del docente; no se audita así. */
  offline?: boolean;
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

  if (!request.offline) {
    await recordAuditSafely({
      action: "resource.exported",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "resource",
      entityId: resource.id,
      metadata: { version: resource.version, doc: request.doc, format: request.format, variant },
    });
  }

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

export type BundleRequest = {
  docs: DocKind[];
  format: DocFormat;
  /** Cuántas versiones A–D (1 = solo A). El taller siempre tiene una. */
  variants: number;
  version?: number;
};

/** "Clave - Quiz - La recta numérica - 6°6C - Versión B.pdf" → "Quiz - La recta numérica - 6°6C". */
function bundleBase(filename: string) {
  return filename
    .replace(/\.(pdf|docx)$/, "")
    .replace(/^(Clave|Guía del docente|Hoja de respuestas) - /, "")
    .replace(/ - Versión [A-D]$/, "");
}

/**
 * SPEC-0013 RN-06: varios documentos (hoja y clave, y sus versiones) en un solo `.zip`, con los
 * mismos nombres de SPEC-0009. Cada documento pasa por `exportResource` (permisos, tenant y
 * auditoría). Si uno falla, falla todo: nunca se entrega un paquete incompleto.
 */
export async function exportBundle(
  ctx: TenantContext,
  resourceId: string,
  request: BundleRequest,
): Promise<ExportedFile> {
  const variants = VARIANTS.slice(0, Math.min(Math.max(request.variants, 1), VARIANTS.length));
  const files: ExportedFile[] = [];
  for (const doc of [...new Set(request.docs)]) {
    // La hoja de respuestas es la misma para todas las versiones (RN-15 de SPEC-0011).
    for (const variant of doc === "answers" ? (["A"] as const) : variants) {
      const file = await exportResource(ctx, resourceId, {
        doc,
        format: request.format,
        version: request.version,
        variant,
      });
      // El taller no tiene versiones: la B, C y D darían el mismo archivo.
      if (!files.some((f) => f.filename === file.filename)) files.push(file);
    }
  }
  if (files.length === 1) return files[0]!;
  const zip = new JSZip();
  for (const file of files) zip.file(file.filename, file.body);
  const body = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const student = files.find(
    (f) => !/^(Clave|Guía del docente|Hoja de respuestas) - /.test(f.filename),
  );
  return {
    filename: `${bundleBase((student ?? files[0]!).filename)}.zip`,
    contentType: "application/zip",
    body,
  };
}

/**
 * SPEC-0017: el PIAR en Word o PDF. `getPiarForExport` comprueba el dueño y audita la descarga sin
 * contenido. El nombre del archivo lleva solo las iniciales: queda en el historial de descargas.
 */
export async function exportPiar(
  ctx: TenantContext,
  piarId: string,
  format: DocFormat,
): Promise<ExportedFile> {
  const piar = await getPiarForExport(ctx, piarId);
  const school = ctx.institutionType === "SCHOOL";
  const model = buildPiar(piar, {
    logo: await getLogo(ctx),
    institution: school ? ctx.institutionName : undefined,
    teacherName: ctx.userName,
    date: dateFormat.format(new Date()),
  });
  const initials = piar.content.student.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]!.toLocaleUpperCase("es")}.`)
    .join("");
  return {
    filename: safeFilename(
      ["PIAR", initials, piar.course.subjectName, piar.course.gradeLabel, piar.academicYear],
      format,
    ),
    contentType: CONTENT_TYPES[format],
    body: format === "pdf" ? await renderPdf(model) : await renderDocx(model),
  };
}
