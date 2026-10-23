// Se ejecuta una vez al arrancar el servidor. El código exclusivo de Node vive en un archivo aparte
// para que el build de Edge no lo incluya (process.exit no existe allí).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvOrExit } = await import("./instrumentation-node");
    assertEnvOrExit();
  }
}
