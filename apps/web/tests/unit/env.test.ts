import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "@/lib/env-schema";

const valid = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  it("acepta un entorno completo", () => {
    expect(parseEnv(valid)).toMatchObject({ DATABASE_URL: valid.DATABASE_URL });
  });

  it.each(["DATABASE_URL", "AUTH_SECRET"])("CA-0001-06: falla nombrando %s cuando falta", (key) => {
    const source = { ...valid, [key]: undefined };
    expect(() => parseEnv(source)).toThrowError(EnvValidationError);
    expect(() => parseEnv(source)).toThrowError(new RegExp(`${key}: falta`));
  });

  it("CA-0001-06: trata la cadena vacía como variable faltante", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "" })).toThrowError(/AUTH_SECRET: falta/);
  });

  it("RN-03: el mensaje de error nunca incluye el valor de la variable", () => {
    const secret = "too-short-secret";
    const url = "mysql://root:supersecreto@host/db";
    try {
      parseEnv({ DATABASE_URL: url, AUTH_SECRET: secret });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(secret);
      expect(message).not.toContain("supersecreto");
      expect(message).toContain("AUTH_SECRET");
      expect(message).toContain("DATABASE_URL");
    }
  });
});
