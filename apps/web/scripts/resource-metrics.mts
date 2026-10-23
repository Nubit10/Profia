// Calidad de talleres y quices por versión de prompt y modelo (SPEC-0008 §6), sin datos
// personales ni textos. Se revisa antes de crear una versión nueva de un prompt.
// Uso: npm run metrics:resources
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const { promptQualityMetrics } = await import("@/modules/resources/metrics");
const { db } = await import("@/lib/db");

const rows = await promptQualityMetrics();
if (rows.length === 0) console.log("Todavía no hay recursos generados con IA.");
else console.table(rows);
await db.$disconnect();
