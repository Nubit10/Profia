import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createCourse, listSubjects } from "@/modules/courses";
import { importCurriculumJson } from "@/modules/curriculum";
import { exportResource } from "@/modules/documents";
import {
  analyzeFormatFile,
  deleteFormat,
  getLogoInfo,
  listFormats,
  saveFormat,
  saveLogo,
  setDefaultFormat,
} from "@/modules/formats";
import type { FormatStructure } from "@/modules/formats/client";
import {
  acceptInvitation,
  createIndependentSpace,
  createInvitation,
  registerSchool,
} from "@/modules/institutions";
import { createTopic, createUnit, getCoursePlanning } from "@/modules/planning";
import { createResource, getResource, getResourceFormContext } from "@/modules/resources";
import type { TenantContext } from "@/modules/tenancy";
import { guiaSanJose } from "../support/docx-formats";
import { createUser, ctxFor, resetDatabase, validSchool } from "../support/factories";

const MEN_DIR = path.resolve(__dirname, "../../curriculum/men");
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const META = {
  provider: "groq",
  model: "qwen/qwen3.8-27b",
  attempts: 1,
  latencyMs: 800,
  tokens: 600,
};

const STRUCTURE: FormatStructure = {
  header: [
    { label: "ÁREA", source: "SUBJECT" },
    { label: "DOCENTE", source: "TEACHER" },
    { label: "NOMBRE DEL ESTUDIANTE", source: "BLANK" },
    { label: "PERIODO", source: "PERIOD" },
  ],
  sections: [
    { title: "Saberes previos", kind: "ACTIVITIES", purpose: "Activar lo que ya saben", text: "" },
    { title: "Conceptualización", kind: "TEXT", purpose: "Explicar el concepto", text: "" },
    { title: "Práctica", kind: "ACTIVITIES", purpose: "Practicar", text: "" },
    {
      title: "Autoevaluación",
      kind: "FIXED",
      purpose: "",
      text: "Marca con X: participé en clase.",
    },
  ],
};

/** AI Engine simulado: análisis de formatos y taller con las secciones pedidas. */
function engine() {
  return vi.fn(async (url: URL | string, init?: RequestInit) => {
    const route = new URL(String(url)).pathname;
    const body = JSON.parse(String(init?.body));
    if (route === "/v1/formats/analyze") {
      return Response.json({
        header: body.headerLabels.map((label: string) => ({
          label,
          source: /docente/i.test(label) ? "TEACHER" : /área/i.test(label) ? "SUBJECT" : "BLANK",
        })),
        sections: body.sections.map((s: { title: string; hasBody: boolean }) => ({
          title: s.title,
          kind:
            /autoeval/i.test(s.title) && s.hasBody
              ? "FIXED"
              : /concept/i.test(s.title)
                ? "TEXT"
                : "ACTIVITIES",
          purpose: `Trabajar ${s.title.toLowerCase()} en clase`,
        })),
        meta: { ...META, promptVersion: "format_analysis.v1" },
      });
    }
    if (route === "/v1/generation/workshop") {
      const sections: { title: string; kind: string }[] = body.customSections;
      return Response.json({
        workshop: {
          title: "Taller con formato",
          purpose: "Comparar enteros.",
          studentInstructions: "Trabaja en parejas.",
          materials: [],
          moments: sections
            .filter((s) => s.kind === "ACTIVITIES")
            .map((s, i) => ({
              name: s.title,
              activities: [
                {
                  title: `Actividad de ${s.title}`,
                  instructions: "Dibuja una recta numérica y ubica los números dados.",
                  durationMinutes: 15,
                  expectedOutcome: "Recta con números.",
                  cognitiveLevel: i ? "APPLY" : "UNDERSTAND",
                  dbaCodes: [],
                },
              ],
            })),
          teacherGuidance: ["Revisa el cero."],
          sectionTexts: sections
            .filter((s) => s.kind === "TEXT")
            .map((s) => ({
              title: s.title,
              content: "Los enteros incluyen negativos, cero y positivos.",
            })),
        },
        meta: { ...META, promptVersion: "workshop.v2" },
      });
    }
    throw new Error(`ruta inesperada ${route}`);
  });
}

async function topicFor(ctx: TenantContext, group = "601") {
  const math = (await listSubjects(ctx)).find((s) => s.name === "Matemáticas")!;
  const course = await createCourse(ctx, {
    subjectId: math.id,
    grade: "G6",
    groupName: group,
    academicYear: "2026",
  });
  await getCoursePlanning(ctx, course.id);
  const unit = await createUnit(ctx, {
    courseId: course.id,
    periodNumber: 1,
    title: "Enteros",
    description: null,
  });
  return createTopic(ctx, {
    unitId: unit.id,
    title: "La recta numérica",
    description: null,
    plannedSessions: null,
  });
}

async function independentTeacher() {
  const user = await createUser("Profe");
  const { institutionId } = await createIndependentSpace(user);
  return ctxFor(user, institutionId);
}

async function school() {
  const admin = await createUser("Rector");
  const { institutionId } = await registerSchool(admin, { ...validSchool, alsoTeaches: false });
  const adminCtx = await ctxFor(admin, institutionId);
  const teacher = await createUser("Docente");
  const { token } = await createInvitation(adminCtx, { email: teacher.email, roles: ["TEACHER"] });
  await acceptInvitation(teacher, token);
  return { adminCtx, teacherCtx: await ctxFor(teacher, institutionId) };
}

async function generateWithFormat(
  ctx: TenantContext,
  topicId: string,
  formatId: string,
  fetcher = engine(),
) {
  const tasks: Promise<void>[] = [];
  const { id } = await createResource(
    ctx,
    {
      type: "WORKSHOP",
      topicId,
      objectiveIds: [],
      durationMinutes: 45,
      difficulty: "BASIC",
      itemCount: 2,
      structure: "CUSTOM",
      formatId,
      cognitiveDistribution: { UNDERSTAND: 50, APPLY: 50 },
      notes: null,
      excludedPreferenceIds: [],
    },
    { fetcher: fetcher as unknown as typeof fetch, schedule: (task) => void tasks.push(task()) },
  );
  await Promise.all(tasks);
  return { id, fetcher };
}

async function docxXml(body: Buffer) {
  const zip = await JSZip.loadAsync(body);
  return {
    xml: await zip.file("word/document.xml")!.async("string"),
    media: Object.keys(zip.files).filter((f) => /^word\/media\/.+\.\w+$/.test(f)),
  };
}

beforeEach(async () => {
  await resetDatabase();
  for (const file of readdirSync(MEN_DIR).filter((f) => f.endsWith(".json"))) {
    await importCurriculumJson(JSON.parse(readFileSync(path.join(MEN_DIR, file), "utf8")), file);
  }
});
afterAll(() => db.$disconnect());

describe("formato propio del docente (SPEC-0010)", () => {
  it("CA-0010-01/02: propone la estructura y a la IA solo le llegan etiquetas y títulos", async () => {
    const ctx = await independentTeacher();
    const fetcher = engine();
    const docx = await guiaSanJose(ctx.userName, ctx.institutionName.toUpperCase());
    const proposal = await analyzeFormatFile(
      ctx,
      docx,
      "Guia.docx",
      fetcher as unknown as typeof fetch,
    );

    expect(proposal.aiUsed).toBe(true);
    expect(proposal.name).toBe("GUÍA DE APRENDIZAJE N° 3");
    expect(proposal.structure.header.find((h) => h.label === "DOCENTE")?.source).toBe("TEACHER");
    expect(proposal.structure.sections.map((s) => s.kind)).toEqual([
      "ACTIVITIES",
      "TEXT",
      "ACTIVITIES",
      "FIXED",
    ]);
    expect(proposal.structure.sections[3]!.text).toContain("Participé en clase");

    const raw = String((fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1].body);
    for (const secret of [
      "Matemáticas",
      ctx.userName,
      ctx.institutionName,
      "Participé en clase",
      "6°",
      "II",
    ]) {
      expect(raw).not.toContain(secret);
    }
    expect(JSON.parse(raw)).toMatchObject({
      headerLabels: expect.arrayContaining(["DOCENTE", "ÁREA"]),
    });
    // Nada se guardó (RN-03).
    expect(await db.documentFormat.count()).toBe(0);
  });

  it("si la IA no está disponible queda la propuesta heurística con un aviso", async () => {
    const ctx = await independentTeacher();
    const down = vi.fn(async () => new Response(null, { status: 503 }));
    const proposal = await analyzeFormatFile(
      ctx,
      await guiaSanJose(),
      "g.docx",
      down as unknown as typeof fetch,
    );
    expect(proposal.aiUsed).toBe(false);
    expect(proposal.warnings.join(" ")).toContain("IA no estaba disponible");
    expect(proposal.structure.sections).toHaveLength(4);
  });

  it("CA-0010-03/04/05: el taller sigue el formato, se descarga con su encabezado y conserva su copia", async () => {
    const ctx = await independentTeacher();
    const topic = await topicFor(ctx);
    const format = await saveFormat(ctx, {
      name: "Guía San José",
      scope: "TEACHER",
      structure: STRUCTURE,
    });
    const { id, fetcher } = await generateWithFormat(ctx, topic.id, format.id);

    // RN-02: las secciones fijas no viajan a la IA.
    const body = JSON.parse(
      String((fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1].body),
    );
    expect(body.structure).toBe("CUSTOM");
    expect(body.customSections.map((s: { title: string }) => s.title)).toEqual([
      "Saberes previos",
      "Conceptualización",
      "Práctica",
    ]);
    expect(JSON.stringify(body)).not.toContain("Marca con X");

    const resource = await getResource(ctx, id);
    expect(resource.status).toBe("DRAFT");
    expect(resource.format?.name).toBe("Guía San José");

    const before = await docxXml(
      (await exportResource(ctx, id, { doc: "student", format: "docx", variant: "A" })).body,
    );
    const order = [
      "ÁREA",
      "DOCENTE",
      "NOMBRE DEL ESTUDIANTE",
      "PERIODO",
      "Saberes previos",
      "Conceptualización",
      "Práctica",
      "Autoevaluación",
    ];
    const positions = order.map((t) => before.xml.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const text of [
      "Matemáticas",
      ctx.userName,
      "Periodo 1",
      "Los enteros incluyen negativos",
      "Marca con X: participé en clase.",
    ]) {
      expect(before.xml).toContain(text);
    }

    // CA-0010-05: borrar el formato no cambia el taller ni sus descargas.
    await deleteFormat(ctx, format.id);
    expect((await getResource(ctx, id)).format?.name).toBe("Guía San José");
    const after = await docxXml(
      (await exportResource(ctx, id, { doc: "student", format: "docx", variant: "A" })).body,
    );
    expect(after.xml.replace(/\d+ de \w+ de \d{4}/g, "")).toBe(
      before.xml.replace(/\d+ de \w+ de \d{4}/g, ""),
    );
  });

  it("CA-0010-08: el predeterminado del docente gana sobre el del colegio", async () => {
    const { adminCtx, teacherCtx } = await school();
    const topic = await topicFor(teacherCtx);
    const institutional = await saveFormat(adminCtx, {
      name: "Formato institucional",
      scope: "INSTITUTION",
      structure: STRUCTURE,
    });
    await setDefaultFormat(adminCtx, institutional.id, true);
    expect((await getResourceFormContext(teacherCtx, topic.id)).defaultFormatId).toBe(
      institutional.id,
    );

    const mine = await saveFormat(teacherCtx, {
      name: "Mi formato",
      scope: "TEACHER",
      structure: STRUCTURE,
    });
    await setDefaultFormat(teacherCtx, mine.id, true);
    const form = await getResourceFormContext(teacherCtx, topic.id);
    expect(form.defaultFormatId).toBe(mine.id);
    expect(form.formats.map((f) => f.name).sort()).toEqual(["Formato institucional", "Mi formato"]);
  });

  it("CA-0010-07/09: el institucional lo usan los docentes del colegio sin editarlo; nadie más lo ve", async () => {
    const { adminCtx, teacherCtx } = await school();
    const institutional = await saveFormat(adminCtx, {
      name: "Formato del colegio",
      scope: "INSTITUTION",
      structure: STRUCTURE,
    });

    const seen = await listFormats(teacherCtx);
    expect(seen).toEqual([
      expect.objectContaining({ id: institutional.id, canEdit: false, scope: "INSTITUTION" }),
    ]);
    const topic = await topicFor(teacherCtx);
    const { id } = await generateWithFormat(teacherCtx, topic.id, institutional.id);
    expect((await getResource(teacherCtx, id)).status).toBe("DRAFT");

    await expect(deleteFormat(teacherCtx, institutional.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      saveFormat(teacherCtx, {
        id: institutional.id,
        name: "Cambiado",
        scope: "INSTITUTION",
        structure: STRUCTURE,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Otro espacio no lo ve ni lo puede usar.
    const outsider = await independentTeacher();
    expect(await listFormats(outsider)).toEqual([]);
    const otherTopic = await topicFor(outsider);
    await expect(
      generateWithFormat(outsider, otherTopic.id, institutional.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Un docente independiente no puede crear formatos institucionales.
    await expect(
      saveFormat(outsider, { name: "Formato externo", scope: "INSTITUTION", structure: STRUCTURE }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // El formato personal de un docente no lo ve otro.
    const personal = await saveFormat(teacherCtx, {
      name: "Personal",
      scope: "TEACHER",
      structure: STRUCTURE,
    });
    expect((await listFormats(adminCtx)).map((f) => f.id)).not.toContain(personal.id);
  });

  it("CA-0010-10: el logo sale en todos los documentos y solo lo sube un administrador", async () => {
    const { adminCtx, teacherCtx } = await school();
    await expect(saveLogo(teacherCtx, PNG_1X1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveLogo(adminCtx, Buffer.from("<svg onload='x'/>"))).rejects.toMatchObject({
      code: "INVALID",
    });
    await expect(saveLogo(adminCtx, Buffer.from("GIF89a....."))).rejects.toMatchObject({
      code: "INVALID",
    });
    expect(await saveLogo(adminCtx, PNG_1X1)).toEqual({
      mimeType: "image/png",
      width: 1,
      height: 1,
    });
    expect(await getLogoInfo(teacherCtx)).toMatchObject({ mimeType: "image/png" });

    const topic = await topicFor(teacherCtx);
    const format = await saveFormat(teacherCtx, {
      name: "Mío",
      scope: "TEACHER",
      structure: STRUCTURE,
    });
    const { id } = await generateWithFormat(teacherCtx, topic.id, format.id);
    const docx = await docxXml(
      (await exportResource(teacherCtx, id, { doc: "key", format: "docx", variant: "A" })).body,
    );
    expect(docx.media.length).toBe(1);
    const pdf = (
      await exportResource(teacherCtx, id, { doc: "student", format: "pdf", variant: "A" })
    ).body;
    expect(pdf.toString("latin1")).toMatch(/\/Subtype \/Image/);
  });
});
