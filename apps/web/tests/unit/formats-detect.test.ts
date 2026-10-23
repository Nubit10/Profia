import { Document, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { detectStructure, heuristicStructure } from "@/modules/formats/detect";
import { extractBlocks } from "@/modules/formats/extract";
import { guiaSanJose, tallerConEstilos } from "../support/docx-formats";

describe("detección del formato (SPEC-0010)", () => {
  it("CA-0010-01: encabezado de página, campos en tabla y secciones numeradas", async () => {
    const detection = detectStructure(await extractBlocks(await guiaSanJose()));
    expect(detection.fields.map((f) => f.label)).toEqual([
      "ÁREA",
      "GRADO",
      "DOCENTE",
      "PERIODO",
      "NOMBRE DEL ESTUDIANTE",
      "FECHA",
      "GUÍA N°",
    ]);
    expect(detection.sections.map((s) => s.title)).toEqual([
      "SABERES PREVIOS",
      "CONCEPTUALIZACIÓN",
      "ACTIVIDADES DE PRÁCTICA",
      "AUTOEVALUACIÓN",
    ]);
    // El subtítulo sin número queda dentro de su sección; el nombre de la guía, como título.
    expect(detection.sections[2]!.body).toContain("Ejercicios de refuerzo");
    expect(detection.titleLines).toContain("INSTITUCIÓN EDUCATIVA SAN JOSÉ");
    expect(detection.titleLines).toContain("GUÍA DE APRENDIZAJE N° 3");
    expect(detection.sections[3]!.body).toContain("Participé en clase");

    const structure = heuristicStructure(detection);
    expect(structure.header.map((h) => h.source)).toEqual([
      "SUBJECT",
      "GRADE",
      "TEACHER",
      "PERIOD",
      "BLANK",
      "BLANK",
      "BLANK",
    ]);
    expect(structure.sections.map((s) => s.kind)).toEqual([
      "ACTIVITIES",
      "TEXT",
      "ACTIVITIES",
      "FIXED",
    ]);
    // Solo la sección fija conserva su texto; el resto lo generará la IA.
    expect(structure.sections[1]!.text).toBe("");
    expect(structure.sections[3]!.text).toContain("Participé en clase");
  });

  it("tabla etiqueta | valor, campos en un párrafo y títulos con estilo", async () => {
    const detection = detectStructure(await extractBlocks(await tallerConEstilos()));
    expect(detection.fields.map((f) => f.label)).toEqual([
      "Asignatura",
      "Profesor",
      "Grado",
      "Nombre",
      "Curso",
      "Fecha",
    ]);
    expect(detection.sections.map((s) => s.title)).toEqual([
      "Exploración",
      "Aplicación",
      "Rúbrica de evaluación",
    ]);
    const structure = heuristicStructure(detection);
    expect(structure.header.map((h) => h.source)).toEqual([
      "SUBJECT",
      "TEACHER",
      "GRADE",
      "BLANK",
      "GRADE_GROUP",
      "BLANK",
    ]);
    expect(structure.sections.map((s) => s.kind)).toEqual(["ACTIVITIES", "ACTIVITIES", "FIXED"]);
  });

  it("un documento sin títulos propone una sección de actividades y avisa", async () => {
    const buffer = await Packer.toBuffer(
      new Document({ sections: [{ children: [new Paragraph("Solo un párrafo de texto.")] }] }),
    );
    const detection = detectStructure(await extractBlocks(buffer));
    expect(detection.warnings[0]).toContain("No encontramos títulos");
    expect(heuristicStructure(detection).sections).toEqual([
      { title: "Actividades", kind: "ACTIVITIES", purpose: "", text: "" },
    ]);
  });
});

describe("archivos no permitidos (RN-07)", () => {
  it("CA-0010-06: rechaza lo que no es DOCX, los documentos con macros y las entidades XML", async () => {
    await expect(extractBlocks(Buffer.from("%PDF-1.7 no soy un Word"))).rejects.toMatchObject({
      code: "INVALID",
    });

    const zip = await JSZip.loadAsync(await guiaSanJose());
    zip.file("word/vbaProject.bin", "macro");
    const withMacros = await zip.generateAsync({ type: "nodebuffer" });
    await expect(extractBlocks(withMacros)).rejects.toMatchObject({
      message: expect.stringContaining("macros"),
    });

    const evil = await JSZip.loadAsync(await guiaSanJose());
    evil.file(
      "word/document.xml",
      '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><w:document><w:body/></w:document>',
    );
    await expect(
      extractBlocks(await evil.generateAsync({ type: "nodebuffer" })),
    ).rejects.toMatchObject({ code: "INVALID" });

    await expect(extractBlocks(Buffer.alloc(6 * 1024 * 1024, 1))).rejects.toMatchObject({
      message: expect.stringContaining("5 MB"),
    });
  });
});
