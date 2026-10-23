import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, safeCallbackUrl } from "@/modules/auth/client";

const validRegistration = {
  name: "Ana Pérez",
  email: "ana@colegio.edu.co",
  password: "contraseña-segura",
  confirmPassword: "contraseña-segura",
};

describe("registerSchema", () => {
  it("RN-07: normaliza el correo (minúsculas, sin espacios)", () => {
    const parsed = registerSchema.parse({ ...validRegistration, email: "  Ana@Colegio.EDU.co " });
    expect(parsed.email).toBe("ana@colegio.edu.co");
  });

  it("RN-04: exige contraseña de al menos 8 caracteres", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza contraseñas que no coinciden, marcando confirmPassword", () => {
    const result = registerSchema.safeParse({ ...validRegistration, confirmPassword: "otra-cosa" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("rechaza correos inválidos y nombres demasiado cortos", () => {
    expect(registerSchema.safeParse({ ...validRegistration, email: "no-es-correo" }).success).toBe(
      false,
    );
    expect(registerSchema.safeParse({ ...validRegistration, name: "A" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normaliza el correo y exige contraseña", () => {
    expect(loginSchema.parse({ email: " X@Y.co", password: "p" }).email).toBe("x@y.co");
    expect(loginSchema.safeParse({ email: "x@y.co", password: "" }).success).toBe(false);
  });
});

describe("safeCallbackUrl", () => {
  it.each([
    ["/dashboard/grupos", "/dashboard/grupos"],
    ["/dashboard?tab=1", "/dashboard?tab=1"],
  ])("acepta rutas internas: %s", (input, expected) => {
    expect(safeCallbackUrl(input)).toBe(expected);
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", undefined, ""])(
    "evita open redirects: %s → /dashboard",
    (input) => {
      expect(safeCallbackUrl(input)).toBe("/dashboard");
    },
  );
});
