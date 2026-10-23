import path from "node:path";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const webRoot = path.resolve(__dirname, "../..");
let eslint: ESLint;

async function boundaryErrors(code: string, file: string) {
  const [result] = await eslint.lintText(code, { filePath: path.join(webRoot, file) });
  return (result?.messages ?? []).filter((m) => m.ruleId === "no-restricted-imports");
}

describe("RN-06: límites entre módulos", () => {
  beforeAll(async () => {
    eslint = new ESLint({ cwd: webRoot });
    // La primera pasada carga la configuración y el proyecto de TypeScript (lenta con la máquina
    // ocupada): se hace aquí para que cada caso mida solo su propio análisis.
    await eslint.lintText("export {};\n", { filePath: path.join(webRoot, "lib/warmup.ts") });
  }, 180_000);

  it("CA-0001-09: falla al importar un archivo interno de otro módulo por alias", async () => {
    const errors = await boundaryErrors(
      'import { registerUser } from "@/modules/auth/service";\nexport const x = registerUser;\n',
      "modules/groups/service.ts",
    );
    expect(errors).toHaveLength(1);
  }, 30_000);

  it("CA-0001-09: falla al importar un archivo interno de otro módulo por ruta relativa", async () => {
    const errors = await boundaryErrors(
      'import { registerUser } from "../auth/service";\nexport const x = registerUser;\n',
      "modules/groups/service.ts",
    );
    expect(errors).toHaveLength(1);
  }, 30_000);

  it("CA-0001-09: falla desde app/ al importar internals", async () => {
    const errors = await boundaryErrors(
      'import { db } from "@/modules/auth/config";\nexport const x = db;\n',
      "app/(app)/dashboard/x.ts",
    );
    expect(errors).toHaveLength(1);
  }, 30_000);

  it("permite la API pública (index y client) e imports relativos dentro del módulo", async () => {
    const fromApp = await boundaryErrors(
      'import { auth } from "@/modules/auth";\nimport { loginSchema } from "@/modules/auth/client";\nexport const x = [auth, loginSchema];\n',
      "app/(app)/dashboard/x.ts",
    );
    const insideModule = await boundaryErrors(
      'import { hashPassword } from "./password";\nexport const x = hashPassword;\n',
      "modules/auth/other.ts",
    );
    expect(fromApp).toEqual([]);
    expect(insideModule).toEqual([]);
  }, 30_000);
});
