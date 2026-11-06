import { z } from "zod";

// SPEC-0013 RN-15: lo que el navegador manda al activar los avisos. El mismo schema lo valida el
// servidor; la base tiene además un CHECK con los mismos límites (ADR-0012).

export const installationIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]{16,64}$/, "Identificador de dispositivo inválido");

export const pushDeviceSchema = z.object({
  installationId: installationIdSchema,
  subscription: z.object({
    endpoint: z
      .url()
      .max(1024)
      .refine((url) => url.startsWith("https://"), "El servicio de avisos debe usar HTTPS"),
    keys: z.object({
      p256dh: z.string().min(20).max(200),
      auth: z.string().min(8).max(100),
    }),
  }),
});

export type PushDeviceInput = z.infer<typeof pushDeviceSchema>;
