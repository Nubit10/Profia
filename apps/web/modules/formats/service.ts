import "server-only";
import { db, type Prisma } from "@/lib/db";
import { forbidden, invalid, notFound, rateLimited } from "@/lib/errors";
import { hasRole } from "@/lib/permissions";
import { getLimiter } from "@/lib/rate-limit";
import { redactContactData } from "@/lib/text";
import { recordAudit } from "@/modules/audit";
import { requestFormatAnalysis } from "@/modules/generation";
import { isSchoolAdmin, type TenantContext } from "@/modules/tenancy";
import { detectStructure, heuristicStructure } from "./detect";
import { extractBlocks } from "./extract";
import { checkLogo } from "./logo";
import { saveFormatSchema, type FormatStructure, type SaveFormatInput } from "./schemas";
import type { FormatProposal, FormatSnapshot, FormatView, LogoInfo } from "./types";

const HOUR = 60 * 60 * 1000;
const ANALYSES_PER_HOUR = 20;

/** Docentes y administradores (un administrador de colegio puede no dictar clase). */
function requireMember(ctx: TenantContext) {
  if (!hasRole(ctx.roles, "TEACHER") && !hasRole(ctx.roles, "ADMIN")) throw forbidden();
}

/** RN-02: quita de un texto los nombres del docente y de la institución, correos y teléfonos. */
function scrub(ctx: TenantContext, text: string): string {
  let out = redactContactData(text);
  for (const name of [ctx.userName, ctx.institutionName]) {
    if (name && name.length >= 4) {
      out = out.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

const GUIDE_TITLE = /gu[ií]a|taller|actividad|plan de clase/i;

/**
 * CA-0010-01/02: extrae la estructura del DOCX y le pide a la IA el origen de cada campo y el tipo
 * de cada sección. Si la IA no responde, queda la propuesta heurística. Nada se guarda (RN-03).
 */
export async function analyzeFormatFile(
  ctx: TenantContext,
  data: Buffer,
  filename: string,
  fetcher: typeof fetch = fetch,
): Promise<FormatProposal> {
  requireMember(ctx);
  const limit = await getLimiter("format-analysis", ANALYSES_PER_HOUR, HOUR).consume(
    ctx.membershipId,
  );
  if (!limit.allowed) throw rateLimited();

  const detection = detectStructure(await extractBlocks(data));
  const structure = heuristicStructure(detection);
  const warnings = [...detection.warnings];
  const name =
    detection.titleLines.find((t) => GUIDE_TITLE.test(t))?.slice(0, 80) ??
    filename.replace(/\.docx$/i, "").slice(0, 80);

  // Sin detección real no hay nada útil que preguntarle a la IA.
  let aiUsed = false;
  if (detection.sections.length) {
    const result = await requestFormatAnalysis(
      {
        headerLabels: structure.header.map((h) => scrub(ctx, h.label) || "Campo"),
        sections: structure.sections.map((s, i) => ({
          title: scrub(ctx, s.title) || "Sección",
          hasBody: !!detection.sections[i]?.body,
        })),
      },
      fetcher,
    );
    await db.generationLog.create({
      data: {
        institutionId: ctx.institutionId,
        membershipId: ctx.membershipId,
        task: "format_analysis",
        entityType: "format",
        entityId: "upload",
        status:
          result.status === "ok" ? "OK" : result.status === "invalid" ? "INVALID" : "UNAVAILABLE",
        ...(result.status === "ok" && {
          provider: result.data.meta.provider,
          model: result.data.meta.model,
          promptVersion: result.data.meta.promptVersion,
          attempts: result.data.meta.attempts,
          latencyMs: result.data.meta.latencyMs,
          tokens: result.data.meta.tokens,
        }),
      },
    });
    if (result.status === "ok") {
      aiUsed = true;
      structure.header.forEach((h, i) => {
        h.source = result.data.header[i]?.source ?? h.source;
      });
      structure.sections.forEach((s, i) => {
        const ai = result.data.sections[i];
        const body = detection.sections[i]?.body ?? "";
        if (!ai) return;
        s.kind = ai.kind === "FIXED" && !body ? s.kind : ai.kind;
        s.purpose = ai.purpose.slice(0, 300);
        s.text = s.kind === "FIXED" ? body : "";
      });
    } else {
      warnings.push(
        "La IA no estaba disponible: revisa con cuidado el origen de cada campo y el tipo de cada sección.",
      );
    }
  }
  if (structure.header.some((h) => h.source === "BLANK")) {
    warnings.push(
      'Los campos "en blanco" quedan para que el estudiante los llene: revisa que sea así.',
    );
  }
  return { name, structure, warnings, aiUsed };
}

// --- Formatos guardados ----------------------------------------------------------------------

type Row = {
  id: string;
  name: string;
  scope: "TEACHER" | "INSTITUTION";
  isDefault: boolean;
  membershipId: string;
  structure: Prisma.JsonValue;
  updatedAt: Date;
};
const SELECT = {
  id: true,
  name: true,
  scope: true,
  isDefault: true,
  membershipId: true,
  structure: true,
  updatedAt: true,
} as const;

const canEdit = (ctx: TenantContext, row: Pick<Row, "scope" | "membershipId">) =>
  row.scope === "TEACHER" ? row.membershipId === ctx.membershipId : isSchoolAdmin(ctx);

const view = (ctx: TenantContext, row: Row): FormatView => ({
  id: row.id,
  name: row.name,
  scope: row.scope,
  isDefault: row.isDefault,
  canEdit: canEdit(ctx, row),
  structure: row.structure as unknown as FormatStructure,
  updatedAt: row.updatedAt,
});

/** Los formatos que el usuario puede ver: los suyos y los institucionales de su colegio. */
const visibleWhere = (ctx: TenantContext): Prisma.DocumentFormatWhereInput => ({
  institutionId: ctx.institutionId,
  OR: [
    { scope: "TEACHER", membershipId: ctx.membershipId },
    ...(ctx.institutionType === "SCHOOL" ? [{ scope: "INSTITUTION" as const }] : []),
  ],
});

export async function listFormats(ctx: TenantContext): Promise<FormatView[]> {
  requireMember(ctx);
  const rows = await db.documentFormat.findMany({
    where: visibleWhere(ctx),
    orderBy: [{ scope: "asc" }, { name: "asc" }],
    select: SELECT,
  });
  return rows.map((r) => view(ctx, r));
}

async function visibleFormat(ctx: TenantContext, formatId: string) {
  const row = await db.documentFormat.findFirst({
    where: { id: formatId, ...visibleWhere(ctx) },
    select: SELECT,
  });
  if (!row) throw notFound();
  return row;
}

async function editableFormat(ctx: TenantContext, formatId: string) {
  const row = await visibleFormat(ctx, formatId);
  // Un docente ve los institucionales pero no puede editarlos (CA-0010-09).
  if (!canEdit(ctx, row)) throw notFound();
  return row;
}

export async function saveFormat(ctx: TenantContext, input: SaveFormatInput) {
  requireMember(ctx);
  const data = saveFormatSchema.parse(input);
  if (data.scope === "INSTITUTION" && !isSchoolAdmin(ctx)) throw forbidden();
  if (data.scope === "TEACHER" && !hasRole(ctx.roles, "TEACHER")) throw forbidden();
  const structure = data.structure as unknown as Prisma.InputJsonValue;

  return db.$transaction(async (tx) => {
    const saved = data.id
      ? await tx.documentFormat.update({
          where: { id: (await editableFormat(ctx, data.id)).id },
          data: { name: data.name, structure },
          select: { id: true },
        })
      : await tx.documentFormat.create({
          data: {
            institutionId: ctx.institutionId,
            membershipId: ctx.membershipId,
            scope: data.scope,
            name: data.name,
            structure,
          },
          select: { id: true },
        });
    await recordAudit(tx, {
      action: data.id ? "format.updated" : "format.created",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "document_format",
      entityId: saved.id,
      metadata: { scope: data.scope, sections: data.structure.sections.length },
    });
    return saved;
  });
}

/** Un predeterminado por docente y uno por colegio (RN-08). */
export async function setDefaultFormat(ctx: TenantContext, formatId: string, isDefault: boolean) {
  const row = await editableFormat(ctx, formatId);
  await db.$transaction(async (tx) => {
    if (isDefault) {
      await tx.documentFormat.updateMany({
        where: {
          institutionId: ctx.institutionId,
          scope: row.scope,
          ...(row.scope === "TEACHER" && { membershipId: ctx.membershipId }),
        },
        data: { isDefault: false },
      });
    }
    await tx.documentFormat.update({ where: { id: row.id }, data: { isDefault } });
  });
}

export async function deleteFormat(ctx: TenantContext, formatId: string) {
  const row = await editableFormat(ctx, formatId);
  await db.$transaction(async (tx) => {
    // Los talleres ya generados conservan su copia (RN-05).
    await tx.documentFormat.delete({ where: { id: row.id } });
    await recordAudit(tx, {
      action: "format.deleted",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "document_format",
      entityId: row.id,
    });
  });
}

/** RN-08: el predeterminado del docente; si no tiene, el del colegio. */
export async function defaultFormatId(ctx: TenantContext): Promise<string | null> {
  const formats = await db.documentFormat.findMany({
    where: { ...visibleWhere(ctx), isDefault: true },
    select: { id: true, scope: true },
  });
  return (formats.find((f) => f.scope === "TEACHER") ?? formats[0])?.id ?? null;
}

/** Copia del formato para guardar en el taller (RN-05). NOT_FOUND si no es visible. */
export async function getFormatSnapshot(
  ctx: TenantContext,
  formatId: string,
): Promise<FormatSnapshot> {
  const row = await visibleFormat(ctx, formatId);
  return {
    formatId: row.id,
    name: row.name,
    structure: row.structure as unknown as FormatStructure,
  };
}

// --- Logo de la institución (RN-09, ADR-0010) -------------------------------------------------

/** Lo administra un administrador: del colegio, o el docente independiente en su espacio. */
function requireLogoAdmin(ctx: TenantContext) {
  if (!hasRole(ctx.roles, "ADMIN")) throw forbidden("Solo un administrador puede cambiar el logo");
}

export async function saveLogo(ctx: TenantContext, data: Buffer) {
  requireLogoAdmin(ctx);
  const check = checkLogo(data);
  if (!check.ok) throw invalid(check.error);
  const values = { ...check.info, data: new Uint8Array(data) };
  await db.$transaction(async (tx) => {
    await tx.institutionLogo.upsert({
      where: { institutionId: ctx.institutionId },
      create: { institutionId: ctx.institutionId, ...values },
      update: values,
    });
    await recordAudit(tx, {
      action: "logo.updated",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "institution",
      entityId: ctx.institutionId,
      metadata: { bytes: data.length, ...check.info },
    });
  });
  return check.info;
}

export async function deleteLogo(ctx: TenantContext) {
  requireLogoAdmin(ctx);
  await db.institutionLogo.deleteMany({ where: { institutionId: ctx.institutionId } });
}

export async function getLogoInfo(
  ctx: TenantContext,
): Promise<(LogoInfo & { updatedAt: Date }) | null> {
  const logo = await db.institutionLogo.findUnique({
    where: { institutionId: ctx.institutionId },
    select: { mimeType: true, width: true, height: true, updatedAt: true },
  });
  return logo ? { ...logo, mimeType: logo.mimeType as LogoInfo["mimeType"] } : null;
}

/** Bytes del logo del espacio activo (para documentos y la vista previa). */
export async function getLogo(ctx: TenantContext): Promise<(LogoInfo & { data: Buffer }) | null> {
  const logo = await db.institutionLogo.findUnique({ where: { institutionId: ctx.institutionId } });
  if (!logo) return null;
  return {
    mimeType: logo.mimeType as LogoInfo["mimeType"],
    width: logo.width,
    height: logo.height,
    data: Buffer.from(logo.data),
  };
}
