import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { MailMessage, Mailer } from "@/lib/email";
import { MemoryRateLimiter } from "@/lib/rate-limit";
import {
  RESET_TOKEN_TTL_MS,
  checkResetToken,
  hashResetToken,
  requestPasswordReset,
  resetPassword,
} from "@/modules/auth/password-reset";
import { attemptLogin, createSession, isSessionActive, registerUser } from "@/modules/auth/service";
import { resetDatabase } from "../support/factories";

const teacher = { name: "Ana Pérez", email: "ana@colegio.edu.co", password: "contraseña-vieja" };
const APP = "https://profia.example";

function fakeMailer() {
  const sent: MailMessage[] = [];
  const mailer: Mailer = {
    kind: "outbox",
    async send(message) {
      sent.push(message);
    },
  };
  return { mailer, sent };
}

const limiters = () => ({
  ip: new MemoryRateLimiter(5, 60_000),
  email: new MemoryRateLimiter(3, 60_000),
});

const loginLimiters = () => ({
  loginAttempt: new MemoryRateLimiter(50, 60_000),
  loginIp: new MemoryRateLimiter(50, 60_000),
  loginEmail: new MemoryRateLimiter(50, 60_000),
});

function tokenFrom(message: MailMessage): string {
  const match = message.text.match(/\/reset-password\/([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error("el correo no trae enlace");
  return match[1];
}

async function requestFor(email: string, mail = fakeMailer(), now?: Date) {
  const result = await requestPasswordReset(
    { email, ip: "10.0.0.1" },
    { mailer: mail.mailer, appUrl: APP, limiters: limiters(), now },
  );
  return { ...result, mail };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("SPEC-0035 — pedir el enlace", () => {
  it("CA-0035-02: con cuenta, envía un correo con el enlace armado con APP_URL", async () => {
    await registerUser(teacher);
    const { sent, mail } = await requestFor("  ANA@colegio.edu.co ");

    expect(sent).toBe(true);
    expect(mail.sent).toHaveLength(1);
    const [message] = mail.sent;
    expect(message!.to).toBe(teacher.email);
    expect(message!.text).toContain(`${APP}/reset-password/`);
    expect(message!.html).toContain("Crear una contraseña nueva");
    expect(message!.text).toContain("Hola, Ana:");
    expect(await checkResetToken(tokenFrom(message!))).toBe("valid");
    expect(await db.auditLog.count({ where: { action: "auth.password_reset.requested" } })).toBe(1);
  });

  it("CA-0035-03: sin cuenta, no crea token ni envía correo", async () => {
    const { sent, mail } = await requestFor("nadie@colegio.edu.co");
    expect(sent).toBe(false);
    expect(mail.sent).toHaveLength(0);
    expect(await db.passwordResetToken.count()).toBe(0);
  });

  it("CA-0035-07: pasado el límite por correo no envía más", async () => {
    await registerUser(teacher);
    const mail = fakeMailer();
    const shared = limiters();
    const results = [];
    for (let i = 0; i < 4; i += 1) {
      results.push(
        await requestPasswordReset(
          { email: teacher.email, ip: `10.0.0.${i}` },
          { mailer: mail.mailer, appUrl: APP, limiters: shared },
        ),
      );
    }
    expect(results.map((r) => r.sent)).toEqual([true, true, true, false]);
    expect(mail.sent).toHaveLength(3);
  });

  it("CA-0035-08: en la base solo queda el hash del token", async () => {
    await registerUser(teacher);
    const { mail } = await requestFor(teacher.email);
    const token = tokenFrom(mail.sent[0]!);

    const stored = await db.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).toBe(hashResetToken(token));
    expect(stored.tokenHash).not.toContain(token);
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("si el envío falla, no rompe el pedido", async () => {
    await registerUser(teacher);
    const failing: Mailer = {
      kind: "smtp",
      async send() {
        throw new Error("smtp caído");
      },
    };
    await expect(
      requestPasswordReset(
        { email: teacher.email, ip: "10.0.0.9" },
        { mailer: failing, appUrl: APP, limiters: limiters() },
      ),
    ).resolves.toEqual({ sent: true });
  });
});

describe("SPEC-0035 — usar el enlace", () => {
  it("CA-0035-04: cambia la contraseña; la vieja deja de servir y la nueva sirve", async () => {
    await registerUser(teacher);
    const { mail } = await requestFor(teacher.email);

    const result = await resetPassword({
      token: tokenFrom(mail.sent[0]!),
      password: "contraseña-nueva",
    });
    expect(result).toEqual({ ok: true, email: teacher.email });

    const old = await attemptLogin(
      { email: teacher.email, password: teacher.password, ip: "1.1.1.1" },
      loginLimiters(),
    );
    expect(old.status).toBe("invalid");
    const fresh = await attemptLogin(
      { email: teacher.email, password: "contraseña-nueva", ip: "1.1.1.1" },
      loginLimiters(),
    );
    expect(fresh.status).toBe("ok");
    expect(await db.auditLog.count({ where: { action: "auth.password_reset.completed" } })).toBe(1);
  });

  it("CA-0035-05: un enlace usado no sirve otra vez", async () => {
    await registerUser(teacher);
    const { mail } = await requestFor(teacher.email);
    const token = tokenFrom(mail.sent[0]!);

    await resetPassword({ token, password: "contraseña-nueva" });
    expect(await checkResetToken(token)).toBe("invalid");
    expect(await resetPassword({ token, password: "otra-contraseña" })).toEqual({
      ok: false,
      reason: "invalid_token",
    });
  });

  it("CA-0035-05: dos usos simultáneos del mismo enlace: solo uno gana", async () => {
    await registerUser(teacher);
    const { mail } = await requestFor(teacher.email);
    const token = tokenFrom(mail.sent[0]!);

    const results = await Promise.all([
      resetPassword({ token, password: "primera-contraseña" }),
      resetPassword({ token, password: "segunda-contraseña" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("CA-0035-05: un enlace vencido no sirve y la contraseña no cambia", async () => {
    await registerUser(teacher);
    const past = new Date(Date.now() - RESET_TOKEN_TTL_MS - 60_000);
    const { mail } = await requestFor(teacher.email, fakeMailer(), past);
    const token = tokenFrom(mail.sent[0]!);

    expect(await checkResetToken(token)).toBe("invalid");
    expect((await resetPassword({ token, password: "contraseña-nueva" })).ok).toBe(false);
    const login = await attemptLogin(
      { email: teacher.email, password: teacher.password, ip: "1.1.1.1" },
      loginLimiters(),
    );
    expect(login.status).toBe("ok");
  });

  it("CA-0035-05: pedir otro enlace anula el anterior", async () => {
    await registerUser(teacher);
    const first = tokenFrom((await requestFor(teacher.email)).mail.sent[0]!);
    const second = tokenFrom((await requestFor(teacher.email)).mail.sent[0]!);

    expect(await checkResetToken(first)).toBe("invalid");
    expect(await checkResetToken(second)).toBe("valid");
  });

  it("CA-0035-05: un enlace inventado o mal formado no sirve", async () => {
    expect(await checkResetToken("inventado")).toBe("invalid");
    expect(await checkResetToken("a".repeat(43))).toBe("invalid");
  });

  it("CA-0035-06: cambiar la contraseña cierra las sesiones abiertas", async () => {
    const registered = await registerUser(teacher);
    if (!registered.ok) throw new Error("registro");
    const phone = await createSession(registered.user.id);
    const laptop = await createSession(registered.user.id);
    const { mail } = await requestFor(teacher.email);

    await resetPassword({ token: tokenFrom(mail.sent[0]!), password: "contraseña-nueva" });
    expect(await isSessionActive(phone.id)).toBe(false);
    expect(await isSessionActive(laptop.id)).toBe(false);
  });
});
