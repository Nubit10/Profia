import { db } from "@/lib/db";
import { resolveTenantContext, type TenantContext } from "@/modules/tenancy";

let counter = 0;

/** Borra todos los datos de la base de tests (las FK en cascada limpian el resto). */
export async function resetDatabase() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "users", "institutions", "audit_logs", "curriculum_items", "curriculum_sources" RESTART IDENTITY CASCADE',
  );
}

export async function createUser(name = "Docente") {
  counter += 1;
  return db.user.create({
    data: {
      name: `${name} ${counter}`,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}.${counter}.${Date.now()}@colegio.test`,
      passwordHash: "no-se-usa-en-estos-tests",
    },
    select: { id: true, name: true, email: true },
  });
}

/** Contexto de tenant como lo construiría el servidor para ese usuario y espacio. */
export async function ctxFor(
  user: { id: string; name: string; email: string },
  institutionId: string,
): Promise<TenantContext> {
  const ctx = await resolveTenantContext(user, institutionId);
  if (!ctx || ctx.institutionId !== institutionId) {
    throw new Error("El usuario no tiene membresía activa en ese espacio");
  }
  return ctx;
}

export const validSchool = {
  name: "Institución Educativa San José",
  sector: "OFICIAL" as const,
  daneCode: "105001000123",
  department: "Antioquia",
  municipality: "Medellín",
  calendar: "A" as const,
  alsoTeaches: false,
};
