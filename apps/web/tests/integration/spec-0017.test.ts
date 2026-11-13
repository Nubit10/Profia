import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import {
  acceptInvitation,
  createIndependentSpace,
  createInvitation,
  registerSchool,
} from "@/modules/institutions";
import {
  createPiar,
  deletePiar,
  getPiar,
  getPiarForExport,
  listPiars,
  piarExpiry,
  proposeAdjustments,
  savePiar,
  withoutStudentName,
} from "@/modules/piar";
import type { PiarContent } from "@/modules/piar/client";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import type { TenantContext } from "@/modules/tenancy";
import { createUser, ctxFor, resetDatabase, validSchool } from "../support/factories";

// SPEC-0017: PIAR privado y cifrado (ADR-0015).

const NAME = "Valentina Ríos";
const BARRIERS =
  "Valentina se distrae con el ruido y le cuesta leer enunciados largos. Su mamá: 3001234567.";

beforeEach(() => resetDatabase());
afterAll(() => db.$disconnect());

async function course(ctx: TenantContext, group = "601") {
  const subject = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
  const created = await createCourse(ctx, {
    subjectId: subject.id,
    grade: "G6",
    groupName: group,
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, created.id);
  const unit = await createUnit(ctx, {
    courseId: created.id,
    periodNumber: 1,
    title: "Números enteros",
    description: null,
  });
  await createTopic(ctx, {
    unitId: unit.id,
    title: "La recta numérica",
    description: null,
    plannedSessions: null,
  });
  return created;
}

async function teacher() {
  const user = await createUser("Profe");
  const { institutionId } = await createIndependentSpace(user);
  return ctxFor(user, institutionId);
}

const filled = (content: PiarContent): PiarContent => ({
  ...content,
  student: { ...content.student, age: 11, externalSupport: true, supportIssuer: "EPS Sanitas" },
  learning: { strengths: "Le encanta dibujar y el fútbol", howLearnsBest: "Con material concreto" },
  barriers: BARRIERS,
  periods: content.periods.map((p) =>
    p.number === 1
      ? { ...p, purpose: "Ubicar enteros en la recta", didactic: "Apoyos visuales" }
      : p,
  ),
  family: "Practicar con el termómetro de la casa.",
});

describe("PIAR (SPEC-0017)", () => {
  it("CA-0017-01: se crea con la autorización, se llena, se guarda y aparece en la lista", async () => {
    const ctx = await teacher();
    const c = await course(ctx);
    const { id } = await createPiar(ctx, { courseId: c.id, studentName: NAME, consent: true });
    const created = await getPiar(ctx, id);
    expect(created.content.student.name).toBe(NAME);
    expect(created.content.periods.map((p) => p.name)).toEqual([
      "Periodo 1",
      "Periodo 2",
      "Periodo 3",
      "Periodo 4",
    ]);
    expect(created.topicsByPeriod[1]).toEqual(["La recta numérica"]);
    expect(created.expiresAt.toISOString()).toBe("2028-01-01T05:00:00.000Z");

    await savePiar(ctx, id, filled(created.content));
    const saved = await getPiar(ctx, id);
    expect(saved.content.barriers).toBe(BARRIERS);
    expect(saved.content.periods[0]!.didactic).toBe("Apoyos visuales");
    expect(await listPiars(ctx)).toMatchObject([
      { id, studentName: NAME, courseTitle: "Matemáticas · 6° · 601" },
    ]);

    // Un contenido con diagnóstico o campos de más no existe en el schema: se descarta.
    await expect(
      savePiar(ctx, id, { ...saved.content, student: { name: "" } }),
    ).rejects.toMatchObject({
      code: "INVALID",
    });
  });

  it("CA-0017-02: en la base no hay nada en claro; un contenido alterado o copiado no se abre", async () => {
    const ctx = await teacher();
    const c = await course(ctx);
    const { id } = await createPiar(ctx, { courseId: c.id, studentName: NAME, consent: true });
    await savePiar(ctx, id, filled((await getPiar(ctx, id)).content));
    const rows = await db.$queryRaw<
      { dump: string }[]
    >`SELECT row_to_json(p)::text AS dump FROM piars p`;
    expect(rows).toHaveLength(1);
    for (const secret of ["Valentina", "Ríos", "ruido", "fútbol", "Sanitas", "termómetro"]) {
      expect(rows[0]!.dump).not.toContain(secret);
    }
    const row = await db.piar.findUniqueOrThrow({ where: { id } });
    expect(Buffer.from(row.ciphertext).toString("utf8")).not.toContain("Valentina");

    // Alterar un byte rompe la etiqueta de autenticación.
    const tampered = Buffer.from(row.ciphertext);
    tampered[0] = tampered[0]! ^ 0xff;
    await db.piar.update({ where: { id }, data: { ciphertext: new Uint8Array(tampered) } });
    await expect(getPiar(ctx, id)).rejects.toMatchObject({ code: "CONFLICT" });

    // Copiar el contenido de un PIAR a otro tampoco sirve (los datos asociados son el id).
    const other = await createPiar(ctx, { courseId: c.id, studentName: "Otro", consent: true });
    const good = await db.piar.findUniqueOrThrow({ where: { id: other.id } });
    await db.piar.update({
      where: { id },
      data: { ciphertext: good.ciphertext, iv: good.iv, tag: good.tag },
    });
    await expect(getPiar(ctx, id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("CA-0017-03: otro docente o el administrador del colegio no lo ven ni lo tocan", async () => {
    const admin = await createUser("Rector");
    const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: true });
    const adminCtx = await ctxFor(admin, institutionId);
    const other = await createUser("Otra");
    const { token } = await createInvitation(adminCtx, { email: other.email, roles: ["TEACHER"] });
    await acceptInvitation(other, token);
    const ctx = await ctxFor(other, institutionId);
    const c = await course(ctx);
    const { id } = await createPiar(ctx, { courseId: c.id, studentName: NAME, consent: true });

    const notFound = { code: "NOT_FOUND" };
    for (const outsider of [adminCtx]) {
      expect(await listPiars(outsider)).toEqual([]);
      await expect(getPiar(outsider, id)).rejects.toMatchObject(notFound);
      await expect(getPiarForExport(outsider, id)).rejects.toMatchObject(notFound);
      await expect(savePiar(outsider, id, (await getPiar(ctx, id)).content)).rejects.toMatchObject(
        notFound,
      );
      await expect(deletePiar(outsider, id)).rejects.toMatchObject(notFound);
      await expect(
        proposeAdjustments(outsider, id, 1, vi.fn() as unknown as typeof fetch),
      ).rejects.toMatchObject(notFound);
    }
    // Ni crear un PIAR sobre un curso ajeno.
    await expect(
      createPiar(adminCtx, { courseId: c.id, studentName: NAME, consent: true }),
    ).rejects.toMatchObject(notFound);
    expect(await getPiar(ctx, id)).toMatchObject({ id });
  });

  it("CA-0017-04: a la IA no van el nombre, el teléfono, la edad ni las fortalezas", async () => {
    const ctx = await teacher();
    const c = await course(ctx);
    const { id } = await createPiar(ctx, { courseId: c.id, studentName: NAME, consent: true });
    await savePiar(ctx, id, filled((await getPiar(ctx, id)).content));
    const fetcher = vi.fn(async () =>
      Response.json({
        adjustments: {
          curricular: ["Priorizar la ubicación de enteros en la recta."],
          didactic: ["Instrucciones por pasos con apoyos visuales."],
          evaluative: ["Evaluación oral con tiempo adicional."],
          followUp: "Revisar cada semana con una lista corta.",
        },
        meta: {
          provider: "groq",
          model: "m",
          promptVersion: "piar.v1",
          attempts: 1,
          latencyMs: 10,
          tokens: 100,
        },
      }),
    );
    const result = await proposeAdjustments(ctx, id, 1, fetcher as unknown as typeof fetch);
    expect(result).toMatchObject({ status: "ok", adjustments: { followUp: expect.any(String) } });
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain("/v1/generation/piar-adjustments");
    const sent = String(init.body);
    for (const secret of ["Valentina", "Ríos", "3001234567", "fútbol", "Sanitas", "11"]) {
      expect(sent).not.toContain(secret);
    }
    expect(JSON.parse(sent)).toEqual({
      subject: "Matemáticas",
      grade: "6°",
      period: "Periodo 1",
      topics: ["La recta numérica"],
      barriers: expect.stringContaining("el estudiante se distrae"),
    });
    const log = await db.generationLog.findFirstOrThrow({ where: { entityId: id } });
    expect(log).toMatchObject({ task: "piar", status: "OK", promptVersion: "piar.v1" });
  });

  it("CA-0017-04: sin barreras no se pide a la IA", async () => {
    const ctx = await teacher();
    const c = await course(ctx);
    const { id } = await createPiar(ctx, { courseId: c.id, studentName: NAME, consent: true });
    const fetcher = vi.fn();
    await expect(
      proposeAdjustments(ctx, id, 1, fetcher as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("CA-0017-06: un PIAR vencido se borra al listar; borrar lo quita de la base", async () => {
    const ctx = await teacher();
    const c = await course(ctx);
    const a = await createPiar(ctx, { courseId: c.id, studentName: "Uno", consent: true });
    const b = await createPiar(ctx, { courseId: c.id, studentName: "Dos", consent: true });
    await db.piar.update({ where: { id: a.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(getPiar(ctx, a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listPiars(ctx)).map((p) => p.studentName)).toEqual(["Dos"]);
    expect(await db.piar.count({ where: { id: a.id } })).toBe(0);
    await deletePiar(ctx, b.id);
    expect(await db.piar.count()).toBe(0);
    await expect(deletePiar(ctx, b.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("CA-0017-07: la auditoría registra cada paso sin nombre ni contenido", async () => {
    const ctx = await teacher();
    const c = await course(ctx);
    const { id } = await createPiar(ctx, { courseId: c.id, studentName: NAME, consent: true });
    await savePiar(ctx, id, filled((await getPiar(ctx, id)).content));
    await getPiarForExport(ctx, id);
    await deletePiar(ctx, id);
    const logs = await db.auditLog.findMany({
      where: { entityType: "piar" },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.action)).toEqual([
      "piar.created",
      "piar.updated",
      "piar.downloaded",
      "piar.deleted",
    ]);
    expect(logs.every((l) => l.entityId === id)).toBe(true);
    expect(JSON.stringify(logs)).not.toContain("Valentina");
  });

  it("RN-05 y RN-07: el nombre se quita sin importar tildes ni mayúsculas; vence al cierre del año siguiente", () => {
    expect(withoutStudentName("VALENTINA rios no lee; valentina pide ayuda", NAME)).toBe(
      "el estudiante no lee; el estudiante pide ayuda",
    );
    expect(withoutStudentName("Escribe a ana@colegio.co", "Ana")).toBe(
      "Escribe a [correo omitido]",
    );
    expect(piarExpiry("2026").toISOString()).toBe("2028-01-01T05:00:00.000Z");
  });
});
