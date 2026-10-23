import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createCourse,
  createSubject,
  listMyCourses,
  listSubjects,
  setCourseArchived,
  setSubjectArchived,
  updateCourse,
} from "@/modules/courses";
import {
  acceptInvitation,
  createCampus,
  createIndependentSpace,
  createInvitation,
  listCampuses,
  registerSchool,
} from "@/modules/institutions";
import { createUser, ctxFor, resetDatabase, validSchool } from "../support/factories";

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

async function independentTeacher() {
  const user = await createUser("Independiente");
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
  const subjects = await listSubjects(ctx);
  const math = subjects.find((s) => s.name === "Matemáticas")!;
  return { user, ctx, institutionId, math };
}

async function schoolWithTwoTeachers() {
  const admin = await createUser("Rector");
  const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
  const adminCtx = await ctxFor(admin, institutionId);
  const other = await createUser("Profe");
  const { token } = await createInvitation(adminCtx, { email: other.email, roles: ["TEACHER"] });
  await acceptInvitation(other, token);
  const otherCtx = await ctxFor(other, institutionId);
  const math = (await listSubjects(adminCtx)).find((s) => s.name === "Matemáticas")!;
  return { adminCtx, otherCtx, institutionId, math };
}

const course = (subjectId: string, extra: Partial<Record<string, string>> = {}) => ({
  subjectId,
  grade: "G6" as const,
  groupName: "601",
  academicYear: "2026",
  ...extra,
});

describe("Mis cursos", () => {
  it("CA-0003-02: crea un curso y aparece en Mis cursos, auditado", async () => {
    const { ctx, math } = await independentTeacher();
    const created = await createCourse(ctx, course(math.id));

    const mine = await listMyCourses(ctx);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      subjectName: "Matemáticas",
      grade: "G6",
      groupName: "601",
      academicYear: "2026",
    });
    expect(
      await db.auditLog.count({ where: { action: "course.created", entityId: created.id } }),
    ).toBe(1);
  });

  it("CA-0003-03: rechaza cursos y asignaturas duplicados", async () => {
    const { ctx, math } = await independentTeacher();
    await createCourse(ctx, course(math.id));
    await expect(createCourse(ctx, course(math.id, { groupName: " 601 " }))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(createSubject(ctx, "MATEMATICAS")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createSubject(ctx, "  matemáticas ")).rejects.toMatchObject({ code: "CONFLICT" });

    const robotics = await createSubject(ctx, "Robótica");
    await createCourse(ctx, course(robotics.id));
    expect(await listMyCourses(ctx)).toHaveLength(2);
  });

  it("CA-0003-04: un profesor no ve ni modifica los cursos de otro del mismo colegio", async () => {
    const { adminCtx, otherCtx, math } = await schoolWithTwoTeachers();
    const mine = await createCourse(adminCtx, course(math.id));

    expect(await listMyCourses(otherCtx)).toEqual([]);
    await expect(
      updateCourse(otherCtx, mine.id, course(math.id, { groupName: "602" })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setCourseArchived(otherCtx, mine.id, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await listMyCourses(adminCtx))[0]?.groupName).toBe("601");
  });

  it("CA-0003-05: IDs de otro espacio responden 404", async () => {
    const a = await independentTeacher();
    const b = await schoolWithTwoTeachers();
    const [campusB] = await listCampuses(b.adminCtx);
    const courseB = await createCourse(b.adminCtx, course(b.math.id));

    await expect(createCourse(a.ctx, course(b.math.id))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(setCourseArchived(a.ctx, courseB.id, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(setSubjectArchived(a.ctx, b.math.id, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // Una sede ajena en un colegio se rechaza.
    const otherSchoolAdmin = await createUser("Otra rectora");
    const other = await registerSchool(otherSchoolAdmin, { ...validSchool, alsoTeaches: true });
    const otherCtx = await ctxFor(otherSchoolAdmin, other.institutionId);
    const otherMath = (await listSubjects(otherCtx)).find((s) => s.name === "Matemáticas")!;
    await expect(
      createCourse(otherCtx, course(otherMath.id, { campusId: campusB!.id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("CA-0003-05: la base rechaza un curso que mezcle espacios aunque el código fallara", async () => {
    const a = await independentTeacher();
    const b = await schoolWithTwoTeachers();
    const [campusA] = await listCampuses(a.ctx);
    await expect(
      db.course.create({
        data: {
          institutionId: a.institutionId,
          membershipId: a.ctx.membershipId,
          subjectId: b.math.id, // asignatura del espacio B
          campusId: campusA!.id,
          grade: "G6",
          academicYear: "2026",
        },
      }),
    ).rejects.toThrow();
    expect(await db.course.count()).toBe(0);
  });

  it("CA-0003-06: archivar y desarchivar cursos; una asignatura archivada no se ofrece", async () => {
    const { ctx, math } = await independentTeacher();
    const created = await createCourse(ctx, course(math.id));
    await setCourseArchived(ctx, created.id, true);
    expect(await listMyCourses(ctx)).toEqual([]);
    expect(await listMyCourses(ctx, { includeArchived: true })).toHaveLength(1);
    await setCourseArchived(ctx, created.id, false);
    expect(await listMyCourses(ctx)).toHaveLength(1);

    await setSubjectArchived(ctx, math.id, true);
    expect((await listSubjects(ctx)).some((s) => s.id === math.id)).toBe(false);
    await expect(createCourse(ctx, course(math.id, { groupName: "602" }))).rejects.toMatchObject({
      code: "INVALID",
    });
    // El curso existente se conserva y puede editarse sin cambiar de asignatura.
    await updateCourse(ctx, created.id, course(math.id, { groupName: "6A" }));
    expect((await listMyCourses(ctx))[0]?.groupName).toBe("6A");
  });

  it("CA-0003-07: un administrador que no da clases no puede crear cursos", async () => {
    const admin = await createUser("Rectora");
    const { institutionId } = await registerSchool(admin, validSchool);
    const ctx = await ctxFor(admin, institutionId);
    const math = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
    await expect(createCourse(ctx, course(math.id))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listMyCourses(ctx)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("RN-06: en un colegio el curso usa la sede elegida; en un espacio independiente, la interna", async () => {
    const { adminCtx, math } = await schoolWithTwoTeachers();
    const north = await createCampus(adminCtx, "Sede Norte");
    await createCourse(adminCtx, course(math.id, { campusId: north.id }));
    expect((await listMyCourses(adminCtx))[0]?.campusName).toBe("Sede Norte");

    const solo = await independentTeacher();
    await createCourse(solo.ctx, course(solo.math.id, { campusId: north.id }));
    expect((await listMyCourses(solo.ctx))[0]?.campusName).toBe("Sede principal");
  });
});

describe("asignaturas", () => {
  it("se listan en orden alfabético del español (Ética junto a la E)", async () => {
    const { ctx } = await independentTeacher();
    const names = (await listSubjects(ctx)).map((s) => s.name);
    expect(names.indexOf("Ética y Valores Humanos")).toBeLessThan(names.indexOf("Filosofía"));
    expect(names.indexOf("Ética y Valores Humanos")).toBeGreaterThan(
      names.indexOf("Educación Religiosa"),
    );
  });
});
