import { describe, expect, it } from "vitest";
import { redactContactData } from "@/lib/text";
import { blueprintSchema, defaultsForGrade } from "@/modules/resources/client";

const base = {
  topicId: "t1",
  objectiveIds: [],
  durationMinutes: 45,
  difficulty: "BASIC",
  notes: null,
};

describe("blueprint (SPEC-0008 §5)", () => {
  it("acepta un quiz válido", () => {
    const parsed = blueprintSchema.safeParse({
      ...base,
      type: "QUIZ",
      itemCount: 5,
      questionTypes: ["MULTIPLE_CHOICE"],
      cognitiveDistribution: { REMEMBER: 60, APPLY: 40 },
    });
    expect(parsed.success).toBe(true);
  });

  it("explica una distribución imposible antes de enviar", () => {
    const parsed = blueprintSchema.safeParse({
      ...base,
      type: "QUIZ",
      itemCount: 3,
      questionTypes: ["MULTIPLE_CHOICE"],
      cognitiveDistribution: { REMEMBER: 25, UNDERSTAND: 25, APPLY: 25, ANALYZE: 25 },
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain("no caben 4 niveles");
  });

  it("los porcentajes deben sumar 100", () => {
    const parsed = blueprintSchema.safeParse({
      ...base,
      type: "QUIZ",
      itemCount: 5,
      questionTypes: ["MULTIPLE_CHOICE"],
      cognitiveDistribution: { REMEMBER: 60 },
    });
    expect(parsed.success).toBe(false);
  });

  it("CA-0008-14 / RN-10: cada momento de la estructura necesita al menos una actividad", () => {
    const parsed = blueprintSchema.safeParse({
      ...base,
      type: "WORKSHOP",
      itemCount: 3,
      structure: "PROBLEM_SITUATION",
      cognitiveDistribution: { APPLY: 100 },
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain("4 momentos");
  });

  it("los valores por defecto dependen del grado", () => {
    expect(defaultsForGrade("TRANSICION").difficulty).toBe("BASIC");
    expect(defaultsForGrade("G10").questionTypes).not.toContain("TRUE_FALSE");
  });
});

describe("redactContactData (SPEC-0008 §9)", () => {
  it("quita correos y teléfonos", () => {
    const text = redactContactData("Escribe a ana.perez@colegio.edu.co o al +57 300 123 4567.");
    expect(text).toBe("Escribe a [correo omitido] o al [número omitido].");
  });

  it("no toca cantidades de matemáticas", () => {
    const text = "Números hasta 1.000.000 y la resta 345 - 120 = 225";
    expect(redactContactData(text)).toBe(text);
  });
});
