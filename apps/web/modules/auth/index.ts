import "server-only";

// API pública (servidor) del módulo auth. El resto de la app importa solo desde aquí
// o desde "@/modules/auth/client" (código seguro para el navegador). RN-06.
export { auth, handlers } from "./config";
export { getCurrentUser, requireUser } from "./session";
export { dismissTutorialAction, loginAction, logoutAction, registerAction } from "./actions";
export { dismissTutorial, hasDismissedTutorial } from "./tutorial";
export type { ActionResult } from "./types";
export type { PublicUser } from "./service";
