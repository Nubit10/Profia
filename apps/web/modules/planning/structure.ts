import "server-only";
import type { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { invalid } from "@/lib/errors";
import { recordAudit, type AuditAction } from "@/modules/audit";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { ownedCourse, ownedObjective, ownedTopic, ownedUnit } from "./access";
import { resolveLinks } from "./links";
import type {
  PlanningKind,
  objectiveSchema,
  topicSchema,
  unitSchema,
  updateObjectiveSchema,
  updateTopicSchema,
  updateUnitSchema,
} from "./schemas";

type Tx = Prisma.TransactionClient;

function audit(
  tx: Tx,
  ctx: TenantContext,
  action: AuditAction,
  entityType: string,
  entityId: string,
) {
  return recordAudit(tx, {
    action,
    institutionId: ctx.institutionId,
    actorUserId: ctx.userId,
    entityType,
    entityId,
  });
}

async function assertPeriodExists(
  tx: Tx,
  ctx: TenantContext,
  courseId: string,
  number: number | null,
) {
  if (number === null) return;
  const period = await tx.coursePeriod.findFirst({
    where: { courseId, institutionId: ctx.institutionId, number },
    select: { number: true },
  });
  if (!period) throw invalid("Ese periodo no existe en el curso", "periodNumber");
}

// ---------- Unidades ----------

export async function createUnit(ctx: TenantContext, input: z.output<typeof unitSchema>) {
  requireRole(ctx, "TEACHER");
  return db.$transaction(async (tx) => {
    const course = await ownedCourse(tx, ctx, input.courseId);
    await assertPeriodExists(tx, ctx, course.id, input.periodNumber);
    const last = await tx.unit.aggregate({
      where: { courseId: course.id },
      _max: { position: true },
    });
    const unit = await tx.unit.create({
      data: {
        institutionId: ctx.institutionId,
        courseId: course.id,
        periodNumber: input.periodNumber,
        title: input.title,
        description: input.description ?? null,
        position: (last._max.position ?? 0) + 1,
      },
      select: { id: true },
    });
    await audit(tx, ctx, "unit.created", "unit", unit.id);
    return unit;
  });
}

export async function updateUnit(ctx: TenantContext, input: z.output<typeof updateUnitSchema>) {
  requireRole(ctx, "TEACHER");
  await db.$transaction(async (tx) => {
    const unit = await ownedUnit(tx, ctx, input.unitId);
    await assertPeriodExists(tx, ctx, unit.courseId, input.periodNumber);
    await tx.unit.update({
      where: { id: unit.id },
      data: {
        periodNumber: input.periodNumber,
        title: input.title,
        description: input.description ?? null,
      },
    });
    await audit(tx, ctx, "unit.updated", "unit", unit.id);
  });
}

// ---------- Temas ----------

export async function createTopic(ctx: TenantContext, input: z.output<typeof topicSchema>) {
  requireRole(ctx, "TEACHER");
  return db.$transaction(async (tx) => {
    const unit = await ownedUnit(tx, ctx, input.unitId);
    const last = await tx.topic.aggregate({ where: { unitId: unit.id }, _max: { position: true } });
    const topic = await tx.topic.create({
      data: {
        institutionId: ctx.institutionId,
        unitId: unit.id,
        title: input.title,
        description: input.description ?? null,
        plannedSessions: input.plannedSessions ?? null,
        position: (last._max.position ?? 0) + 1,
      },
      select: { id: true },
    });
    await audit(tx, ctx, "topic.created", "topic", topic.id);
    return topic;
  });
}

export async function updateTopic(ctx: TenantContext, input: z.output<typeof updateTopicSchema>) {
  requireRole(ctx, "TEACHER");
  await db.$transaction(async (tx) => {
    const topic = await ownedTopic(tx, ctx, input.topicId);
    await tx.topic.update({
      where: { id: topic.id },
      data: {
        title: input.title,
        description: input.description ?? null,
        plannedSessions: input.plannedSessions ?? null,
      },
    });
    await audit(tx, ctx, "topic.updated", "topic", topic.id);
  });
}

// ---------- Objetivos ----------

export async function createObjective(ctx: TenantContext, input: z.output<typeof objectiveSchema>) {
  requireRole(ctx, "TEACHER");
  return db.$transaction(async (tx) => {
    const topic = await ownedTopic(tx, ctx, input.topicId);
    const links = await resolveLinks(tx, ctx, topic.unit.courseId, input.links);
    const last = await tx.objective.aggregate({
      where: { topicId: topic.id },
      _max: { position: true },
    });
    const objective = await tx.objective.create({
      data: {
        institutionId: ctx.institutionId,
        topicId: topic.id,
        statement: input.statement,
        position: (last._max.position ?? 0) + 1,
        // institutionId llega por la FK compuesta con el objetivo.
        links: { create: links },
      },
      select: { id: true },
    });
    await audit(tx, ctx, "objective.created", "objective", objective.id);
    return objective;
  });
}

export async function updateObjective(
  ctx: TenantContext,
  input: z.output<typeof updateObjectiveSchema>,
) {
  requireRole(ctx, "TEACHER");
  await db.$transaction(async (tx) => {
    const objective = await ownedObjective(tx, ctx, input.objectiveId);
    const keep = objective.links.map((l) => l.curriculumItem.code);
    const links = await resolveLinks(tx, ctx, objective.topic.unit.courseId, input.links, keep);
    await tx.objectiveCurriculumLink.deleteMany({ where: { objectiveId: objective.id } });
    await tx.objective.update({
      where: { id: objective.id },
      data: {
        statement: input.statement,
        // institutionId llega por la FK compuesta con el objetivo.
        links: { create: links },
      },
    });
    await audit(tx, ctx, "objective.updated", "objective", objective.id);
  });
}

// ---------- Orden y archivo (los tres niveles) ----------

async function locate(tx: Tx, ctx: TenantContext, kind: PlanningKind, id: string) {
  if (kind === "unit") {
    const u = await ownedUnit(tx, ctx, id);
    return { position: u.position, siblings: { courseId: u.courseId } };
  }
  if (kind === "topic") {
    const t = await ownedTopic(tx, ctx, id);
    return { position: t.position, siblings: { unitId: t.unitId } };
  }
  const o = await ownedObjective(tx, ctx, id);
  return { position: o.position, siblings: { topicId: o.topicId } };
}

/** Delegados de Prisma por nivel, con la misma forma para mover y archivar. */
function table(tx: Tx, kind: PlanningKind) {
  return (kind === "unit" ? tx.unit : kind === "topic" ? tx.topic : tx.objective) as unknown as {
    findFirst(args: object): Promise<{ id: string; position: number } | null>;
    update(args: object): Promise<unknown>;
  };
}

/** CA-0006-06: intercambia la posición con el vecino visible (no archivado) en esa dirección. */
export async function moveItem(
  ctx: TenantContext,
  kind: PlanningKind,
  id: string,
  direction: "up" | "down",
) {
  requireRole(ctx, "TEACHER");
  await db.$transaction(async (tx) => {
    const { position, siblings } = await locate(tx, ctx, kind, id);
    const repo = table(tx, kind);
    const neighbor = await repo.findFirst({
      where: {
        ...siblings,
        archivedAt: null,
        position: direction === "up" ? { lt: position } : { gt: position },
      },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
      select: { id: true, position: true },
    });
    if (!neighbor) return; // ya está en el extremo
    await repo.update({ where: { id: neighbor.id }, data: { position } });
    await repo.update({ where: { id }, data: { position: neighbor.position } });
    await audit(tx, ctx, `${kind}.moved` as AuditAction, kind, id);
  });
}

/** CA-0006-09: archivar oculta el elemento y su contenido; no borra nada. */
export async function setItemArchived(
  ctx: TenantContext,
  kind: PlanningKind,
  id: string,
  archived: boolean,
) {
  requireRole(ctx, "TEACHER");
  await db.$transaction(async (tx) => {
    await locate(tx, ctx, kind, id);
    await table(tx, kind).update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await audit(
      tx,
      ctx,
      `${kind}.${archived ? "archived" : "unarchived"}` as AuditAction,
      kind,
      id,
    );
  });
}
