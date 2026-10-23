import {
  Document,
  Header,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";

// Formatos de ejemplo con la estructura típica de las guías colombianas (SPEC-0010), mientras
// llegan formatos reales de los colegios piloto.

const cell = (text: string) => new TableCell({ children: [new Paragraph(text)] });
const row = (...texts: string[]) => new TableRow({ children: texts.map(cell) });
const bold = (text: string) => new Paragraph({ children: [new TextRun({ text, bold: true })] });

/** Formato típico de guía: encabezado de página, tabla de campos y secciones numeradas. */
export async function guiaSanJose(
  teacher = "Ana Pérez",
  school = "INSTITUCIÓN EDUCATIVA SAN JOSÉ",
) {
  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph(school),
              new Paragraph("Aprobada por Resolución 1234 de 2010"),
            ],
          }),
        },
        children: [
          new Table({
            rows: [
              row("ÁREA: Matemáticas", "GRADO: 6°"),
              row(`DOCENTE: ${teacher}`, "PERIODO: II"),
              row("NOMBRE DEL ESTUDIANTE:", ""),
              row("FECHA: ________", "GUÍA N°: 3"),
            ],
          }),
          bold("GUÍA DE APRENDIZAJE N° 3"),
          bold("1. SABERES PREVIOS"),
          new Paragraph("Responde: ¿qué sabes de los números negativos?"),
          bold("2. CONCEPTUALIZACIÓN"),
          new Paragraph("Los números enteros incluyen los negativos, el cero y los positivos."),
          bold("3. ACTIVIDADES DE PRÁCTICA"),
          new Paragraph("Resuelve los ejercicios."),
          bold("Ejercicios de refuerzo"),
          new Paragraph("Más ejercicios."),
          bold("4. AUTOEVALUACIÓN"),
          new Table({
            rows: [row("Criterio", "Sí", "No"), row("Participé en clase", "", "")],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** Otro estilo: títulos con estilo de título, tabla etiqueta | valor sin dos puntos. */
export async function tallerConEstilos() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Table({
            rows: [
              row("Asignatura", "Lenguaje"),
              row("Profesor", "Juan Gómez"),
              row("Grado", "5°"),
            ],
          }),
          new Paragraph("Nombre: ________________  Curso: ______  Fecha: ______"),
          new Paragraph({ text: "Exploración", heading: HeadingLevel.HEADING_1 }),
          new Paragraph("Lee el cuento."),
          new Paragraph({ text: "Aplicación", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "Rúbrica de evaluación", heading: HeadingLevel.HEADING_1 }),
          new Paragraph("Excelente: 5. Bueno: 4. Aceptable: 3."),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
