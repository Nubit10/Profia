import { describe, expect, it } from "vitest";
import { figureSchema } from "@/lib/figures/schema";
import { drawFigure, figureDataUri, num } from "@/lib/figures/svg";

// SPEC-0023 CA-0023-05: cada figura se dibuja con lo esperado y escapa el texto.

describe("figuras dibujadas por código (SPEC-0023)", () => {
  it("CA-0023-05: recta numérica con marcas y puntos", () => {
    const d = drawFigure(
      figureSchema.parse({
        kind: "NUMBER_LINE",
        min: -5,
        max: 5,
        step: 1,
        marks: [{ value: -3, label: "A" }],
      }),
    );
    expect(d.svg.match(/<line /g)!.length).toBe(1 + 11);
    expect(d.svg).toContain("<circle");
    expect(d.svg).toContain(">−5<");
    expect(d.alt).toBe("Recta numérica de −5 a 5, de 1 en 1, con los puntos A en −3.");
  });

  it("CA-0023-05: barras, tabla, fracción y rectángulo", () => {
    const bars = drawFigure(
      figureSchema.parse({
        kind: "BAR_CHART",
        title: "Ventas",
        categories: ["Lunes", "Martes", "Miércoles"],
        values: [12, 8, 15],
        unit: "arepas",
      }),
    );
    expect(bars.svg.match(/<rect [^>]*fill="#9e9e9e"/g)).toHaveLength(3);
    expect(bars.alt).toContain("Lunes: 12; Martes: 8; Miércoles: 15");

    const table = drawFigure(
      figureSchema.parse({ kind: "TABLE", headers: ["Día", "Ventas"], rows: [["Lunes", "12"]] }),
    );
    expect(table.svg).toContain(">Día<");
    expect(table.alt).toBe("Tabla con las columnas Día, Ventas. Lunes, 12.");

    const circle = drawFigure(
      figureSchema.parse({ kind: "FRACTION", numerator: 3, denominator: 8, shape: "CIRCLE" }),
    );
    expect(circle.svg.match(/<path /g)).toHaveLength(8);
    expect(circle.svg.match(/fill="#9e9e9e"/g)).toHaveLength(3);
    expect(circle.alt).toBe("Círculo dividido en 8 partes iguales, con 3 sombreadas.");

    const rect = drawFigure(
      figureSchema.parse({ kind: "RECTANGLE", width: 12.5, height: 5, unit: "cm" }),
    );
    expect(rect.svg).toContain(">12,5 cm<");
    expect(num(-2.5)).toBe("−2,5");
  });

  it("CA-0023-05: el texto del modelo se escapa y la imagen va como data:", () => {
    const d = drawFigure(
      figureSchema.parse({
        kind: "TABLE",
        headers: ["<script>alert(1)</script>", "b"],
        rows: [['"x" & y', "z"]],
      }),
    );
    expect(d.svg).not.toContain("<script>");
    expect(d.svg).toContain("&lt;script&gt;");
    expect(d.svg).toContain("&quot;x&quot; &amp; y");
    expect(figureDataUri(d)).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  });

  it("valida al guardar: columnas, categorías y fracción", () => {
    expect(
      figureSchema.safeParse({ kind: "BAR_CHART", categories: ["a"], values: [1] }).success,
    ).toBe(false);
    expect(
      figureSchema.safeParse({ kind: "FRACTION", numerator: 1, denominator: 20 }).success,
    ).toBe(false);
  });
});
