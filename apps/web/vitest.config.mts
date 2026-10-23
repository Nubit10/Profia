import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.join(root, "$1") },
      // `server-only` lanza fuera de React Server Components; en tests es un módulo vacío.
      { find: /^server-only$/, replacement: path.join(root, "tests/support/server-only.ts") },
    ],
  },
  test: {
    // next-auth importa "next/server" sin extensión; Vite lo resuelve si procesa el paquete.
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/support/integration-global-setup.ts"],
          setupFiles: ["tests/support/integration-env.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
