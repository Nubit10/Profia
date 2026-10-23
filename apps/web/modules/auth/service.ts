import "server-only";
import { db, isUniqueViolation } from "@/lib/db";
import { authLimiters, type RateLimiter } from "@/lib/rate-limit";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";
import { normalizeEmail } from "./schemas";

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type PublicUser = { id: string; name: string; email: string };

// ---------- Registro ----------

export type RegisterResult = { ok: true; user: PublicUser } | { ok: false; reason: "email_taken" };

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, reason: "email_taken" };

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.user.create({
      data: { name: input.name.trim(), email, passwordHash },
      select: { id: true, name: true, email: true },
    });
    return { ok: true, user };
  } catch (error) {
    // Carrera entre dos registros simultáneos: la restricción única decide.
    if (isUniqueViolation(error)) return { ok: false, reason: "email_taken" };
    throw error;
  }
}

// ---------- Login ----------

export type LoginAttemptResult =
  { status: "ok"; user: PublicUser } | { status: "invalid" } | { status: "rate_limited" };

type LoginLimiters = { loginAttempt: RateLimiter; loginIp: RateLimiter; loginEmail: RateLimiter };

export async function attemptLogin(
  input: { email: string; password: string; ip: string },
  limiters: LoginLimiters = authLimiters,
): Promise<LoginAttemptResult> {
  const email = normalizeEmail(input.email);
  const attemptKey = `login:${input.ip}:${email}`;

  // RN-09 / CA-0001-13: se cuenta el intento antes de mirar la contraseña.
  const results = await Promise.all([
    limiters.loginAttempt.consume(attemptKey),
    limiters.loginIp.consume(`login-ip:${input.ip}`),
    limiters.loginEmail.consume(`login-email:${email}`),
  ]);
  if (results.some((result) => !result.allowed)) return { status: "rate_limited" };

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await verifyAgainstDummy(input.password);
    return { status: "invalid" };
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) return { status: "invalid" };

  await limiters.loginAttempt.reset(attemptKey);
  return { status: "ok", user: { id: user.id, name: user.name, email: user.email } };
}

// ---------- Sesiones revocables (RN-08) ----------

export async function createSession(userId: string, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return db.userSession.create({
    data: { userId, expiresAt: new Date(Date.now() + maxAgeSeconds * 1000) },
    select: { id: true, expiresAt: true },
  });
}

export async function isSessionActive(sessionId: string, now = new Date()): Promise<boolean> {
  const session = await db.userSession.findUnique({
    where: { id: sessionId },
    select: { revokedAt: true, expiresAt: true },
  });
  return !!session && session.revokedAt === null && session.expiresAt > now;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.userSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function findPublicUser(userId: string): Promise<PublicUser | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
}
