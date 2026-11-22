import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import {
  curriculumFileSchema,
  getCourseReferences,
  importCurriculumJson,
} from "@/modules/curriculum";
import { createIndependentSpace } from "@/modules/institutions";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0038: Competencias Ciudadanas y DBA de Inglés 6°-11° (Esquema Curricular Sugerido).
const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const NEW_FILES = ["ebc-ciudadanas-v1.json", "dba-ingles-esquema-v1.json"];
const readFile = (name: string) => JSON.parse(readFileSync(path.join(MEN_DIR, name), "utf8"));

async function importAll() {
  for (const file of [...NEW_FILES, "ebc-ingles-parte2-v1.json"]) {
    await importCurriculumJson(readFile(file), file);
  }
}

async function referencesOf(subjectName: string, grade: string) {
  const user = await createUser("Docente");
  const { institutionId } = await createIndependentSpace(user);
  const ctx = await ctxFor(user, institutionId);
  const subject = (await listSubjects(ctx)).find((s) => s.name === subjectName)!;
  const course = await createCourse(ctx, {
    subjectId: subject.id,
    grade: grade as "G6",
    groupName: "",
    academicYear: "2026",
  });
  return (await getCourseReferences(ctx, course.id)).references;
}

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

describe("SPEC-0038 — Competencias Ciudadanas y DBA de Inglés", () => {
  it("CA-0038-01: importar dos veces las fuentes nuevas no crea ni duplica nada", async () => {
    for (const file of NEW_FILES) {
      expect((await importCurriculumJson(readFile(file), file)).status).toBe("created");
    }
    for (const file of NEW_FILES) {
      expect((await importCurriculumJson(readFile(file), file)).status).toBe("unchanged");
    }
    expect(await db.curriculumItem.count()).toBe(156 + 46);
  });

  it("CA-0038-02: Inglés de 6° muestra sus 8 DBA (nivel A1, sin evidencias) y los Estándares de 6°-7°", async () => {
    await importAll();
    const refs = await referencesOf("Inglés", "G6");
    const dba = refs.filter((r) => r.type === "DBA");
    expect(dba.map((r) => r.code)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `MEN-DBA-ING-ESQ-V1-G6-0${n}`),
    );
    expect(dba[0]).toMatchObject({
      statement: "Participa en una conversación corta.",
      component: "Nivel A1",
      evidences: [],
    });
    expect(dba[0]!.citation).toMatchObject({ year: 2016, page: 33, reviewed: false });
    expect(refs.some((r) => r.code.startsWith("MEN-EBC-ING2-V1-G6A7-"))).toBe(true);
  });

  it("CA-0038-03: los DBA que el PDF trae con fuente ilegible quedan con el texto de la página", async () => {
    await importAll();
    const g7 = await referencesOf("Inglés", "G7");
    expect(g7.find((r) => r.code === "MEN-DBA-ING-ESQ-V1-G7-05")!.statement).toBe(
      "Reconoce información específica relacionada con objetos, personas y acciones.",
    );
    const all = await db.curriculumItem.findMany({ where: { areaId: "INGLES", type: "DBA" } });
    expect(all).toHaveLength(46);
    expect(all.some((i) => i.statement.includes("[ilegible]"))).toBe(false);
    expect(all.map((i) => i.component).filter((c, i, a) => a.indexOf(c) === i)).toEqual(
      expect.arrayContaining([
        "Nivel A1",
        "Nivel A2.1",
        "Nivel A2.2",
        "Nivel B1.1",
        "Nivel B1.2",
        "Nivel B1.3",
      ]),
    );
  });

  it("CA-0038-04: Ética de 8° y Cátedra de la Paz muestran los Estándares de Competencias Ciudadanas", async () => {
    await importAll();
    const etica = await referencesOf("Ética y Valores Humanos", "G8");
    expect(etica).toHaveLength(32);
    expect(
      etica.every((r) => r.type === "STANDARD" && r.code.startsWith("MEN-EBC-CIU-V1-G8A9-")),
    ).toBe(true);
    const first = etica[0]!;
    expect(first.component).toBe("Convivencia y paz");
    expect(first.evidences).toHaveLength(1); // el estándar general de su grupo
    expect(first.citation.title).toBe("Estándares Básicos de Competencias Ciudadanas");
    const paz = await referencesOf("Cátedra de la Paz", "G10");
    expect(paz).toHaveLength(27);
  });

  it("CA-0038-05: el texto guardado es idéntico al del archivo y queda pendiente de revisión", async () => {
    await importAll();
    for (const file of NEW_FILES) {
      const { items, source } = readFile(file);
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
      const row = await db.curriculumSource.findUniqueOrThrow({ where: { key: source.key } });
      expect(row.reviewStatus).toBe("PENDING");
    }
  });

  it("CA-0038-07: un DBA sin evidencias solo se acepta en una fuente marcada como versión corta", () => {
    const file = readFile("dba-ingles-esquema-v1.json");
    expect(curriculumFileSchema.safeParse(file).success).toBe(true);
    const unmarked = { ...file, source: { ...file.source, dbaWithoutEvidences: undefined } };
    const result = curriculumFileSchema.safeParse(unmarked);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Un DBA lleva al menos una evidencia");
  });

  describe("etapa 2: orientaciones pedagógicas del MEN (ADR-0022)", () => {
    const ORI_FILES = [
      "ori-tecnologia-v1.json",
      "ori-educacion-fisica-v1.json",
      "ori-artistica-v1.json",
      "ori-filosofia-v1.json",
    ];
    const importOrientations = async () => {
      for (const file of ORI_FILES) await importCurriculumJson(readFile(file), file);
    };

    it("CA-0038-08: importar dos veces las orientaciones no crea ni duplica nada", async () => {
      for (const file of ORI_FILES) {
        expect((await importCurriculumJson(readFile(file), file)).status).toBe("created");
      }
      for (const file of ORI_FILES) {
        expect((await importCurriculumJson(readFile(file), file)).status).toBe("unchanged");
      }
      expect(await db.curriculumItem.count({ where: { type: "ORIENTATION" } })).toBe(
        169 + 150 + 45 + 15,
      );
    });

    it("CA-0038-09: cada asignatura ve las orientaciones de su grupo de grados, con su cita", async () => {
      await importOrientations();
      const tec = await referencesOf("Tecnología e Informática", "G6");
      expect(tec).toHaveLength(31);
      expect(tec.every((r) => r.type === "ORIENTATION")).toBe(true);
      expect(tec[0]).toMatchObject({
        component: "Naturaleza y evolución de la tecnología",
        citation: { year: 2008, reviewed: false },
      });
      expect(tec[0]!.evidences).toHaveLength(1); // la competencia del componente
      expect(await referencesOf("Educación Física, Recreación y Deportes", "G10")).toHaveLength(30);
      expect(await referencesOf("Educación Artística", "G4")).toHaveLength(9);
      expect(await referencesOf("Filosofía", "G11")).toHaveLength(15);
      // Filosofía es de la media: en 9° no hay orientaciones.
      expect(await referencesOf("Filosofía", "G9")).toHaveLength(0);
    });

    it("CA-0038-10: el texto guardado es idéntico al del archivo", async () => {
      await importOrientations();
      for (const file of ORI_FILES) {
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
  });
});
