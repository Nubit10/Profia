import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { recordAudit } from "@/modules/audit";
import { createCourse, listSubjects } from "@/modules/courses";
import {
  acceptInvitation,
  createIndependentSpace,
  createInvitation,
  registerSchool,
} from "@/modules/institutions";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import { getTeacherHome, watchGenerations } from "@/modules/resources";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase, validSchool } from "../support/factories";

// SPEC-0013: Primeros pasos (RN-02) y avisos de generación (RN-08), calculados en el servidor y
// filtrados por espacio y docente.

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

async function teacher() {
  const user = await createUser("Profe");
  const { institutionId } = await createIndependentSpace(user);
  return ctxFor(user, institutionId);
}

async function schoolWithTwoTeachers() {
  const admin = await createUser("Rector");
  const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
  const adminCtx = await ctxFor(admin, institutionId);
  const other = await createUser("Profe");
  const { token } = await createInvitation(adminCtx, { email: other.email, roles: ["TEACHER"] });
  await acceptInvitation(other, token);
  return { adminCtx, otherCtx: await ctxFor(other, institutionId) };
}

async function courseWithTopic(ctx: TenantContext) {
  const subject = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
  const course = await createCourse(ctx, {
    subjectId: subject.id,
    grade: "G6",
    groupName: "601",
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, course.id);
  const unit = await createUnit(ctx, {
    courseId: course.id,
    periodNumber: 1,
    title: "Números enteros",
    description: null,
  });
  const topic = await createTopic(ctx, {
    unitId: unit.id,
    title: "La recta numérica",
    description: null,
    plannedSessions: null,
  });
  return { courseId: course.id, topicId: topic.id };
}

async function resource(
  ctx: TenantContext,
  ref: { courseId: string; topicId: string },
  status: "GENERATING" | "DRAFT" | "FAILED" = "DRAFT",
) {
  return db.resource.create({
    data: {
      institutionId: ctx.institutionId,
      membershipId: ctx.membershipId,
      courseId: ref.courseId,
      topicId: ref.topicId,
      type: "QUIZ",
      status,
      title: "Quiz: La recta numérica",
      blueprint: {},
      context: { topic: { id: ref.topicId, title: "La recta numérica", description: null } },
      generationId: status === "GENERATING" ? null : "log",
    },
    select: { id: true },
  });
}

describe("Primeros pasos (RN-02)", () => {
  it("CA-0013-02: una cuenta nueva empieza en el paso del curso", async () => {
    const ctx = await teacher();
    const { firstSteps } = await getTeacherHome(ctx);
    expect(firstSteps).toMatchObject({
      current: "COURSE",
      done: { COURSE: false, TOPIC: false, RESOURCE: false, DOWNLOAD: false },
    });
  });

  it("CA-0013-02: avanza con el curso, el tema y el primer recurso, y apunta a ese recurso", async () => {
    const ctx = await teacher();
    const ref = await courseWithTopic(ctx);
    expect((await getTeacherHome(ctx)).firstSteps?.current).toBe("RESOURCE");
    const created = await resource(ctx, ref);
    const { firstSteps } = await getTeacherHome(ctx);
    expect(firstSteps).toMatchObject({ current: "DOWNLOAD", topicId: ref.topicId });
    expect(firstSteps?.resource?.id).toBe(created.id);
  });

  it("CA-0013-03: con la primera descarga ya no hay primeros pasos", async () => {
    const ctx = await teacher();
    const ref = await courseWithTopic(ctx);
    const created = await resource(ctx, ref);
    await recordAudit(db, {
      action: "resource.exported",
      institutionId: ctx.institutionId,
      actorUserId: ctx.userId,
      entityType: "resource",
      entityId: created.id,
    });
    const home = await getTeacherHome(ctx);
    expect(home.firstSteps).toBeNull();
    expect(home.nextStep.kind).toBe("OPEN_LAST");
  });

  it("CA-0013-03: la descarga de otro docente del colegio no cuenta como la propia", async () => {
    const { adminCtx, otherCtx } = await schoolWithTwoTeachers();
    const ref = await courseWithTopic(otherCtx);
    const theirs = await resource(otherCtx, ref);
    await recordAudit(db, {
      action: "resource.exported",
      institutionId: otherCtx.institutionId,
      actorUserId: otherCtx.userId,
      entityType: "resource",
      entityId: theirs.id,
    });
    const adminRef = await courseWithTopic(adminCtx);
    await resource(adminCtx, adminRef);
    expect((await getTeacherHome(adminCtx)).firstSteps?.current).toBe("DOWNLOAD");
  });
});

describe("Avisos de generación (RN-08)", () => {
  it("CA-0013-11: lista lo que se genera y devuelve el resultado de lo que se vigila", async () => {
    const ctx = await teacher();
    const ref = await courseWithTopic(ctx);
    const pending = await resource(ctx, ref, "GENERATING");
    const done = await resource(ctx, ref, "DRAFT");
    const failed = await resource(ctx, ref, "FAILED");

    const watch = await watchGenerations(ctx, [done.id, failed.id]);
    expect(watch.generating.map((r) => r.id)).toEqual([pending.id]);
    expect(watch.finished.map((r) => [r.id, r.status])).toEqual([
      [done.id, "DRAFT"],
      [failed.id, "FAILED"],
    ]);
    expect(watch.finished[0]).toMatchObject({ type: "QUIZ", courseId: ref.courseId });
  });

  it("CA-0013-12: otro docente del mismo colegio no ve las generaciones ni su resultado", async () => {
    const { adminCtx, otherCtx } = await schoolWithTwoTeachers();
    const ref = await courseWithTopic(adminCtx);
    const generating = await resource(adminCtx, ref, "GENERATING");
    const finished = await resource(adminCtx, ref, "DRAFT");

    expect((await watchGenerations(adminCtx)).generating).toHaveLength(1);
    const theirs = await watchGenerations(otherCtx, [generating.id, finished.id]);
    expect(theirs).toEqual({ generating: [], finished: [] });
  });
});
