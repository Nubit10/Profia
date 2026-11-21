import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { getCourseReferences, importCurriculumJson } from "@/modules/curriculum";
import { createIndependentSpace } from "@/modules/institutions";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0036: DBA y Estándares de Ciencias Naturales y Ciencias Sociales.
const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const NEW_FILES = [
  "dba-ciencias-naturales-v1.json",
  "dba-ciencias-sociales-v1.json",
  "ebc-ciencias-naturales-v1.json",
  "ebc-ciencias-sociales-v1.json",
];
const readFile = (name: string) => JSON.parse(readFileSync(path.join(MEN_DIR, name), "utf8"));

async function importAll() {
  for (const file of NEW_FILES) await importCurriculumJson(readFile(file), file);
}

async function course(subjectName: string, grade: string) {
  const user = await createUser("Docente de ciencias");
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
  const subject = (await listSubjects(ctx)).find((s) => s.name === subjectName)!;
  const created = await createCourse(ctx, {
    subjectId: subject.id,
    grade: grade as "G6",
    groupName: "",
    academicYear: "2026",
  });
  return { ctx, course: created };
}

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

describe("SPEC-0036 — catálogo de Ciencias", () => {
  it("CA-0036-02: importar dos veces las fuentes nuevas no crea ni duplica nada", async () => {
    for (const file of NEW_FILES) {
      expect((await importCurriculumJson(readFile(file), file)).status).toBe("created");
    }
    const count = await db.curriculumItem.count();
    for (const file of NEW_FILES) {
      const again = await importCurriculumJson(readFile(file), file);
      expect(again.status).toBe("unchanged");
    }
    expect(await db.curriculumItem.count()).toBe(count);
    expect(count).toBe(54 + 82 + 342 + 250);
  });

  it("CA-0036-03: Ciencias Naturales de 6° muestra sus DBA de 6° y los Estándares de 6°-7°, con cita", async () => {
    await importAll();
    const { ctx, course: c } = await course("Ciencias Naturales y Educación Ambiental", "G6");
    const refs = await getCourseReferences(ctx, c.id);

    const dba = refs.references.filter((r) => r.type === "DBA");
    const standards = refs.references.filter((r) => r.type === "STANDARD");
    expect(dba.map((r) => r.code)).toEqual([1, 2, 3, 4, 5].map((n) => `MEN-DBA-CNA-V1-G6-0${n}`));
    expect(standards.length).toBe(78);
    expect(standards.every((r) => r.code.startsWith("MEN-EBC-CNA-V1-G6A7-"))).toBe(true);
    expect(dba[0]!.evidences.length).toBeGreaterThanOrEqual(2);
    expect(dba[0]!.citation).toMatchObject({
      title: "Derechos Básicos de Aprendizaje: Ciencias Naturales",
      version: "V.1",
      year: 2016,
    });
    expect(standards[0]!.citation.title).toBe(
      "Estándares Básicos de Competencias en Ciencias Naturales",
    );
    expect(standards[0]!.component).toBe("Me aproximo al conocimiento como científico(a) natural");
  });

  it("CA-0036-04: Ciencias Sociales de 8° muestra sus DBA de 8° y los Estándares de 8°-9°", async () => {
    await importAll();
    const { ctx, course: c } = await course("Ciencias Sociales", "G8");
    const refs = await getCourseReferences(ctx, c.id);
    expect(refs.references.filter((r) => r.type === "DBA")).toHaveLength(8);
    const standards = refs.references.filter((r) => r.type === "STANDARD");
    expect(standards).toHaveLength(50);
    // Una acción de «relaciones con la historia» apunta a su estándar general (un solo estándar).
    const history = standards.find((r) => r.component?.includes("historia y las culturas"))!;
    expect(history.evidences).toHaveLength(1);
  });

  it("SPEC-0036 RN-05: Biología y Historia vienen precargadas y ven su área", async () => {
    await importAll();
    const bio = await course("Biología", "G10");
    expect(
      (await getCourseReferences(bio.ctx, bio.course.id)).references.some((r) =>
        r.code.startsWith("MEN-DBA-CNA-V1-G10-"),
      ),
    ).toBe(true);
    const history = await course("Historia", "G11");
    expect(
      (await getCourseReferences(history.ctx, history.course.id)).references.some((r) =>
        r.code.startsWith("MEN-DBA-CSO-V1-G11-"),
      ),
    ).toBe(true);
  });

  it("CA-0036-08: el texto guardado es idéntico al del archivo", async () => {
    await importAll();
    for (const file of NEW_FILES) {
      const { items } = readFile(file);
      const stored = await db.curriculumItem.findMany({
        where: { code: { in: items.map((i: { code: string }) => i.code) } },
        select: { code: true, statement: true, evidences: true, component: true },
      });
      const byCode = new Map(stored.map((s) => [s.code, s]));
      for (const i of items) {
        expect(byCode.get(i.code)).toMatchObject({
          statement: i.statement,
          evidences: i.evidences,
          component: i.component ?? null,
        });
      }
    }
  });

  it("CA-0036-09: las fuentes nuevas quedan pendientes de revisión docente", async () => {
    await importAll();
    const sources = await db.curriculumSource.findMany({
      where: {
        key: { in: ["MEN-DBA-CNA-V1", "MEN-DBA-CSO-V1", "MEN-EBC-CNA-V1", "MEN-EBC-CSO-V1"] },
      },
      select: { reviewStatus: true },
    });
    expect(sources).toHaveLength(4);
    expect(sources.every((s) => s.reviewStatus === "PENDING")).toBe(true);
    const { ctx, course: c } = await course("Ciencias Sociales", "G3");
    const refs = await getCourseReferences(ctx, c.id);
    expect(refs.references.every((r) => r.citation.reviewed === false)).toBe(true);
  });
});
