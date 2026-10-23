// Crea (o restablece) el usuario de prueba para desarrollo local. Nunca se ejecuta en producción.
// Uso: npm run db:seed
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import argon2 from "argon2";
import pg from "pg";

if (existsSync(".env")) process.loadEnvFile(".env");

if (process.env.NODE_ENV === "production") {
  console.error("seed-dev: no se ejecuta con NODE_ENV=production.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("seed-dev: falta DATABASE_URL (ver .env.example).");
  process.exit(1);
}

const DEV_USER = {
  name: "Docente de Prueba",
  email: "docente@profe.test",
  password: "Profe2026!",
};

// Mismos parámetros que modules/auth/password.ts (RN-04).
const passwordHash = await argon2.hash(DEV_USER.password, {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `INSERT INTO users (id, name, email, "passwordHash", "updatedAt")
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, "passwordHash" = EXCLUDED."passwordHash", "updatedAt" = now()`,
    [randomUUID(), DEV_USER.name, DEV_USER.email, passwordHash],
  );
  console.log(`seed-dev: usuario listo → ${DEV_USER.email} / ${DEV_USER.password}`);
} finally {
  await client.end();
}
