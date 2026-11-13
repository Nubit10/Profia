import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { DomainError, invalid, notFound } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { redactContactData } from "@/lib/text";
import { DecryptionError, openJson, parseKey, sealJson } from "@/lib/crypto";
import { recordAudit } from "@/modules/audit";
import { getMyCourse, listMyCourses } from "@/modules/courses";
import { GRADE_LABELS, courseTitle, type Grade } from "@/modules/courses/client";
import { proposePiarAdjustments, type PiarProposal } from "@/modules/generation";
import { getCoursePlanning } from "@/modules/planning";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import {
  MIN_BARRIERS_FOR_AI,
  piarContentSchema,
  type CreatePiarInput,
  type PiarContent,
} from "./schemas";
import type { PiarDetail, PiarSummary } from "./types";

// SPEC-0017 / ADR-0015. Reglas que aplican en cada función:
// - RN-01: solo el docente que lo creó (institutionId + membershipId); lo ajeno es "no encontrado".
// - RN-03: el contenido entra y sale cifrado; en claro solo curso, año y fechas.
// - RN-08: la auditoría y los logs llevan el id, nunca el nombre ni el contenido.

const KEY_VERSION = 1;

/** La clave de cifrado del PIAR, o null si no está configurada (RN-03: entonces no se ofrece). */
function encryptionKey(): Buffer | null {
  return parseKey(getEnv().PIAR_ENCRYPTION_KEY);
}

export function piarEnabled(): boolean {
  return encryptionKey() !== null;
}

function requireKey(): Buffer {
  const key = encryptionKey();
  if (!key) throw new DomainError("CONFLICT", "El PIAR no está configurado en este servidor");
  return key;
}

const aad = (id: string, institutionId: string) => `piar:${id}:${institutionId}`;

/** RN-07: 31 de diciembre del año siguiente al año lectivo, al final del día (hora de Colombia). */
export function piarExpiry(academicYear: string, now = new Date()): Date {
  const year = Number.parseInt(academicYear, 10);
  const base = Number.isFinite(year) && year > 2000 ? year : now.getUTCFullYear();
  return new Date(Date.UTC(base + 2, 0, 1, 5, 0, 0)); // 1 de enero 00:00 en Bogotá (UTC-5)
}

const own = (ctx: TenantContext, id: string) => ({
  id,
  institutionId: ctx.institutionId,
  membershipId: ctx.membershipId,
});

function decrypt(row: {
  id: string;
  institutionId: string;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
}): PiarContent {
  try {
    const value = openJson(
      requireKey(),
      {
        ciphertext: Buffer.from(row.ciphertext),
        iv: Buffer.from(row.iv),
        tag: Buffer.from(row.tag),
      },
      aad(row.id, row.institutionId),
    );
    return piarContentSchema.parse(value);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    // Sin contenido en el log: solo el id y el tipo de fallo.
    logger.error("piar.decrypt_failed", {
      piarId: row.id,
      reason: error instanceof DecryptionError ? "decrypt" : "schema",
    });
    throw new DomainError(
      "CONFLICT",
      "No pudimos abrir este PIAR. Escríbenos si el problema sigue.",
    );
  }
}

function seal(id: string, institutionId: string, content: PiarContent) {
  const sealed = sealJson(requireKey(), content, aad(id, institutionId));
  return {
    ciphertext: new Uint8Array(sealed.ciphertext),
    iv: new Uint8Array(sealed.iv),
    tag: new Uint8Array(sealed.tag),
    keyVersion: KEY_VERSION,
  };
}

/** RN-07: borra los PIAR vencidos del espacio. Se llama al listar (barrido perezoso). */
export async function purgeExpiredPiars(ctx: TenantContext, now = new Date()) {
  const { count } = await db.piar.deleteMany({
    where: { institutionId: ctx.institutionId, expiresAt: { lt: now } },
  });
  if (count) logger.info("piar.expired_purged", { count });
  return count;
}

export async function createPiar(ctx: TenantContext, input: CreatePiarInput) {
  requireRole(ctx, "TEACHER");
  requireKey();
  const course = await getMyCourse(ctx, input.courseId); // NOT_FOUND si es ajeno
  const planning = await getCoursePlanning(ctx, course.id);
  const content: PiarContent = {
    student: { name: input.studentName, age: null, externalSupport: false, supportIssuer: "" },
    learning: { strengths: "", howLearnsBest: "" },
    barriers: "",
    periods: planning.periods.map((p) => ({
      number: p.number,
      name: p.name,
      purpose: "",
      curricular: "",
      didactic: "",
      evaluative: "",
      followUp: "",
    })),
    family: "",
  };
  const id = randomUUID();
  await db.$transaction(async (tx) => {
    await tx.piar.create({
      data: {
        id,
        institutionId: ctx.institutionId,
        membershipId: ctx.membershipId,
        courseId: course.id,
        academicYear: course.academicYear,
        ...seal(id, ctx.institutionId, content),
        consentAt: new Date(),
        expiresAt: piarExpiry(course.academicYear),
      },
    });
    await recordAudit(tx, {
      action: "piar.created",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "piar",
      entityId: id,
    });
  });
  return { id };
}

export async function listPiars(ctx: TenantContext): Promise<PiarSummary[]> {
  requireRole(ctx, "TEACHER");
  if (!piarEnabled()) return [];
  await purgeExpiredPiars(ctx);
  const [rows, courses] = await Promise.all([
    db.piar.findMany({
      where: { institutionId: ctx.institutionId, membershipId: ctx.membershipId },
      orderBy: { updatedAt: "desc" },
    }),
    listMyCourses(ctx, { includeArchived: true }),
  ]);
  const byId = new Map(courses.map((c) => [c.id, c]));
  return rows.map((row) => {
    const course = byId.get(row.courseId);
    return {
      id: row.id,
      studentName: decrypt(row).student.name,
      courseId: row.courseId,
      courseTitle: course ? courseTitle(course) : "",
      academicYear: row.academicYear,
      updatedAt: row.updatedAt,
      expiresAt: row.expiresAt,
    };
  });
}

async function ownedRow(ctx: TenantContext, id: string) {
  requireRole(ctx, "TEACHER");
  const row = await db.piar.findFirst({ where: own(ctx, id) });
  if (!row || row.expiresAt < new Date()) throw notFound();
  return row;
}

export async function getPiar(ctx: TenantContext, id: string): Promise<PiarDetail> {
  const row = await ownedRow(ctx, id);
  const content = decrypt(row);
  const [course, planning] = await Promise.all([
    getMyCourse(ctx, row.courseId),
    getCoursePlanning(ctx, row.courseId),
  ]);
  const topicsByPeriod: Record<number, string[]> = {};
  for (const unit of planning.units) {
    if (unit.archived || unit.periodNumber === null) continue;
    const titles = unit.topics.filter((t) => !t.archived).map((t) => t.title);
    topicsByPeriod[unit.periodNumber] = [...(topicsByPeriod[unit.periodNumber] ?? []), ...titles];
  }
  return {
    id: row.id,
    course: {
      id: course.id,
      title: courseTitle(course),
      subjectName: course.subjectName,
      gradeLabel: GRADE_LABELS[course.grade as Grade],
    },
    academicYear: row.academicYear,
    content,
    consentAt: row.consentAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    topicsByPeriod,
  };
}

export async function savePiar(ctx: TenantContext, id: string, input: unknown) {
  const parsed = piarContentSchema.safeParse(input);
  if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const row = await ownedRow(ctx, id);
  await db.$transaction(async (tx) => {
    await tx.piar.update({
      where: { id: row.id },
      data: seal(row.id, row.institutionId, parsed.data),
    });
    await recordAudit(tx, {
      action: "piar.updated",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "piar",
      entityId: row.id,
    });
  });
  return { ok: true as const };
}

export async function deletePiar(ctx: TenantContext, id: string) {
  requireRole(ctx, "TEACHER");
  await db.$transaction(async (tx) => {
    const { count } = await tx.piar.deleteMany({ where: own(ctx, id) });
    if (!count) throw notFound();
    await recordAudit(tx, {
      action: "piar.deleted",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "piar",
      entityId: id,
    });
  });
  return { ok: true as const };
}

/** Para el Word y el PDF (SPEC-0017 T5): registra la descarga sin contenido (RN-08). */
export async function getPiarForExport(ctx: TenantContext, id: string) {
  const detail = await getPiar(ctx, id);
  await recordAudit(db, {
    action: "piar.downloaded",
    institutionId: ctx.institutionId,
    actorUserId: ctx.userId,
    entityType: "piar",
    entityId: id,
  });
  return detail;
}

const plain = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");

/**
 * RN-05: quita el nombre del estudiante de un texto (cada palabra del nombre, sin importar tildes
 * ni mayúsculas) y deja "el estudiante". También quita correos y teléfonos.
 */
export function withoutStudentName(text: string, name: string): string {
  const words = new Set(
    name
      .split(/[^\p{L}]+/u)
      .filter((w) => w.length >= 3)
      .map(plain),
  );
  // Primero correos y teléfonos: así un nombre dentro de un correo no lo deja a medias.
  const marked = redactContactData(text).replace(/\p{L}+/gu, (w) =>
    words.has(plain(w)) ? "\u0000" : w,
  );
  return marked.replace(/\u0000(?:\s+\u0000)*/g, "el estudiante");
}

export async function proposeAdjustments(
  ctx: TenantContext,
  id: string,
  periodNumber: number,
  fetcher: typeof fetch = fetch,
): Promise<PiarProposal> {
  const detail = await getPiar(ctx, id);
  const { content } = detail;
  const period = content.periods.find((p) => p.number === periodNumber);
  if (!period) throw invalid("Ese periodo no está en el PIAR");
  if (content.barriers.trim().length < MIN_BARRIERS_FOR_AI) {
    throw invalid("Primero describe las barreras para aprender", "barriers");
  }
  const name = content.student.name;
  return proposePiarAdjustments(
    ctx,
    id,
    {
      subject: detail.course.subjectName,
      grade: detail.course.gradeLabel,
      period: period.name,
      topics: (detail.topicsByPeriod[periodNumber] ?? [])
        .slice(0, 12)
        .map((t) => withoutStudentName(t, name).slice(0, 200)),
      barriers: withoutStudentName(content.barriers, name).slice(0, 1500),
    },
    fetcher,
  );
}
