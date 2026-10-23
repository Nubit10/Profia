import { describe, expect, it } from "vitest";
import { checkHealth } from "@/lib/observability/health";

describe("checkHealth", () => {
  it("CA-0001-01: responde 200 cuando la base responde", async () => {
    await expect(checkHealth(async () => 1)).resolves.toEqual({
      httpStatus: 200,
      body: { status: "ok", db: "ok" },
    });
  });

  it("CA-0001-07: responde 503 cuando la base no está disponible", async () => {
    const report = await checkHealth(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    expect(report).toEqual({ httpStatus: 503, body: { status: "degraded", db: "error" } });
    expect(JSON.stringify(report)).not.toContain("ECONNREFUSED");
  });
});
