import { describe, expect, it } from "vitest";
import { getNavSections, isActive } from "@/components/app-shell/nav-items";
import { quotaLine } from "@/components/app-shell/quota-line";

// SPEC-0012 §2.1: el menú lateral se arma según el rol desde una sola fuente.

const titles = (access: Parameters<typeof getNavSections>[0]) =>
  getNavSections(access).map((s) => [s.title, s.items.map((i) => i.label)]);

describe("menú lateral por rol (CA-0012-20)", () => {
  it("CA-0012-20: el docente ve Principal, Mi trabajo y Ajustes", () => {
    expect(titles({ isTeacher: true, isSchoolAdmin: false })).toEqual([
      ["Principal", ["Inicio", "Mis cursos"]],
      ["Mi trabajo", ["Mis recursos", "Formatos"]],
      ["Ajustes", ["Asignaturas"]],
    ]);
  });

  it("CA-0012-20: el administrador que también da clases ve además Colegio", () => {
    expect(titles({ isTeacher: true, isSchoolAdmin: true })).toEqual([
      ["Principal", ["Inicio", "Mis cursos"]],
      ["Mi trabajo", ["Mis recursos", "Formatos"]],
      ["Ajustes", ["Asignaturas"]],
      ["Colegio", ["Datos y sedes", "Profesores"]],
    ]);
  });

  it("CA-0012-20: el administrador sin rol docente ve solo Inicio y Colegio (con formato y asignaturas)", () => {
    expect(titles({ isTeacher: false, isSchoolAdmin: true })).toEqual([
      ["Principal", ["Inicio"]],
      ["Colegio", ["Datos y sedes", "Profesores", "Formatos", "Asignaturas"]],
    ]);
  });
});

describe("ítem activo (CA-0012-22)", () => {
  const items = getNavSections({ isTeacher: true, isSchoolAdmin: true }).flatMap((s) => s.items);
  const active = (path: string) => items.filter((i) => isActive(i, path)).map((i) => i.label);

  it("CA-0012-22: dentro de un curso o un recurso, queda activo Mis cursos", () => {
    expect(active("/courses/abc")).toEqual(["Mis cursos"]);
    expect(active("/courses/abc/resources/xyz")).toEqual(["Mis cursos"]);
  });

  it("cada ruta marca un solo ítem", () => {
    expect(active("/dashboard")).toEqual(["Inicio"]);
    expect(active("/resources")).toEqual(["Mis recursos"]);
    expect(active("/school")).toEqual(["Datos y sedes"]);
    expect(active("/school/members")).toEqual(["Profesores"]);
  });
});

describe("línea de cupo (CA-0012-21)", () => {
  it("CA-0012-21: muestra lo usado del cupo", () => {
    expect(quotaLine({ used: 7, limit: 10, freesAtLabel: null })).toMatchObject({
      text: "7 de 10 recursos con IA hoy",
      short: "7/10 hoy",
      tone: "text-brand-strong",
    });
  });

  it("CA-0012-21: avisa en ámbar cuando quedan 2 o menos", () => {
    expect(quotaLine({ used: 8, limit: 10, freesAtLabel: null }).tone).toBe("text-warning");
  });

  it("CA-0012-21: agotado, dice a qué hora se renueva", () => {
    expect(quotaLine({ used: 10, limit: 10, freesAtLabel: "3:40 p. m." })).toMatchObject({
      text: "Cupo de IA agotado · vuelve a las 3:40 p. m.",
      tone: "text-danger",
    });
  });
});
