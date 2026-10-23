import { z } from "zod";
import { ROLES } from "@/lib/permissions";

// Schemas compartidos entre formularios y servidor (SPEC-0002 §5). Sin dependencias de servidor.

export const SECTORS = ["OFICIAL", "PRIVADO"] as const;
export const SECTOR_LABELS: Record<(typeof SECTORS)[number], string> = {
  OFICIAL: "Oficial",
  PRIVADO: "Privado",
};
export const CALENDARS = ["A", "B"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

const place = (label: string) =>
  z.string().trim().min(2, `Ingresa el ${label}`).max(80, `El ${label} es demasiado largo`);

const schoolFields = z.object({
  name: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(150, "El nombre es demasiado largo"),
  sector: z.enum(SECTORS, "Elige el sector"),
  daneCode: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => v === "" || /^\d{12}$/.test(v), "El código DANE tiene 12 dígitos")
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  department: place("departamento"),
  municipality: place("municipio"),
  calendar: z.enum(CALENDARS).default("A"),
  nit: optionalText(20),
});

const requireDaneForOficial = <T extends { sector: string; daneCode?: string }>(data: T) =>
  data.sector !== "OFICIAL" || !!data.daneCode;
const daneIssue = {
  path: ["daneCode"],
  message: "El código DANE es obligatorio para colegios oficiales",
};

export const registerSchoolSchema = schoolFields
  .extend({ alsoTeaches: z.boolean().default(false) })
  .refine(requireDaneForOficial, daneIssue);

export const updateSchoolSchema = schoolFields.refine(requireDaneForOficial, daneIssue);

export const campusNameSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(80),
});
export const renameCampusSchema = campusNameSchema.extend({ campusId: z.string().min(1) });
export const campusArchiveSchema = z.object({
  campusId: z.string().min(1),
  archived: z.boolean(),
});

const rolesField = z.array(z.enum(ROLES)).min(1, "Elige al menos un rol");

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email("Ingresa un correo válido"))
    .transform((v) => v.toLowerCase()),
  roles: rolesField,
});

export const invitationIdSchema = z.object({ invitationId: z.string().min(1) });
export const invitationTokenSchema = z.object({ token: z.string().min(20).max(100) });

export const memberRolesSchema = z.object({ membershipId: z.string().min(1), roles: rolesField });
export const memberStatusSchema = z.object({
  membershipId: z.string().min(1),
  active: z.boolean(),
});

export type RegisterSchoolInput = z.input<typeof registerSchoolSchema>;
export type UpdateSchoolInput = z.input<typeof updateSchoolSchema>;
export type InvitationInput = z.input<typeof invitationSchema>;
