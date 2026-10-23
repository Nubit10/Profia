import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  acceptInvitation,
  createCampus,
  createIndependentSpace,
  createInvitation,
  getInvitationPreview,
  listCampuses,
  registerSchool,
  renameCampus,
  revokeInvitation,
  setCampusArchived,
  setMemberActive,
  updateMemberRoles,
  updateSchool,
} from "@/modules/institutions";
import { resolveTenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase, validSchool } from "../support/factories";

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

/** Colegio con su administrador y un docente invitado que ya aceptó. */
async function schoolWithTeacher() {
  const admin = await createUser("Rectora");
  const { institutionId } = await registerSchool(admin, validSchool);
  const adminCtx = await ctxFor(admin, institutionId);
  const teacher = await createUser("Profe");
  const { token } = await createInvitation(adminCtx, { email: teacher.email, roles: ["TEACHER"] });
  await acceptInvitation(teacher, token);
  return {
    admin,
    adminCtx,
    teacher,
    teacherCtx: await ctxFor(teacher, institutionId),
    institutionId,
  };
}

describe("onboarding", () => {
  it("CA-0002-01: un usuario sin espacio no tiene contexto de tenant", async () => {
    const user = await createUser();
    expect(await resolveTenantContext(user)).toBeNull();
  });

  it("CA-0002-02: crea el espacio independiente sin datos, como ADMIN + TEACHER, idempotente", async () => {
    const user = await createUser();
    const first = await createIndependentSpace(user);
    const again = await createIndependentSpace(user);
    expect(again.institutionId).toBe(first.institutionId);

    const ctx = await ctxFor(user, first.institutionId);
    expect(ctx.institutionType).toBe("INDEPENDENT");
    expect(ctx.roles.sort()).toEqual(["ADMIN", "TEACHER"]);
    expect(await db.institution.count()).toBe(1);
    expect(await db.campus.count({ where: { institutionId: first.institutionId } })).toBe(1);
  });

  it("CA-0002-02: dos creaciones simultáneas dejan un solo espacio independiente", async () => {
    const user = await createUser();
    const [a, b] = await Promise.all([createIndependentSpace(user), createIndependentSpace(user)]);
    expect(a.institutionId).toBe(b.institutionId);
    expect(await db.institution.count()).toBe(1);
  });

  it("CA-0002-03: registra el colegio con 'Sede principal' y el creador queda ADMIN", async () => {
    const user = await createUser();
    const { institutionId } = await registerSchool(user, validSchool);
    const ctx = await ctxFor(user, institutionId);
    expect(ctx.institutionType).toBe("SCHOOL");
    expect(ctx.roles).toEqual(["ADMIN"]);
    expect((await listCampuses(ctx)).map((c) => c.name)).toEqual(["Sede principal"]);
  });

  it("CA-0002-03: con 'también doy clases' queda ADMIN + TEACHER", async () => {
    const user = await createUser();
    const { institutionId } = await registerSchool(user, { ...validSchool, alsoTeaches: true });
    expect((await ctxFor(user, institutionId)).roles.sort()).toEqual(["ADMIN", "TEACHER"]);
  });

  it("CA-0003-01: todo espacio nuevo trae las 12 asignaturas de la Ley 115", async () => {
    const user = await createUser();
    const independent = await createIndependentSpace(user);
    const school = await registerSchool(user, validSchool);
    for (const { institutionId } of [independent, school]) {
      expect(await db.subject.count({ where: { institutionId, isPreloaded: true } })).toBe(12);
    }
  });
});

describe("invitaciones", () => {
  it("CA-0002-04: devuelve el token una vez y en la base solo queda su hash", async () => {
    const admin = await createUser();
    const { institutionId } = await registerSchool(admin, validSchool);
    const { token, invitationId } = await createInvitation(await ctxFor(admin, institutionId), {
      email: "nuevo@colegio.test",
      roles: ["TEACHER"],
    });

    const stored = await db.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(token);
    const audit = await db.auditLog.findMany({ where: { action: "invitation.created" } });
    expect(JSON.stringify(audit)).not.toContain(token);
  });

  it("CA-0002-05: aceptar crea la membresía con los roles invitados y el enlace deja de servir", async () => {
    const { teacher, teacherCtx } = await schoolWithTeacher();
    expect(teacherCtx.roles).toEqual(["TEACHER"]);
    expect(teacherCtx.institutionType).toBe("SCHOOL");
    expect(teacher.email).toBe(teacherCtx.userEmail);
  });

  it("CA-0002-05/06: el mismo enlace no sirve dos veces, ni aceptado en paralelo", async () => {
    const admin = await createUser();
    const { institutionId } = await registerSchool(admin, validSchool);
    const invitee = await createUser("Invitado");
    const { token } = await createInvitation(await ctxFor(admin, institutionId), {
      email: invitee.email,
      roles: ["TEACHER"],
    });

    const results = await Promise.allSettled([
      acceptInvitation(invitee, token),
      acceptInvitation(invitee, token),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.membership.count({ where: { institutionId, userId: invitee.id } })).toBe(1);
    await expect(acceptInvitation(invitee, token)).rejects.toMatchObject({ code: "INVALID" });
    expect(await getInvitationPreview(token)).toEqual({ status: "invalid" });
  });

  it("CA-0002-06: un enlace vencido, revocado o con otro correo no crea membresía", async () => {
    const admin = await createUser();
    const { institutionId } = await registerSchool(admin, validSchool);
    const ctx = await ctxFor(admin, institutionId);
    const invitee = await createUser("Invitado");
    const stranger = await createUser("Otro");

    const expired = await createInvitation(ctx, { email: invitee.email, roles: ["TEACHER"] });
    await db.invitation.update({
      where: { id: expired.invitationId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(acceptInvitation(invitee, expired.token)).rejects.toMatchObject({
      code: "INVALID",
    });

    const revoked = await createInvitation(ctx, { email: invitee.email, roles: ["TEACHER"] });
    await revokeInvitation(ctx, revoked.invitationId);
    await expect(acceptInvitation(invitee, revoked.token)).rejects.toMatchObject({
      code: "INVALID",
    });

    const valid = await createInvitation(ctx, { email: invitee.email, roles: ["TEACHER"] });
    await expect(acceptInvitation(stranger, valid.token)).rejects.toThrow(invitee.email);

    expect(await db.membership.count({ where: { institutionId } })).toBe(1);
  });

  it("RN-07: una invitación nueva para el mismo correo revoca la anterior", async () => {
    const admin = await createUser();
    const { institutionId } = await registerSchool(admin, validSchool);
    const ctx = await ctxFor(admin, institutionId);
    const invitee = await createUser("Invitado");
    const first = await createInvitation(ctx, { email: invitee.email, roles: ["TEACHER"] });
    await createInvitation(ctx, { email: invitee.email, roles: ["ADMIN"] });
    expect(await getInvitationPreview(first.token)).toEqual({ status: "invalid" });
  });

  it("reactiva una membresía desactivada con los roles de la invitación", async () => {
    const { adminCtx, teacher, teacherCtx, institutionId } = await schoolWithTeacher();
    await setMemberActive(adminCtx, teacherCtx.membershipId, false);
    const { token } = await createInvitation(adminCtx, {
      email: teacher.email,
      roles: ["TEACHER", "ADMIN"],
    });
    await acceptInvitation(teacher, token);
    expect((await ctxFor(teacher, institutionId)).roles.sort()).toEqual(["ADMIN", "TEACHER"]);
    expect(await db.membership.count({ where: { institutionId, userId: teacher.id } })).toBe(1);
  });
});

describe("espacio activo", () => {
  it("CA-0002-07: elige el espacio preferido solo si hay membresía; si no, el primero", async () => {
    const { teacher, institutionId } = await schoolWithTeacher();
    const own = await createIndependentSpace(teacher);
    const outsider = await createUser("Ajeno");
    const foreign = await registerSchool(outsider, validSchool);

    expect((await resolveTenantContext(teacher, own.institutionId))?.institutionId).toBe(
      own.institutionId,
    );
    expect((await resolveTenantContext(teacher, institutionId))?.institutionId).toBe(institutionId);
    const manipulated = await resolveTenantContext(teacher, foreign.institutionId);
    expect(manipulated?.institutionId).not.toBe(foreign.institutionId);
    expect(manipulated?.spaces).toHaveLength(2);
  });
});

describe("aislamiento y permisos", () => {
  it("CA-0002-08: un admin de A recibe 404 con IDs de B", async () => {
    const a = await schoolWithTeacher();
    const b = await schoolWithTeacher();
    const [campusB] = await listCampuses(b.adminCtx);
    const invitationB = await createInvitation(b.adminCtx, {
      email: "x@colegio.test",
      roles: ["TEACHER"],
    });

    const attempts = [
      () => renameCampus(a.adminCtx, campusB!.id, "Robada"),
      () => setCampusArchived(a.adminCtx, campusB!.id, true),
      () => revokeInvitation(a.adminCtx, invitationB.invitationId),
      () => updateMemberRoles(a.adminCtx, b.teacherCtx.membershipId, ["ADMIN"]),
      () => setMemberActive(a.adminCtx, b.teacherCtx.membershipId, false),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect((await ctxFor(b.teacher, b.institutionId)).roles).toEqual(["TEACHER"]);
    expect((await listCampuses(b.adminCtx))[0]?.name).toBe("Sede principal");
  });

  it("CA-0002-09: un TEACHER no puede hacer acciones de administrador", async () => {
    const { teacherCtx, adminCtx } = await schoolWithTeacher();
    const attempts = [
      () => createInvitation(teacherCtx, { email: "x@colegio.test", roles: ["TEACHER"] }),
      () => createCampus(teacherCtx, "Sede Norte"),
      () => updateMemberRoles(teacherCtx, adminCtx.membershipId, ["TEACHER"]),
      () => setMemberActive(teacherCtx, adminCtx.membershipId, false),
      () => updateSchool(teacherCtx, { ...validSchool, name: "Otro nombre" }),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("CA-0002-09: en un espacio independiente no hay invitaciones ni sedes", async () => {
    const user = await createUser();
    const { institutionId } = await createIndependentSpace(user);
    const ctx = await ctxFor(user, institutionId);
    await expect(
      createInvitation(ctx, { email: "x@colegio.test", roles: ["TEACHER"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCampus(ctx, "Otra sede")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("CA-0002-10: el último ADMIN no puede quitarse el rol ni desactivarse", async () => {
    const { adminCtx } = await schoolWithTeacher();
    await expect(
      updateMemberRoles(adminCtx, adminCtx.membershipId, ["TEACHER"]),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(setMemberActive(adminCtx, adminCtx.membershipId, false)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("CA-0002-10: dos admins que se desactivan a la vez dejan al menos uno activo", async () => {
    const { adminCtx, teacherCtx, teacher, institutionId } = await schoolWithTeacher();
    await updateMemberRoles(adminCtx, teacherCtx.membershipId, ["ADMIN", "TEACHER"]);
    const secondAdminCtx = await ctxFor(teacher, institutionId);

    const results = await Promise.allSettled([
      setMemberActive(adminCtx, secondAdminCtx.membershipId, false),
      setMemberActive(secondAdminCtx, adminCtx.membershipId, false),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const activeAdmins = await db.membership.count({
      where: { institutionId, status: "ACTIVE", roles: { has: "ADMIN" } },
    });
    expect(activeAdmins).toBe(1);
  });

  it("CA-0002-11: una desactivación o un cambio de rol aplica en la siguiente request", async () => {
    const { adminCtx, teacher, teacherCtx, institutionId } = await schoolWithTeacher();
    await updateMemberRoles(adminCtx, teacherCtx.membershipId, ["TEACHER", "ADMIN"]);
    expect((await ctxFor(teacher, institutionId)).roles.sort()).toEqual(["ADMIN", "TEACHER"]);

    await setMemberActive(adminCtx, teacherCtx.membershipId, false);
    expect(await resolveTenantContext(teacher, institutionId)).toBeNull();
  });
});

describe("auditoría", () => {
  it("CA-0002-12: registra actor, espacio, acción y entidad de cada evento", async () => {
    const { adminCtx, teacherCtx, institutionId } = await schoolWithTeacher();
    await setMemberActive(adminCtx, teacherCtx.membershipId, false);

    const actions = (
      await db.auditLog.findMany({ where: { institutionId }, orderBy: { createdAt: "asc" } })
    ).map((log) => log.action);
    expect(actions).toEqual([
      "institution.created",
      "invitation.created",
      "invitation.accepted",
      "membership.deactivated",
    ]);
    const deactivation = await db.auditLog.findFirstOrThrow({
      where: { action: "membership.deactivated" },
    });
    expect(deactivation).toMatchObject({
      actorUserId: adminCtx.userId,
      entityType: "membership",
      entityId: teacherCtx.membershipId,
    });
  });

  it("CA-0002-12: si la acción falla, no queda registro de auditoría", async () => {
    const { adminCtx, institutionId } = await schoolWithTeacher();
    await expect(setMemberActive(adminCtx, adminCtx.membershipId, false)).rejects.toThrow();
    await expect(createCampus(adminCtx, "sede PRINCIPAL")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(
      await db.auditLog.count({
        where: { institutionId, action: { in: ["membership.deactivated", "campus.created"] } },
      }),
    ).toBe(0);
  });
});

describe("sedes", () => {
  it("CA-0002-13: crear, renombrar, archivar y desarchivar, con nombres únicos y al menos una activa", async () => {
    const admin = await createUser();
    const { institutionId } = await registerSchool(admin, validSchool);
    const ctx = await ctxFor(admin, institutionId);
    const [main] = await listCampuses(ctx);

    await expect(setCampusArchived(ctx, main!.id, true)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const north = await createCampus(ctx, "Sede Norte");
    await expect(createCampus(ctx, "  sede   NORTE ")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createCampus(ctx, "Sede Nórte")).rejects.toMatchObject({ code: "CONFLICT" });

    await renameCampus(ctx, north.id, "Sede Rural El Carmen");
    await setCampusArchived(ctx, main!.id, true);
    expect((await listCampuses(ctx)).map((c) => c.name)).toEqual(["Sede Rural El Carmen"]);
    expect(await listCampuses(ctx, { includeArchived: true })).toHaveLength(2);

    await setCampusArchived(ctx, main!.id, false);
    expect(await listCampuses(ctx)).toHaveLength(2);
  });
});
