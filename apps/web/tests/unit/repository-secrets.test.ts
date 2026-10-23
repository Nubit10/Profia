import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../..");
const webRoot = path.resolve(__dirname, "../..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "generated",
  "playwright-report",
  "test-results",
  ".git",
  ".venv",
  ".models",
  "__pycache__",
  "sources",
]);
const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|json|md|ya?ml|sql|prisma|css)$/;
// Patrones de secretos reales: claves privadas, tokens de proveedores, URLs con credenciales reales.
const SECRET_PATTERNS = [
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36}\b/,
  /\bsk-[A-Za-z0-9_-]{32,}\b/,
  /AUTH_SECRET\s*=\s*["']?[A-Za-z0-9+/=]{32,}/,
];

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".env")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (TEXT_EXT.test(entry)) yield full;
  }
}

describe("CA-0001-10: secretos fuera del repositorio", () => {
  it(".env.example existe y no trae valores reales", () => {
    const example = readFileSync(path.join(webRoot, ".env.example"), "utf8");
    expect(example).toMatch(/^AUTH_SECRET=""$/m);
    expect(example).toContain("USER:PASSWORD");
  });

  it(".env* está ignorado por git (salvo .env.example)", () => {
    for (const ignoreFile of [
      path.join(repoRoot, ".gitignore"),
      path.join(webRoot, ".gitignore"),
    ]) {
      const content = readFileSync(ignoreFile, "utf8");
      expect(content).toMatch(/^\.env\*$/m);
      expect(content).toMatch(/^!\.env\.example$/m);
    }
  });

  it("ningún archivo versionable contiene secretos reales", () => {
    const leaks: string[] = [];
    for (const file of sourceFiles(repoRoot)) {
      const content = readFileSync(file, "utf8");
      if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
        leaks.push(path.relative(repoRoot, file));
      }
    }
    expect(leaks).toEqual([]);
  });
});
