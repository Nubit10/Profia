import { describe, expect, it } from "vitest";
import { redact } from "@/lib/observability/logger";

describe("redact", () => {
  it("RN-05: oculta contraseñas, tokens, cookies y secretos, incluso anidados", () => {
    const output = redact({
      userId: "u1",
      password: "p",
      passwordHash: "h",
      nested: { sessionToken: "t", cookie: "c", authorization: "Bearer x", ok: 1 },
      list: [{ AUTH_SECRET: "s" }],
    });
    const text = JSON.stringify(output);
    for (const leaked of ['"p"', '"h"', '"t"', '"c"', "Bearer x", '"s"']) {
      expect(text).not.toContain(leaked);
    }
    expect(output).toMatchObject({ userId: "u1", nested: { ok: 1 } });
  });

  it("serializa errores sin stack trace", () => {
    expect(redact({ error: new Error("boom") })).toEqual({
      error: { name: "Error", message: "boom" },
    });
  });
});
