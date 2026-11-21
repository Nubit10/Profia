import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";

/** SPEC-0035 (ADR-0021): sin SMTP, el servidor de pruebas guarda cada correo como archivo aquí. */
export const MAIL_OUTBOX_DIR = path.resolve(".mail-outbox/e2e");

type SavedMail = { to: string; subject: string; text: string; html: string };

async function mailsTo(to: string): Promise<SavedMail[]> {
  const files = await readdir(MAIL_OUTBOX_DIR).catch(() => [] as string[]);
  const mails = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map(async (file) => JSON.parse(await readFile(path.join(MAIL_OUTBOX_DIR, file), "utf8"))),
  );
  return (mails as SavedMail[]).filter((mail) => mail.to === to);
}

/** Espera el correo número `count` a esa dirección (se envía después de responder) y lo devuelve. */
export async function waitForMail(to: string, count = 1): Promise<SavedMail> {
  let found: SavedMail[] = [];
  await expect
    .poll(async () => (found = await mailsTo(to)).length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(count);
  return found[count - 1]!;
}

export async function countMailsTo(to: string): Promise<number> {
  return (await mailsTo(to)).length;
}

export function resetLink(mail: SavedMail): string {
  const match = mail.text.match(/https?:\/\/\S+\/reset-password\/[A-Za-z0-9_-]+/);
  if (!match) throw new Error("el correo no trae el enlace");
  return match[0];
}
