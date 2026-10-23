import { EnvValidationError, parseEnv } from "./lib/env-schema";

/**
 * SPEC-0001 RN-03: si faltan variables obligatorias, el proceso termina.
 * Next.js solo registra el error del hook y sigue sirviendo, por eso salimos explícitamente.
 */
export function assertEnvOrExit() {
  try {
    parseEnv(process.env);
  } catch (error) {
    if (!(error instanceof EnvValidationError)) throw error;
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }
}
