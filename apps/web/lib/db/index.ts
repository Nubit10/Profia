import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@/lib/env";
import { PrismaClient, type Prisma } from "./generated/client";

export type { User, UserSession } from "./generated/client";
export { Prisma } from "./generated/client";

// Una sola instancia por proceso; en desarrollo sobrevive al hot reload.
// Se guarda junto con la clase que la creó: si `prisma generate` regenera el cliente (p. ej. tras
// una migración), la clase cambia y se crea una instancia nueva. Sin esto, el servidor de desarrollo
// seguía usando el cliente viejo y fallaba con "Unknown field" en columnas nuevas.
const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClass?: typeof PrismaClient;
};

function createClient() {
  const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
  return new PrismaClient({ adapter });
}

function sharedClient(): PrismaClient {
  if (globalForDb.prisma && globalForDb.prismaClass === PrismaClient) return globalForDb.prisma;
  void globalForDb.prisma?.$disconnect();
  const client = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForDb.prisma = client;
    globalForDb.prismaClass = PrismaClient;
  }
  return client;
}

export const db = sharedClient();

/** Cliente normal o de transacción: las funciones que escriben reciben uno u otro. */
export type DbClient = typeof db | Prisma.TransactionClient;

/** Código de Prisma para violación de restricción única. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002"
  );
}
