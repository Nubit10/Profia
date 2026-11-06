import { describe, expect, it } from "vitest";
import { splitDbaByPeriod } from "@/modules/planning/distribution";

const codes = (n: number) => Array.from({ length: n }, (_, i) => `DBA-${i + 1}`);

describe("reparto de DBA entre periodos (SPEC-0014 RN-04, ADR-0013)", () => {
  it("12 DBA en 4 periodos: 3 por periodo, en orden", () => {
    const split = splitDbaByPeriod(codes(12), [1, 2, 3, 4]);
    expect([...split.values()].map((c) => c.length)).toEqual([3, 3, 3, 3]);
    expect(split.get(1)).toEqual(["DBA-1", "DBA-2", "DBA-3"]);
    expect(split.get(4)).toEqual(["DBA-10", "DBA-11", "DBA-12"]);
  });

  it("si no da exacto, los primeros periodos reciben uno más y no se pierde ninguno", () => {
    const split = splitDbaByPeriod(codes(10), [1, 2, 3]);
    expect([...split.values()].map((c) => c.length)).toEqual([4, 3, 3]);
    expect([...split.values()].flat()).toEqual(codes(10));
  });

  it("más periodos que DBA: algunos quedan sin DBA", () => {
    const split = splitDbaByPeriod(codes(2), [1, 2, 3]);
    expect([...split.values()]).toEqual([["DBA-1"], ["DBA-2"], []]);
  });
});
