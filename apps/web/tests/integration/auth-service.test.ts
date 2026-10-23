import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { MemoryRateLimiter } from "@/lib/rate-limit";
import * as password from "@/modules/auth/password";
import {
  attemptLogin,
  createSession,
  isSessionActive,
  registerUser,
  revokeSession,
} from "@/modules/auth/service";
import { resetDatabase } from "../support/factories";

const freshLimiters = () => ({
  loginAttempt: new MemoryRateLimiter(5, 60_000),
  loginIp: new MemoryRateLimiter(50, 60_000),
  loginEmail: new MemoryRateLimiter(20, 60_000),
});

const teacher = { name: "Ana Pérez", email: "ana@colegio.edu.co", password: "contraseña-segura" };

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("registerUser", () => {
  it("CA-0001-11: crea el usuario con la contraseña hasheada con argon2id", async () => {
    const result = await registerUser(teacher);
    expect(result.ok).toBe(true);

    const stored = await db.user.findUniqueOrThrow({ where: { email: teacher.email } });
    expect(stored.passwordHash).not.toContain(teacher.password);
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("CA-0001-12: rechaza un correo ya registrado sin importar mayúsculas", async () => {
    await registerUser(teacher);
    const again = await registerUser({ ...teacher, email: "  ANA@Colegio.EDU.CO " });

    expect(again).toEqual({ ok: false, reason: "email_taken" });
    expect(await db.user.count()).toBe(1);
  });

  it("CA-0001-12: dos registros simultáneos con el mismo correo crean un solo usuario", async () => {
    const results = await Promise.all([registerUser(teacher), registerUser(teacher)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.user.count()).toBe(1);
  });
});

describe("attemptLogin", () => {
  it("CA-0001-11 / CA-0001-03: un usuario registrado puede iniciar sesión", async () => {
    await registerUser(teacher);
    const result = await attemptLogin(
      { email: "Ana@colegio.edu.co", password: teacher.password, ip: "1.1.1.1" },
      freshLimiters(),
    );
    expect(result).toMatchObject({ status: "ok", user: { email: teacher.email } });
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });

  it("CA-0001-05: contraseña incorrecta y correo inexistente dan el mismo resultado genérico", async () => {
    await registerUser(teacher);
    const limiters = freshLimiters();
    const wrongPassword = await attemptLogin(
      { email: teacher.email, password: "otra-cosa", ip: "1.1.1.1" },
      limiters,
    );
    const unknownEmail = await attemptLogin(
      { email: "nadie@colegio.edu.co", password: "otra-cosa", ip: "1.1.1.1" },
      limiters,
    );
    expect(wrongPassword).toEqual({ status: "invalid" });
    expect(unknownEmail).toEqual({ status: "invalid" });
  });

  it("CA-0001-13: superado el límite, rechaza sin verificar la contraseña", async () => {
    await registerUser(teacher);
    const limiters = freshLimiters();
    const verify = vi.spyOn(password, "verifyPassword");
    for (let i = 0; i < 5; i++) {
      await attemptLogin({ email: teacher.email, password: "mala", ip: "2.2.2.2" }, limiters);
    }
    // El espía sí intercepta: los 5 intentos permitidos verificaron la contraseña.
    expect(verify).toHaveBeenCalledTimes(5);
    verify.mockClear();

    const blocked = await attemptLogin(
      { email: teacher.email, password: teacher.password, ip: "2.2.2.2" },
      limiters,
    );
    expect(blocked).toEqual({ status: "rate_limited" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("CA-0001-13: rotar la IP no evita el límite por correo", async () => {
    await registerUser(teacher);
    const limiters = freshLimiters();
    for (let i = 0; i < 20; i++) {
      await attemptLogin({ email: teacher.email, password: "mala", ip: `10.0.0.${i}` }, limiters);
    }
    const blocked = await attemptLogin(
      { email: teacher.email, password: teacher.password, ip: "10.0.0.99" },
      limiters,
    );
    expect(blocked).toEqual({ status: "rate_limited" });
  });

  it("un login exitoso reinicia el contador de intentos de esa IP y correo", async () => {
    await registerUser(teacher);
    const limiters = freshLimiters();
    for (let i = 0; i < 4; i++) {
      await attemptLogin({ email: teacher.email, password: "mala", ip: "3.3.3.3" }, limiters);
    }
    await attemptLogin(
      { email: teacher.email, password: teacher.password, ip: "3.3.3.3" },
      limiters,
    );
    const next = await attemptLogin(
      { email: teacher.email, password: "mala", ip: "3.3.3.3" },
      limiters,
    );
    expect(next).toEqual({ status: "invalid" });
  });
});

describe("sesiones revocables", () => {
  it("CA-0001-04: una sesión revocada deja de ser válida", async () => {
    const registered = await registerUser(teacher);
    if (!registered.ok) throw new Error("registro fallido");

    const session = await createSession(registered.user.id);
    expect(await isSessionActive(session.id)).toBe(true);

    await revokeSession(session.id);
    expect(await isSessionActive(session.id)).toBe(false);
  });

  it("RN-08: una sesión vencida o inexistente no es válida", async () => {
    const registered = await registerUser(teacher);
    if (!registered.ok) throw new Error("registro fallido");

    const session = await createSession(registered.user.id, 60);
    const later = new Date(Date.now() + 61_000);
    expect(await isSessionActive(session.id, later)).toBe(false);
    expect(await isSessionActive("no-existe")).toBe(false);
  });
});
