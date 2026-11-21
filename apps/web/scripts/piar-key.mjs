// SPEC-0017 / ADR-0015: crea la clave que cifra los PIAR y la guarda en apps/web/.env.
// Uso (desde la raíz): npm run piar:key -w @profia/web
// Nunca reemplaza una clave que ya exista: si se pierde, los PIAR guardados no se pueden leer.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
const NAME = "PIAR_ENCRYPTION_KEY";

const text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const line = text.split(/\r?\n/).find((l) => l.startsWith(`${NAME}=`));
const current =
  line
    ?.slice(NAME.length + 1)
    .trim()
    .replace(/^"|"$/g, "") ?? "";

if (current) {
  const valid = Buffer.from(current, "base64").length === 32;
  console.log(
    valid
      ? `${NAME} ya está configurada en apps/web/.env. No se cambia (los PIAR guardados dependen de ella).`
      : `${NAME} existe pero no es válida (deben ser 32 bytes en base64). Revísala a mano: no se reemplaza sola por si ya cifró datos.`,
  );
  process.exit(valid ? 0 : 1);
}

const key = randomBytes(32).toString("base64");
const entry = `${NAME}="${key}"`;
const next = line
  ? text.replace(line, entry)
  : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${entry}\n`;
writeFileSync(envPath, next);

console.log(`Listo: ${NAME} quedó guardada en apps/web/.env.`);
console.log("1. Reinicia `npm run dev` para que ProfIA la lea.");
console.log(
  "2. Guarda una copia de la clave fuera del proyecto (por ejemplo, en tu gestor de contraseñas).",
);
console.log("   Sin ella, los PIAR guardados no se pueden leer.");
console.log("3. En producción (Vercel) crea una clave aparte con este mismo comando o con");
console.log("   `openssl rand -base64 32` y ponla en las variables de entorno del proyecto.");
