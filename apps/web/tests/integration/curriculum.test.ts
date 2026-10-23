import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCourse, createSubject, linkSubjectToArea, listSubjects } from "@/modules/courses";
import {
  CurriculumImportError,
  getCourseReferences,
  importCurriculumJson,
} from "@/modules/curriculum";
import { createIndependentSpace } from "@/modules/institutions";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const readFile = (name: string) => JSON.parse(readFileSync(path.join(MEN_DIR, name), "utf8"));
const realFiles = readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"));

/** Fuente mínima de prueba (no es contenido oficial). */
function fixture(
  key: string,
  items: Record<string, unknown>[],
  extra: Record<string, unknown> = {},
) {
  return {
    source: {
      key,
      issuer: "Fuente de prueba",
      title: "Documento de prueba",
      documentType: "DBA",
      area: "MATEMATICAS",
      version: key.split("-").pop(),
      year: 2020,
      url: "https://example.org/doc.pdf",
      sha256: "a".repeat(64),
      usageNote: "Solo para tests.",
      ...extra,
    },
    review: { status: "PENDING", reviewedBy: null, reviewedAt: null },
    items,
  };
}

const item = (code: string, grade: string, number: number, statement = `Enunciado ${code}`) => ({
  code,
  type: "DBA",
  area: "MATEMATICAS",
  grade,
  number,
  statement,
  evidences: ["Primera evidencia.", "Segunda evidencia."],
  page: 10 + number,
});

async function teacherWithCourse(subjectName: string, grade: string) {
  const user = await createUser("Profe");
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
  const subject = (await listSubjects(ctx)).find((s) => s.name === subjectName)!;
  const course = await createCourse(ctx, {
    subjectId: subject.id,
    grade: grade as "G6",
    groupName: "",
    academicYear: "2026",
  });
  return { user, ctx, institutionId, subject, course };
}

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

describe("importación del catálogo", () => {
  it.each(realFiles)("los archivos oficiales cumplen el schema: %s", async (file) => {
    const report = await importCurriculumJson(readFile(file), file);
    expect(report.status).toBe("created");
  });

  it("CA-0004-01: reimportar el mismo archivo no crea ni duplica nada", async () => {
    const file = fixture("TEST-DBA-V1", [item("TEST-DBA-V1-G6-01", "G6", 1)]);
    const first = await importCurriculumJson(file, "test.json");
    const second = await importCurriculumJson(file, "test.json");
    expect(first).toMatchObject({ status: "created", items: { created: 1 } });
    expect(second).toMatchObject({ status: "unchanged", items: { created: 0, unchanged: 1 } });
    expect(await db.curriculumItem.count()).toBe(1);
    expect(await db.curriculumSource.count()).toBe(1);
  });

  it("CA-0004-02: un archivo con errores falla nombrando el problema y no escribe nada", async () => {
    const duplicated = fixture("TEST-DBA-V1", [
      item("TEST-DBA-V1-G6-01", "G6", 1),
      item("TEST-DBA-V1-G6-01", "G6", 2),
    ]);
    await expect(importCurriculumJson(duplicated, "malo.json")).rejects.toThrow(
      /malo\.json.*\n.*código repetido TEST-DBA-V1-G6-01/,
    );
    const noStatement = fixture("TEST-DBA-V1", [
      { ...item("TEST-DBA-V1-G6-01", "G6", 1), statement: "" },
    ]);
    await expect(importCurriculumJson(noStatement, "vacio.json")).rejects.toBeInstanceOf(
      CurriculumImportError,
    );
    expect(await db.curriculumSource.count()).toBe(0);
  });

  it("CA-0004-03: una versión nueva reemplaza a la anterior sin borrar sus ítems", async () => {
    await importCurriculumJson(fixture("TEST-DBA-V1", [item("TEST-DBA-V1-G6-01", "G6", 1)]), "v1");
    const report = await importCurriculumJson(
      fixture("TEST-DBA-V2", [item("TEST-DBA-V2-G6-01", "G6", 1, "Enunciado nuevo")]),
      "v2",
    );
    expect(report.superseded).toEqual(["TEST-DBA-V1"]);
    expect(
      await db.curriculumSource.findUniqueOrThrow({ where: { key: "TEST-DBA-V1" } }),
    ).toMatchObject({ status: "SUPERSEDED" });
    expect(await db.curriculumItem.count({ where: { code: "TEST-DBA-V1-G6-01" } })).toBe(1);

    const { ctx, course } = await teacherWithCourse("Matemáticas", "G6");
    const refs = await getCourseReferences(ctx, course.id);
    expect(refs.references.map((r) => r.code)).toEqual(["TEST-DBA-V2-G6-01"]);
  });

  it("una corrección de la misma versión actualiza en sitio, pero no puede quitar ítems", async () => {
    const base = [item("TEST-DBA-V1-G6-01", "G6", 1), item("TEST-DBA-V1-G6-02", "G6", 2)];
    await importCurriculumJson(fixture("TEST-DBA-V1", base), "v1");
    const corrected = await importCurriculumJson(
      fixture("TEST-DBA-V1", [{ ...base[0]!, statement: "Enunciado corregido" }, base[1]!]),
      "v1",
    );
    expect(corrected).toMatchObject({ status: "updated", items: { updated: 1, unchanged: 1 } });

    await expect(importCurriculumJson(fixture("TEST-DBA-V1", [base[0]!]), "v1")).rejects.toThrow(
      /quita ítems ya publicados/,
    );
    expect(await db.curriculumItem.count()).toBe(2);
  });
});

describe("referentes por curso", () => {
  beforeEach(async () => {
    for (const file of realFiles) await importCurriculumJson(readFile(file), file);
  });

  it("CA-0004-04: un curso de Matemáticas 6° ve sus DBA con evidencias y cita", async () => {
    const { ctx, course } = await teacherWithCourse("Matemáticas", "G6");
    const refs = await getCourseReferences(ctx, course.id);
    const expected = readFile("dba-matematicas-v2.json").items.filter(
      (i: { grade: string }) => i.grade === "G6",
    );

    expect(refs.areaId).toBe("MATEMATICAS");
    expect(refs.references).toHaveLength(expected.length);
    expect(refs.references[0]).toMatchObject({
      code: "MEN-DBA-MAT-V2-G6-01",
      citation: {
        issuer: "Ministerio de Educación Nacional (MEN)",
        version: "V.2",
        year: 2016,
        page: expected[0].page,
      },
    });
    expect(refs.references[0]!.evidences.length).toBeGreaterThanOrEqual(2);
    expect(refs.references[0]!.citation.url).toMatch(/^https:\/\/www\.colombiaaprende\.edu\.co\//);
  });

  it("CA-0004-04: un curso de Transición ve los 16 DBA de Transición, sin importar la asignatura", async () => {
    const { ctx, course } = await teacherWithCourse("Educación Artística", "TRANSICION");
    const refs = await getCourseReferences(ctx, course.id);
    expect(refs.areaId).toBe("TRANSICION");
    expect(refs.references).toHaveLength(16);
  });

  it("CA-0004-05: las asignaturas precargadas quedan vinculadas a su área", async () => {
    const user = await createUser();
    const { institutionId } = await createIndependentSpace(user);
    const subjects = await listSubjects(await ctxFor(user, institutionId));
    const area = (name: string) => subjects.find((s) => s.name === name)?.curriculumAreaId;
    expect(area("Matemáticas")).toBe("MATEMATICAS");
    expect(area("Lengua Castellana")).toBe("LENGUAJE");
    expect(area("Ciencias Naturales y Educación Ambiental")).toBe("CIENCIAS_NATURALES");
    expect(area("Ciencias Sociales")).toBe("CIENCIAS_SOCIALES");
    expect(area("Inglés")).toBe("INGLES");
    expect(area("Filosofía")).toBeNull();
  });

  it("CA-0004-06: una asignatura propia vinculada a un área muestra sus referentes", async () => {
    const { ctx } = await teacherWithCourse("Matemáticas", "G6");
    const custom = await createSubject(ctx, "Lectura crítica");
    const course = await createCourse(ctx, {
      subjectId: custom.id,
      grade: "G9",
      groupName: "",
      academicYear: "2026",
    });
    expect((await getCourseReferences(ctx, course.id)).emptyReason).toBe("NO_AREA");

    await linkSubjectToArea(ctx, custom.id, "LENGUAJE");
    const refs = await getCourseReferences(ctx, course.id);
    expect(refs.emptyReason).toBeNull();
    expect(refs.references.every((r) => r.code.startsWith("MEN-DBA-LEN-V2-G9-"))).toBe(true);
    expect(refs.references).toHaveLength(8);
  });

  it("muestra un aviso cuando el área no tiene DBA en ese grado", async () => {
    const { ctx, course } = await teacherWithCourse("Ciencias Sociales", "G6");
    expect((await getCourseReferences(ctx, course.id)).emptyReason).toBe("NO_ITEMS_FOR_GRADE");
  });

  it("CA-0004-07: el curso de otro docente o de otro espacio responde NOT_FOUND", async () => {
    const a = await teacherWithCourse("Matemáticas", "G6");
    const b = await teacherWithCourse("Matemáticas", "G6");
    await expect(getCourseReferences(b.ctx, a.course.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(linkSubjectToArea(b.ctx, a.subject.id, "LENGUAJE")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("CA-0004-08: el texto guardado es idéntico al del archivo importado", async () => {
    for (const file of realFiles) {
      const { items } = readFile(file);
      const stored = await db.curriculumItem.findMany({
        where: { code: { in: items.map((i: { code: string }) => i.code) } },
        select: { code: true, statement: true, evidences: true },
      });
      const byCode = new Map(stored.map((s) => [s.code, s]));
      for (const i of items) {
        expect(byCode.get(i.code)).toEqual({
          code: i.code,
          statement: i.statement,
          evidences: i.evidences,
        });
      }
    }
  });
});

describe("estándares por rango de grados (RN-06)", () => {
  it("un estándar de 6° a 7° aplica a cursos de 6° y 7°, no de 8°", async () => {
    await importCurriculumJson(
      fixture(
        "TEST-EBC-V1",
        [
          {
            code: "TEST-EBC-V1-01",
            type: "STANDARD",
            area: "MATEMATICAS",
            gradeFrom: "G6",
            gradeTo: "G7",
            number: 1,
            statement: "Estándar de prueba para sexto y séptimo.",
            evidences: ["Desempeño de prueba."],
            page: 3,
          },
        ],
        { documentType: "STANDARD" },
      ),
      "ebc",
    );
    const codes = async (grade: string) => {
      const { ctx, course } = await teacherWithCourse("Matemáticas", grade);
      return (await getCourseReferences(ctx, course.id)).references.map((r) => r.code);
    };
    expect(await codes("G6")).toEqual(["TEST-EBC-V1-01"]);
    expect(await codes("G7")).toEqual(["TEST-EBC-V1-01"]);
    expect(await codes("G8")).toEqual([]);
  });
});
