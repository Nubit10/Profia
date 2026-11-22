import { describe, expect, it } from "vitest";
import {
  baseReferences,
  baseReferencesNoun,
  engineReference,
  evidencesTitle,
  referenceLabel,
} from "@/lib/curriculum-references";

// SPEC-0039: referentes base de un curso y cómo se nombran.
const ref = (code: string, type: "DBA" | "STANDARD" | "ORIENTATION") => ({ code, type });

describe("referentes del catálogo (SPEC-0039)", () => {
  it("CA-0039-06: con DBA, los referentes base son los DBA; sin DBA, Estándares u Orientaciones", () => {
    const withDba = [ref("MEN-DBA-MAT-V2-G6-01", "DBA"), ref("MEN-EBC-MAT-V1-G6A7-01", "STANDARD")];
    expect(baseReferences(withDba).map((r) => r.code)).toEqual(["MEN-DBA-MAT-V2-G6-01"]);
    expect(baseReferencesNoun(withDba)).toBe("DBA");
    const ethics = [ref("MEN-EBC-CIU-V1-G6A7-01", "STANDARD")];
    expect(baseReferences(ethics)).toEqual(ethics);
    expect(baseReferencesNoun(ethics)).toBe("Estándares");
    const tech = [ref("MEN-ORI-TEC-V1-G6A7-01", "ORIENTATION")];
    expect(baseReferencesNoun(tech)).toBe("Orientaciones del MEN");
    expect(baseReferences([])).toEqual([]);
  });

  it("CA-0039-07: la etiqueta sale del código, también en recursos viejos", () => {
    expect(referenceLabel("MEN-DBA-MAT-V2-G6-03", 3)).toBe("DBA 3");
    expect(referenceLabel("MEN-EBC-CIU-V1-G8A9-12", 12)).toBe("Estándar 12");
    expect(referenceLabel("MEN-EBC-ING2-V1-G6A7-01", 1)).toBe("Estándar 1");
    expect(referenceLabel("MEN-ORI-TEC-V1-G6A7-05", 5)).toBe("Orientación 5");
    expect(evidencesTitle({ code: "MEN-ORI-EFI-V1-G1A3-01", evidences: ["x"] })).toBe(
      "Competencia a la que apunta",
    );
    expect(
      evidencesTitle({ code: "MEN-EBC-ING1-V1-G1A3-01", evidences: ["Competencia lingüística"] }),
    ).toBe("Competencias que desarrolla");
  });

  it("CA-0039-08: solo un Estándar u Orientación lleva `kind` hacia el AI Engine", () => {
    const base = { statement: "Enunciado.", evidences: [] };
    expect(engineReference({ code: "MEN-DBA-MAT-V2-G6-01", ...base })).not.toHaveProperty("kind");
    expect(engineReference({ code: "MEN-EBC-CIU-V1-G6A7-01", ...base }).kind).toBe("STANDARD");
    expect(engineReference({ code: "MEN-ORI-ART-V1-G1A3-01", ...base }).kind).toBe("ORIENTATION");
  });
});
