import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson, searchCourseCurriculum } from "@/modules/curriculum";
import { createIndependentSpace } from "@/modules/institutions";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");

const engineReply = (codes: string[], status = 200) =>
  vi.fn(async () =>
    Response.json(
      {
        results: codes.map((code, i) => ({ code, score: 1 - i / 10 })),
        meta: { provider: "mock", denseModel: "mock", catalogVersion: "abc", latencyMs: 12 },
      },
      { status },
    ),
  );

async function mathCourse(grade: "G6" | "TRANSICION" = "G6") {
  const user = await createUser();
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
  const math = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
  const course = await createCourse(ctx, {
    subjectId: math.id,
    grade,
    groupName: "",
    academicYear: "2026",
  });
  return { ctx, course };
}

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});

afterAll(() => db.$disconnect());

describe("búsqueda en el currículo (SPEC-0005)", () => {
  it("envía al AI Engine solo la consulta, el área y el grado del curso, con el token", async () => {
    const { ctx, course } = await mathCourse();
    const fetcher = engineReply(["MEN-DBA-MAT-V2-G6-03"]);
    await searchCourseCurriculum(ctx, course.id, "fracciones y decimales", fetcher);

    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://ai-engine.test:8100/v1/retrieval/curriculum");
    expect(init.headers).toMatchObject({ authorization: "Bearer token-de-prueba-token-de-prueba" });
    expect(JSON.parse(String(init.body))).toEqual({
      query: "fracciones y decimales",
      area: "MATEMATICAS",
      grade: "G6",
      limit: 8,
    });
    // Sin datos personales (plan maestro §18).
    expect(String(init.body)).not.toContain(ctx.userEmail);
    expect(String(init.body)).not.toContain(ctx.userName);
  });

  it("CA-0005-07: devuelve los ítems en el orden del AI Engine, con texto y cita desde la base", async () => {
    const { ctx, course } = await mathCourse();
    const result = await searchCourseCurriculum(
      ctx,
      course.id,
      "fracciones",
      engineReply(["MEN-DBA-MAT-V2-G6-03", "MEN-DBA-MAT-V2-G6-01"]),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.references.map((r) => r.code)).toEqual([
      "MEN-DBA-MAT-V2-G6-03",
      "MEN-DBA-MAT-V2-G6-01",
    ]);
    const stored = await db.curriculumItem.findUniqueOrThrow({
      where: { code: "MEN-DBA-MAT-V2-G6-03" },
    });
    expect(result.references[0]).toMatchObject({
      statement: stored.statement,
      citation: { title: "Derechos Básicos de Aprendizaje: Matemáticas", version: "V.2" },
    });
  });

  it("no muestra ítems de fuentes reemplazadas ni códigos desconocidos (índice desactualizado)", async () => {
    const { ctx, course } = await mathCourse();
    await db.curriculumSource.update({
      where: { key: "MEN-DBA-LEN-V2" },
      data: { status: "SUPERSEDED" },
    });
    const result = await searchCourseCurriculum(
      ctx,
      course.id,
      "lectura",
      engineReply(["MEN-DBA-LEN-V2-G6-01", "NO-EXISTE", "MEN-DBA-MAT-V2-G6-02"]),
    );
    expect(result.status === "ok" && result.references.map((r) => r.code)).toEqual([
      "MEN-DBA-MAT-V2-G6-02",
    ]);
  });

  it("en Transición busca en los DBA de Transición", async () => {
    const { ctx, course } = await mathCourse("TRANSICION");
    const fetcher = engineReply(["MEN-DBA-TRA-V1-15"]);
    await searchCourseCurriculum(ctx, course.id, "clasificar objetos", fetcher);
    const body = JSON.parse(
      String((fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1].body),
    );
    expect(body).toMatchObject({ area: "TRANSICION", grade: "TRANSICION" });
  });

  it.each([
    ["error 500", engineReply([], 500)],
    ["token rechazado", engineReply([], 401)],
    ["respuesta con formato inválido", vi.fn(async () => Response.json({ foo: "bar" }))],
    ["sin conexión", vi.fn(async () => Promise.reject(new TypeError("fetch failed")))],
    [
      "timeout",
      vi.fn(async () =>
        Promise.reject(new DOMException("The operation timed out", "TimeoutError")),
      ),
    ],
  ])(
    "CA-0005-04: si el AI Engine falla (%s), responde 'unavailable' sin romper",
    async (_, fetcher) => {
      const { ctx, course } = await mathCourse();
      await expect(
        searchCourseCurriculum(ctx, course.id, "fracciones", fetcher as unknown as typeof fetch),
      ).resolves.toEqual({ status: "unavailable" });
    },
  );

  it("sin AI Engine configurado no llama a nada y responde 'unavailable'", async () => {
    const { ctx, course } = await mathCourse();
    const saved = process.env.AI_ENGINE_URL;
    delete process.env.AI_ENGINE_URL;
    vi.resetModules();
    const { searchCourseCurriculum: fresh } = await import("@/modules/curriculum");
    const fetcher = engineReply([]);
    await expect(fresh(ctx, course.id, "fracciones", fetcher)).resolves.toEqual({
      status: "unavailable",
    });
    expect(fetcher).not.toHaveBeenCalled();
    process.env.AI_ENGINE_URL = saved;
  });

  it("el curso de otro docente responde NOT_FOUND sin llamar al AI Engine", async () => {
    const a = await mathCourse();
    const b = await mathCourse();
    const fetcher = engineReply([]);
    await expect(
      searchCourseCurriculum(b.ctx, a.course.id, "fracciones", fetcher),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
