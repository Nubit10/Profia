// SPEC-0021 RN-13 (ADR-0016): extrae los recursos con 👎 y comentario, o con 1 a 2 estrellas, como
// casos de regresión anonimizados para el benchmark del AI Engine.
//
// El archivo sale a apps/ai-engine/benchmarks/real/ (ignorada por git). Solo pasa a
// benchmarks/generation-real-cases.jsonl lo que el product owner revisa.
// Contra la base de producción: solo después de publicar la política de privacidad y los términos
// que lo permitan (decisión 5 de SPEC-0021).
//
// Uso: npm run benchmark:cases -w @profe/web
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");

const out = path.resolve("../ai-engine/benchmarks/real");
mkdirSync(out, { recursive: true });
// La sal vive solo en esta carpeta local: el id del caso es estable aquí y no se puede revertir.
const saltFile = path.join(out, ".salt");
if (!existsSync(saltFile))
  writeFileSync(saltFile, randomBytes(24).toString("hex"), { mode: 0o600 });
const salt = readFileSync(saltFile, "utf8").trim();

const { extractBenchmarkCases } = await import("@/modules/resources/benchmark-cases");
const { db } = await import("@/lib/db");

const cases = await extractBenchmarkCases(salt);
const file = path.join(out, `cases-${new Date().toISOString().slice(0, 10)}.jsonl`);
writeFileSync(file, cases.map((c) => JSON.stringify(c)).join("\n") + (cases.length ? "\n" : ""));
console.log(`${cases.length} casos en ${path.relative(process.cwd(), file)}`);
console.log("Revísalos antes de pasarlos a benchmarks/generation-real-cases.jsonl.");
await db.$disconnect();
