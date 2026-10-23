import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// RN-06 / ADR-0001: un módulo solo se usa por su API pública.
//   @/modules/<x>         → API de servidor (index.ts)
//   @/modules/<x>/client  → API segura para el navegador (client.ts)
// Cualquier otro archivo de un módulo es interno.
const moduleBoundaries = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          regex: "^@/modules/[^/]+/(?!client$).+",
          message:
            "Importa el módulo por su API pública: '@/modules/<x>' o '@/modules/<x>/client' (RN-06).",
        },
        {
          regex: "^\\.{1,2}/(.*/)?modules/[^/]+/(?!client$).+",
          message: "No accedas a archivos internos de un módulo con rutas relativas (RN-06).",
        },
      ],
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: moduleBoundaries },
  {
    // Dentro de un módulo se usan imports relativos; salir hacia otro módulo sigue prohibido.
    files: ["modules/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...moduleBoundaries["no-restricted-imports"][1].patterns,
            {
              regex: "^\\.\\./(?!\\.\\.)[^/]+/",
              message: "No importes archivos internos de otro módulo; usa '@/modules/<x>' (RN-06).",
            },
          ],
        },
      ],
    },
  },
  {
    // Tests y scripts de herramientas pueden usar piezas internas de un módulo; el producto no.
    files: ["tests/**", "scripts/**"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/db/generated/**",
    "playwright-report/**",
    "test-results/**",
    "tests/fixtures/**",
  ]),
]);

export default eslintConfig;
