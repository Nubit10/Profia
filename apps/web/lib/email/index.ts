import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { getEnv, type Env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";

/**
 * Correo saliente (ADR-0021). SMTP con Nodemailer si hay `SMTP_URL`; si no, fuera de producción (o con
 * `MAIL_OUTBOX_DIR`), cada correo queda como un archivo JSON en una carpeta para probar sin red. Los
 * registros nunca llevan el destinatario ni el contenido.
 */
export type MailMessage = { to: string; subject: string; text: string; html: string };
export type Mailer = {
  readonly kind: "smtp" | "outbox";
  send(message: MailMessage): Promise<void>;
};

const DEFAULT_FROM = "ProfIA <no-responder@profia.app>";
export const DEFAULT_OUTBOX_DIR = ".mail-outbox";

export function createMailer(env: Env = getEnv()): Mailer | null {
  const from = env.MAIL_FROM ?? DEFAULT_FROM;
  if (env.SMTP_URL) {
    const transport = nodemailer.createTransport(env.SMTP_URL);
    return {
      kind: "smtp",
      async send(message) {
        await transport.sendMail({ from, ...message });
      },
    };
  }
  const outbox = env.MAIL_OUTBOX_DIR ?? (env.NODE_ENV === "production" ? null : DEFAULT_OUTBOX_DIR);
  if (!outbox) return null;
  return {
    kind: "outbox",
    async send(message) {
      await mkdir(outbox, { recursive: true });
      const file = path.join(outbox, `${Date.now()}-${randomUUID()}.json`);
      await writeFile(file, JSON.stringify({ from, ...message }, null, 2), "utf8");
      logger.info("mail.saved_to_outbox", { file });
    },
  };
}

let cached: Mailer | null | undefined;

/** El canal del proceso, o `null` si en producción no hay servidor de correo. */
export function getMailer(): Mailer | null {
  if (cached === undefined) {
    cached = createMailer();
    if (!cached) logger.error("mail.not_configured");
  }
  return cached;
}

/** URL pública del sitio (RN-06 de SPEC-0035): `APP_URL`, la de producción de Vercel o localhost. */
export function publicAppUrl(env: Env = getEnv()): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export { escapeHtml } from "./escape";
