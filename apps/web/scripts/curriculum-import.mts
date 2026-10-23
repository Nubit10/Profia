// Importa el catálogo curricular oficial desde curriculum/men/*.json (SPEC-0004, ADR-0005).
// Uso: npm run curriculum:import            (todos los archivos)
//      npm run curriculum:import -- <archivo> (uno)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");

const { importCurriculumJson, CurriculumImportError } =
  await import("@/modules/curriculum/importer");
const { db } = await import("@/lib/db");

const dir = path.join(process.cwd(), "curriculum", "men");
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => path.join(dir, f));

let failed = false;
for (const file of files) {
  const name = path.basename(file);
  try {
    const report = await importCurriculumJson(JSON.parse(readFileSync(file, "utf8")), name);
    const { created, updated, unchanged } = report.items;
    console.log(
      `${report.status.padEnd(9)} ${report.sourceKey}: ${created} nuevos, ${updated} actualizados, ${unchanged} sin cambios` +
        (report.superseded.length ? ` · reemplaza a ${report.superseded.join(", ")}` : ""),
    );
  } catch (error) {
    failed = true;
    console.error(error instanceof CurriculumImportError ? error.message : error);
  }
}
await db.$disconnect();
process.exit(failed ? 1 : 0);
