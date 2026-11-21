import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getMailer, publicAppUrl, type Mailer } from "@/lib/email";
import { logger } from "@/lib/observability/logger";
import { getLimiter, type RateLimiter } from "@/lib/rate-limit";
import { recordAudit } from "@/modules/audit";
import { hashPassword } from "./password";
import { resetEmail } from "./reset-email";
import { normalizeEmail } from "./schemas";

// SPEC-0035: recuperar la contraseña con un enlace de un solo uso enviado al correo.

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // RN-02: 1 hora
const FIFTEEN_MINUTES = 15 * 60 * 1000;

export type ResetLimiters = { ip: RateLimiter; email: RateLimiter };

function defaultLimiters(): ResetLimiters {
  return {
    ip: getLimiter("password-reset-ip", 5, FIFTEEN_MINUTES), // RN-03
    email: getLimiter("password-reset-email", 3, FIFTEEN_MINUTES),
  };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Forma del token en la URL: 32 bytes en base64url (43 caracteres). */
export const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type ResetRequestDeps = {
  limiters?: ResetLimiters;
  mailer?: Mailer | null;
  appUrl?: string;
  now?: Date;
  /** Corre el envío después de responder (`after()` en la acción); por defecto, enseguida. */
  schedule?: (task: () => Promise<void>) => void;
};

/**
 * RN-01 / RN-03: nunca dice si la cuenta existe ni si se pasó el límite. Devuelve `sent` solo para las
 * pruebas; la acción responde siempre lo mismo.
 */
export async function requestPasswordReset(
  input: { email: string; ip: string },
  deps: ResetRequestDeps = {},
): Promise<{ sent: boolean }> {
  const email = normalizeEmail(input.email);
  const limiters = deps.limiters ?? defaultLimiters();
  const checks = await Promise.all([
    limiters.ip.consume(`reset-ip:${input.ip}`),
    limiters.email.consume(`reset-email:${email}`),
  ]);
  if (checks.some((check) => !check.allowed)) {
    logger.warn("auth.password_reset.rate_limited");
    return { sent: false };
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return { sent: false };

  const now = deps.now ?? new Date();
  const token = randomBytes(32).toString("base64url");
  await db.$transaction(async (tx) => {
    // RN-02: pedir otro anula los anteriores.
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
      },
    });
    await recordAudit(tx, {
      action: "auth.password_reset.requested",
      actorUserId: user.id,
      entityType: "user",
      entityId: user.id,
    });
  });

  const mailer = deps.mailer === undefined ? getMailer() : deps.mailer;
  if (!mailer) {
    logger.error("auth.password_reset.mail_unavailable", { userId: user.id });
    return { sent: false };
  }
  const link = `${deps.appUrl ?? publicAppUrl()}/reset-password/${token}`;
  const message = resetEmail({ name: user.name, link });
  const send = async () => {
    try {
      await mailer.send({ to: email, ...message });
      logger.info("auth.password_reset.mail_sent", { userId: user.id });
    } catch (error) {
      // Sin destinatario ni enlace en el registro (ADR-0021).
      logger.error("auth.password_reset.mail_failed", {
        userId: user.id,
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  };
  if (deps.schedule) deps.schedule(send);
  else await send();
  return { sent: true };
}

export type ResetTokenStatus = "valid" | "invalid";

/** Para la página: si el enlace todavía sirve (sin decir si venció, se usó o no existe). */
export async function checkResetToken(token: string, now = new Date()): Promise<ResetTokenStatus> {
  if (!RESET_TOKEN_PATTERN.test(token)) return "invalid";
  const found = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { usedAt: true, expiresAt: true },
  });
  return found && found.usedAt === null && found.expiresAt > now ? "valid" : "invalid";
}

export type ResetResult = { ok: true; email: string } | { ok: false; reason: "invalid_token" };

/**
 * RN-05: en una transacción, marca el token como usado (solo uno gana si hay dos pestañas), guarda el
 * hash nuevo, anula los demás tokens y cierra todas las sesiones del usuario.
 */
export async function resetPassword(
  input: { token: string; password: string },
  now = new Date(),
): Promise<ResetResult> {
  if (!RESET_TOKEN_PATTERN.test(input.token)) return { ok: false, reason: "invalid_token" };
  const tokenHash = hashResetToken(input.token);
  const passwordHash = await hashPassword(input.password);

  const result = await db.$transaction(async (tx) => {
    const token = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });
    if (!token) return null;
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;

    const user = await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash },
      select: { id: true, email: true },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await recordAudit(tx, {
      action: "auth.password_reset.completed",
      actorUserId: user.id,
      entityType: "user",
      entityId: user.id,
    });
    return user;
  });

  if (!result) return { ok: false, reason: "invalid_token" };
  logger.info("auth.password_reset.completed", { userId: result.id });
  return { ok: true, email: result.email };
}
