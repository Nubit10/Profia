import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "@/instrumentation";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

// register() importa el módulo de entorno de forma dinámica; con la suite completa en un equipo
// lento, esa primera importación puede pasar de los 5 s por defecto.
describe("instrumentation.register", { timeout: 20_000 }, () => {
  it("CA-0001-06: termina el proceso con código 1 y nombra la variable que falta", async () => {
    process.env = {
      ...original,
      NEXT_RUNTIME: "nodejs",
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      AUTH_SECRET: "",
    };
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await register();

    expect(exit).toHaveBeenCalledWith(1);
    expect(log.mock.calls.flat().join("\n")).toContain("AUTH_SECRET: falta");
  });

  it("no hace nada si el entorno es válido", async () => {
    process.env = {
      ...original,
      NEXT_RUNTIME: "nodejs",
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      AUTH_SECRET: "x".repeat(32),
    };
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    await register();

    expect(exit).not.toHaveBeenCalled();
  });
});
