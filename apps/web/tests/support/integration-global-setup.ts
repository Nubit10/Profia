import { execSync } from "node:child_process";
import { resolveTestDatabaseUrl } from "./test-database";

// Aplica las migraciones a la base de tests antes de correr la suite de integración.
export default function setup() {
  const url = resolveTestDatabaseUrl();
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
