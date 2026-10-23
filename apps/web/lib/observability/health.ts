export type HealthReport =
  | { httpStatus: 200; body: { status: "ok"; db: "ok" } }
  | { httpStatus: 503; body: { status: "degraded"; db: "error" } };

/** Comprueba las dependencias críticas. `pingDb` debe lanzar si la base no responde. */
export async function checkHealth(pingDb: () => Promise<unknown>): Promise<HealthReport> {
  try {
    await pingDb();
    return { httpStatus: 200, body: { status: "ok", db: "ok" } };
  } catch {
    return { httpStatus: 503, body: { status: "degraded", db: "error" } };
  }
}
