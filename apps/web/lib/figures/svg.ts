import type { Figure } from "./schema";

// SPEC-0023 RN-05 / ADR-0018: dibuja una figura como SVG con una función pura. Todo el texto se
// escapa: el SVG se muestra como imagen (`img` con `data:`), en el PDF como vector y en el Word como
// PNG. Blanco y negro, para imprimir en fotocopia.

export type FigureDrawing = { svg: string; width: number; height: number; alt: string };

const FONT = "Roboto, Arial, sans-serif";
const INK = "#111111";
const SOFT = "#d9d9d9";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Número como en Colombia: coma decimal y signo menos tipográfico. */
export function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded).replace("-", "−").replace(".", ",");
}

const text = (x: number, y: number, value: string, size = 13, anchor = "middle", bold = false) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" text-anchor="${anchor}"${
    bold ? ' font-weight="bold"' : ""
  } fill="${INK}">${escapeXml(value)}</text>`;

const wrap = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>${body}</svg>`;

function numberLine(f: Extract<Figure, { kind: "NUMBER_LINE" }>): FigureDrawing {
  const width = 520;
  const height = 110;
  const left = 30;
  const right = width - 30;
  const y = 60;
  const ticks = Math.min(40, Math.round((f.max - f.min) / f.step));
  const x = (v: number) => left + ((v - f.min) / (f.max - f.min)) * (right - left);
  let body = `<line x1="${left - 12}" y1="${y}" x2="${right + 12}" y2="${y}" stroke="${INK}" stroke-width="2"/>`;
  body += `<path d="M${right + 12} ${y} l-8 -5 v10 z M${left - 12} ${y} l8 -5 v10 z" fill="${INK}"/>`;
  for (let i = 0; i <= ticks; i++) {
    const value = f.min + i * f.step;
    const px = x(value);
    body += `<line x1="${px}" y1="${y - 7}" x2="${px}" y2="${y + 7}" stroke="${INK}" stroke-width="1.5"/>`;
    if (ticks <= 20 || i % 2 === 0) body += text(px, y + 26, num(value), 12);
  }
  for (const mark of f.marks) {
    const px = x(mark.value);
    body += `<circle cx="${px}" cy="${y}" r="5" fill="${INK}"/>`;
    if (mark.label) body += text(px, y - 16, mark.label, 14, "middle", true);
  }
  const marks = f.marks.map((m) => (m.label ? `${m.label} en ${num(m.value)}` : num(m.value)));
  const alt =
    `Recta numérica de ${num(f.min)} a ${num(f.max)}, de ${num(f.step)} en ${num(f.step)}` +
    (marks.length ? `, con los puntos ${marks.join(", ")}.` : ".");
  return { svg: wrap(width, height, body), width, height, alt };
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return Math.max(1, nice * power);
}

function barChart(f: Extract<Figure, { kind: "BAR_CHART" }>): FigureDrawing {
  const width = 520;
  const height = 300;
  const top = f.title ? 44 : 20;
  const bottom = height - 50;
  const left = 56;
  const right = width - 20;
  // Eje con pasos redondos (1, 2, 5 × 10ⁿ): nada de 11,25 en la escala.
  const step = niceStep(Math.max(1, ...f.values) / 4);
  const ticks = Math.max(1, Math.ceil(Math.max(1, ...f.values) / step));
  const maxValue = step * ticks;
  const slot = (right - left) / f.categories.length;
  let body = f.title ? text(width / 2, 24, f.title, 14, "middle", true) : "";
  body += `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${INK}"/>`;
  body += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${INK}"/>`;
  for (let i = 0; i <= ticks; i++) {
    const value = step * i;
    const py = bottom - ((bottom - top) * i) / ticks;
    body += `<line x1="${left}" y1="${py}" x2="${right}" y2="${py}" stroke="${SOFT}"/>`;
    body += text(left - 6, py + 4, num(value), 11, "end");
  }
  f.categories.forEach((category, i) => {
    const value = f.values[i] ?? 0;
    const barHeight = ((bottom - top) * value) / maxValue;
    const bx = left + i * slot + slot * 0.2;
    body += `<rect x="${bx}" y="${bottom - barHeight}" width="${slot * 0.6}" height="${barHeight}" fill="#9e9e9e" stroke="${INK}"/>`;
    body += text(bx + slot * 0.3, bottom - barHeight - 6, num(value), 12, "middle", true);
    body += text(bx + slot * 0.3, bottom + 18, category, 12);
  });
  if (f.unit) body += text(left, top - 8, f.unit, 11, "start");
  const pairs = f.categories.map((c, i) => `${c}: ${num(f.values[i] ?? 0)}`).join("; ");
  const alt = `Gráfica de barras${f.title ? ` «${f.title}»` : ""}${f.unit ? ` en ${f.unit}` : ""}. ${pairs}.`;
  return { svg: wrap(width, height, body), width, height, alt };
}

function table(f: Extract<Figure, { kind: "TABLE" }>): FigureDrawing {
  const colWidth = Math.min(160, Math.floor(520 / f.headers.length));
  const rowHeight = 30;
  const width = colWidth * f.headers.length + 2;
  const height = rowHeight * (f.rows.length + 1) + 2;
  let body = `<rect x="1" y="1" width="${width - 2}" height="${rowHeight}" fill="#eeeeee"/>`;
  const rows = [f.headers, ...f.rows];
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      body += text(
        1 + c * colWidth + colWidth / 2,
        1 + r * rowHeight + 20,
        cell,
        13,
        "middle",
        r === 0,
      );
    });
  });
  for (let r = 0; r <= rows.length; r++) {
    const py = 1 + r * rowHeight;
    body += `<line x1="1" y1="${py}" x2="${width - 1}" y2="${py}" stroke="${INK}"/>`;
  }
  for (let c = 0; c <= f.headers.length; c++) {
    const px = 1 + c * colWidth;
    body += `<line x1="${px}" y1="1" x2="${px}" y2="${height - 1}" stroke="${INK}"/>`;
  }
  const alt =
    `Tabla con las columnas ${f.headers.join(", ")}. ` +
    f.rows.map((row) => row.join(", ")).join("; ") +
    ".";
  return { svg: wrap(width, height, body), width, height, alt };
}

function fraction(f: Extract<Figure, { kind: "FRACTION" }>): FigureDrawing {
  const parts = f.denominator;
  const filled = Math.min(f.numerator, parts);
  let body = "";
  let width: number;
  let height: number;
  if (f.shape === "CIRCLE") {
    width = 200;
    height = 200;
    const cx = 100;
    const cy = 100;
    const r = 85;
    for (let i = 0; i < parts; i++) {
      const a0 = (2 * Math.PI * i) / parts - Math.PI / 2;
      const a1 = (2 * Math.PI * (i + 1)) / parts - Math.PI / 2;
      const p0 = `${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}`;
      const p1 = `${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
      const large = 1 / parts > 0.5 ? 1 : 0;
      body += `<path d="M${cx} ${cy} L${p0} A${r} ${r} 0 ${large} 1 ${p1} Z" fill="${i < filled ? "#9e9e9e" : "#ffffff"}" stroke="${INK}" stroke-width="2"/>`;
    }
  } else {
    width = 480;
    height = 90;
    const part = 440 / parts;
    for (let i = 0; i < parts; i++) {
      body += `<rect x="${20 + i * part}" y="20" width="${part}" height="50" fill="${i < filled ? "#9e9e9e" : "#ffffff"}" stroke="${INK}" stroke-width="2"/>`;
    }
  }
  const shape = f.shape === "CIRCLE" ? "Círculo" : "Barra";
  const alt = `${shape} dividido en ${parts} partes iguales, con ${filled} sombreadas.`;
  return { svg: wrap(width, height, body), width, height, alt };
}

function rectangle(f: Extract<Figure, { kind: "RECTANGLE" }>): FigureDrawing {
  const maxW = 380;
  const maxH = 200;
  const scale = Math.min(maxW / f.width, maxH / f.height);
  const w = Math.max(30, f.width * scale);
  const h = Math.max(30, f.height * scale);
  const width = Math.round(w + 120);
  const height = Math.round(h + 70);
  const x = 60;
  const y = 30;
  const unit = f.unit ? ` ${f.unit}` : "";
  let body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="${INK}" stroke-width="2"/>`;
  body += text(x + w / 2, y + h + 24, `${num(f.width)}${unit}`, 13);
  body += text(x - 10, y + h / 2 + 4, `${num(f.height)}${unit}`, 13, "end");
  const alt = `Rectángulo de ${num(f.width)}${unit} de base y ${num(f.height)}${unit} de altura.`;
  return { svg: wrap(width, height, body), width, height, alt };
}

export function drawFigure(figure: Figure): FigureDrawing {
  switch (figure.kind) {
    case "NUMBER_LINE":
      return numberLine(figure);
    case "BAR_CHART":
      return barChart(figure);
    case "TABLE":
      return table(figure);
    case "FRACTION":
      return fraction(figure);
    case "RECTANGLE":
      return rectangle(figure);
  }
}

/** Para el editor: el SVG como imagen (`img`), nunca como HTML inyectado. */
export function figureDataUri(drawing: FigureDrawing): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawing.svg)}`;
}
