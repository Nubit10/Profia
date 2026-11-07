import "server-only";

// API pública (servidor) del módulo notifications: avisos del navegador (SPEC-0013, ADR-0012).
export {
  hasPushDevice,
  notifyGenerationFinished,
  registerPushDevice,
  removePushDevice,
  type GenerationFinished,
} from "./service";
export {
  pushDeviceStatusAction,
  registerPushDeviceAction,
  removePushDeviceAction,
} from "./actions";
export { vapidPublicKey } from "@/lib/push";
