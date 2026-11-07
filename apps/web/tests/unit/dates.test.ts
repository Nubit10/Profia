import { describe, expect, it } from "vitest";
import { formatDateTime, formatDayMonth } from "@/lib/dates";

// La lista de recursos se renderiza en el servidor y en el navegador: si el texto difiere, React
// rompe la hidratación y en desarrollo muestra la página de error al tener talleres o quices.
describe("fechas que se muestran en componentes del cliente", () => {
  it("usan solo espacios normales, sin los espacios duros que varían entre Node y el navegador", () => {
    const text = formatDateTime(new Date("2026-11-05T03:53:00Z"));
    expect(text).not.toMatch(/[  ]/);
    expect(text).toMatch(/^4 de nov.*10:53/);
  });

  it("usan la hora de Colombia, sin importar la zona del equipo", () => {
    expect(formatDayMonth("2026-11-05T03:00:00Z")).toBe("4 de noviembre");
    expect(formatDateTime("2026-11-05T03:53:00.000Z")).toBe(
      formatDateTime(new Date("2026-11-05T03:53:00Z")),
    );
  });
});
