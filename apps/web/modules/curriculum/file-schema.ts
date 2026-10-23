import { z } from "zod";
import { CURRICULUM_AREA_IDS } from "@/lib/curriculum-areas";

// Schema de los archivos curriculum/men/*.json (ADR-0005). Un archivo inválido no se importa.

const GRADE_VALUES = [
  "JARDIN",
  "TRANSICION",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "G10",
  "G11",
] as const;

const text = z.string().trim().min(3);

const itemSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9-]+$/, "código con mayúsculas, números y guiones"),
    type: z.enum(["DBA", "STANDARD"]),
    area: z.enum(CURRICULUM_AREA_IDS),
    grade: z.enum(GRADE_VALUES).optional(),
    gradeFrom: z.enum(GRADE_VALUES).optional(),
    gradeTo: z.enum(GRADE_VALUES).optional(),
    number: z.number().int().positive(),
    component: z.string().trim().min(1).nullable().optional(),
    statement: text,
    evidences: z.array(text).min(1),
    page: z.number().int().positive(),
  })
  .refine((i) => (i.type === "DBA" ? !!i.grade : !!i.gradeFrom && !!i.gradeTo), {
    message: "Un DBA lleva `grade`; un estándar lleva `gradeFrom` y `gradeTo`",
  });

export const curriculumFileSchema = z
  .object({
    source: z.object({
      key: z.string().regex(/^[A-Z0-9-]+-V\d+$/, "la clave termina en la versión, p. ej. -V2"),
      issuer: text,
      title: text,
      documentType: z.enum(["DBA", "STANDARD"]),
      area: z.enum(CURRICULUM_AREA_IDS),
      version: z.string().trim().min(1),
      year: z.number().int().min(1990).max(2100),
      isbn: z.string().optional(),
      url: z.url(),
      landingUrl: z.url().optional(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      usageNote: text,
    }),
    review: z.object({
      status: z.enum(["PENDING", "APPROVED"]),
      reviewedBy: z.string().nullable(),
      reviewedAt: z.string().nullable(),
    }),
    items: z.array(itemSchema).min(1),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.items.forEach((item, index) => {
      if (seen.has(item.code)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "code"],
          message: `código repetido ${item.code}`,
        });
      }
      seen.add(item.code);
      if (!item.code.startsWith(file.source.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "code"],
          message: `${item.code} no empieza con la clave de la fuente ${file.source.key}`,
        });
      }
    });
    if (file.review.status === "APPROVED" && (!file.review.reviewedBy || !file.review.reviewedAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["review"],
        message: "una fuente aprobada indica quién y cuándo la revisó",
      });
    }
  });

export type CurriculumFile = z.output<typeof curriculumFileSchema>;

/** "MEN-DBA-MAT-V2" → "MEN-DBA-MAT": agrupa las versiones de un mismo documento (RN-02). */
export const documentKeyOf = (sourceKey: string) => sourceKey.replace(/-V\d+$/, "");
