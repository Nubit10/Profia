import { resolveTestDatabaseUrl } from "./test-database";

// Corre antes de importar los archivos de test: lib/db se conecta a la base de tests.
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-0000";
// Los tests nunca llaman a un AI Engine real: usan un fetch simulado contra esta URL ficticia.
process.env.AI_ENGINE_URL = "http://ai-engine.test:8100";
process.env.AI_ENGINE_TOKEN = "token-de-prueba-token-de-prueba";
// PIAR (ADR-0015): una clave nueva en cada corrida; nunca una clave real.
process.env.PIAR_ENCRYPTION_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256),
).toString("base64");
