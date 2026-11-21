import { describe, expect, it } from "vitest";
import {
  adjustedBlueprint,
  adjustmentCurrent,
  adjustmentLabel,
  availableAdjustments,
  type Blueprint,
  type ResourceContent,
} from "@/modules/resources/client";

// SPEC-0027: qué botones tiene cada recurso y con qué blueprint se pide el ajuste.

const activity = (id: string) => ({
  id,
  title: "A",
  instructions: "Haz algo",
  durationMinutes: 10,
  expectedOutcome: "",
  cognitiveLevel: "APPLY" as const,
  dbaCodes: [],
});

const workshop = (perMoment: number[]): ResourceContent =>
  ({
    type: "WORKSHOP",
    content: {
      title: "Taller",
      purpose: "",
      studentInstructions: "",
      materials: [],
      moments: perMoment.map((n, m) => ({
        name: `M${m}`,
        activities: Array.from({ length: n }, (_, i) => activity(`${m}-${i}`)),
      })),
      teacherGuidance: [],
    },
  }) as unknown as ResourceContent;

const workshopBlueprint = {
  type: "WORKSHOP",
  topicId: "t",
  objectiveIds: [],
  durationMinutes: 60,
  difficulty: "INTERMEDIATE",
  itemCount: 4,
  structure: "START_DEVELOPMENT_CLOSE",
  cognitiveDistribution: { APPLY: 100 },
  notes: null,
  excludedPreferenceIds: [],
} as Blueprint;

describe("SPEC-0027 ajustes rápidos", () => {
  it("«Más corto» en el taller deja al menos una actividad por momento", () => {
    const b = adjustedBlueprint(workshopBlueprint, workshop([1, 1, 1]), "SHORTER");
    expect(b.type === "WORKSHOP" && b.itemCount).toBe(3);
    const c = adjustedBlueprint(workshopBlueprint, workshop([1, 3, 2]), "SHORTER");
    expect(c.type === "WORKSHOP" && c.itemCount).toBe(4);
  });

  it("«Más fácil» y «Más difícil» mueven la dificultad un nivel", () => {
    const data = workshop([1, 2, 1]);
    expect(adjustedBlueprint(workshopBlueprint, data, "EASIER").difficulty).toBe("BASIC");
    expect(adjustedBlueprint(workshopBlueprint, data, "HARDER").difficulty).toBe("ADVANCED");
    expect(adjustedBlueprint(workshopBlueprint, data, "EVERYDAY_EXAMPLES").difficulty).toBe(
      "INTERMEDIATE",
    );
  });

  it("«Agregar 2» no aparece si se pasaría del máximo; el plan de aula no lo tiene", () => {
    expect(availableAdjustments(workshop([3, 2, 2]))).not.toContain("ADD_ITEMS");
    expect(availableAdjustments(workshop([1, 2, 1]))).toContain("ADD_ITEMS");
    const plan = {
      type: "LESSON_PLAN",
      content: { sessions: [{}, {}] },
    } as unknown as ResourceContent;
    expect(availableAdjustments(plan)).toEqual([
      "EASIER",
      "HARDER",
      "SHORTER",
      "EVERYDAY_EXAMPLES",
    ]);
    expect(adjustmentLabel("ADD_ITEMS", "WORKSHOP")).toBe("Agregar 2 actividades");
  });

  it("la versión actual viaja sin identificadores internos", () => {
    const current = adjustmentCurrent(workshop([1])) as { moments: { activities: object[] }[] };
    expect(current.moments[0]!.activities[0]).not.toHaveProperty("id");
  });
});
