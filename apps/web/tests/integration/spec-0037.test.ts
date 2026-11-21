import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { getCourseReferences, importCurriculumJson } from "@/modules/curriculum";
import { createIndependentSpace } from "@/modules/institutions";
import { createUser, ctxFor, resetDatabase } from "../support/factories";

// SPEC-0037: Estándares de Matemáticas, Lenguaje e Inglés (Guía 22).
const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const NEW_FILES = [
  "ebc-matematicas-v1.json",
  "ebc-lenguaje-v1.json",
  "ebc-ingles-parte1-v1.json",
  "ebc-ingles-parte2-v1.json",
];
const readFile = (name: string) => JSON.parse(readFileSync(path.join(MEN_DIR, name), "utf8"));

async function importAll() {
  for (const file of NEW_FILES) await importCurriculumJson(readFile(file), file);
}

async function course(subjectName: string, grade: string) {
  const user = await createUser("Docente");
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

const standardsOf = async (subject: string, grade: string) => {
  const { ctx, course: c } = await course(subject, grade);
  return (await getCourseReferences(ctx, c.id)).references.filter((r) => r.type === "STANDARD");
};

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

describe("SPEC-0037 — Estándares de Matemáticas, Lenguaje e Inglés", () => {
  it("CA-0037-01: importar dos veces las fuentes nuevas no crea ni duplica nada", async () => {
    for (const file of NEW_FILES) {
      expect((await importCurriculumJson(readFile(file), file)).status).toBe("created");
    }
    for (const file of NEW_FILES) {
      expect((await importCurriculumJson(readFile(file), file)).status).toBe("unchanged");
    }
    expect(await db.curriculumItem.count()).toBe(172 + 177 + 91 + 127);
  });

  it("CA-0037-02: Matemáticas de 6° muestra los estándares de 6°-7° por pensamiento, sin lista", async () => {
    await importAll();
    const standards = await standardsOf("Matemáticas", "G6");
    expect(standards).toHaveLength(38);
    expect(new Set(standards.map((s) => s.component))).toEqual(
      new Set([
        "Pensamiento numérico y sistemas numéricos",
        "Pensamiento espacial y sistemas geométricos",
        "Pensamiento métrico y sistemas de medidas",
        "Pensamiento aleatorio y sistemas de datos",
        "Pensamiento variacional y sistemas algebraicos y analíticos",
      ]),
    );
    expect(standards.every((s) => s.evidences.length === 0)).toBe(true);
  });

  it("CA-0037-03: Lenguaje de 8° muestra cada subproceso con el estándar de su columna", async () => {
    await importAll();
    const standards = await standardsOf("Lengua Castellana", "G8");
    expect(standards).toHaveLength(37);
    expect(standards.every((s) => s.evidences.length === 1)).toBe(true);
    expect(standards[0]!.citation.title).toBe("Estándares Básicos de Competencias del Lenguaje");
  });

  it("CA-0037-04: Inglés de 10° muestra los estándares de 10°-11° por habilidad, con sus competencias", async () => {
    await importAll();
    const standards = await standardsOf("Inglés", "G10");
    expect(standards).toHaveLength(44);
    expect(new Set(standards.map((s) => s.component))).toEqual(
      new Set(["Escucha", "Lectura", "Escritura", "Monólogos", "Conversación"]),
    );
    expect(standards.flatMap((s) => s.evidences).every((e) => e.startsWith("Competencia "))).toBe(
      true,
    );
    expect(standards[0]!.citation.title).toContain("Guía 22");
  });

  it("CA-0037-05: el texto guardado es idéntico al del archivo", async () => {
    await importAll();
    for (const file of NEW_FILES) {
      const { items } = readFile(file);
      const stored = await db.curriculumItem.findMany({
        where: { code: { in: items.map((i: { code: string }) => i.code) } },
        select: { code: true, statement: true, evidences: true },
      });
      const byCode = new Map(stored.map((s) => [s.code, s]));
      for (const i of items) {
        expect(byCode.get(i.code)).toMatchObject({
          statement: i.statement,
          evidences: i.evidences,
        });
      }
    }
  });
});
