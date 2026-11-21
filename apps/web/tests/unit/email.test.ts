import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createMailer, publicAppUrl } from "@/lib/email";
import { escapeHtml } from "@/lib/email/escape";
import { parseEnv } from "@/lib/env-schema";
import { resetEmail } from "@/modules/auth/reset-email";

const base = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
};
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("ADR-0021 — correo saliente", () => {
  it("con SMTP_URL usa SMTP", () => {
    const env = parseEnv({
      ...base,
      NODE_ENV: "production",
      SMTP_URL: "smtps://u:p@smtp.test:465",
    });
    expect(createMailer(env)?.kind).toBe("smtp");
  });

  it("rechaza un SMTP_URL que no es smtp(s)://", () => {
    expect(() => parseEnv({ ...base, SMTP_URL: "http://smtp.test" })).toThrow(/SMTP_URL/);
  });

  it("RN-08: en producción sin SMTP_URL no hay canal", () => {
    expect(createMailer(parseEnv({ ...base, NODE_ENV: "production" }))).toBeNull();
  });

  it("RN-08: sin SMTP, el correo queda como archivo en MAIL_OUTBOX_DIR", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "outbox-"));
    dirs.push(dir);
    const mailer = createMailer(
      parseEnv({ ...base, NODE_ENV: "production", MAIL_OUTBOX_DIR: dir }),
    );
    await mailer!.send({ to: "ana@colegio.test", subject: "Hola", text: "t", html: "<p>h</p>" });
    const [file] = await readdir(dir);
    const saved = JSON.parse(await readFile(path.join(dir, file!), "utf8"));
    expect(saved).toMatchObject({ to: "ana@colegio.test", subject: "Hola" });
  });

  it("RN-06: el enlace usa APP_URL, luego el dominio de Vercel", () => {
    expect(publicAppUrl(parseEnv({ ...base, APP_URL: "https://profe.co/" }))).toBe(
      "https://profe.co",
    );
    expect(
      publicAppUrl(parseEnv({ ...base, VERCEL_PROJECT_PRODUCTION_URL: "profe.vercel.app" })),
    ).toBe("https://profe.vercel.app");
  });

  it("el correo escapa el nombre en el HTML", () => {
    expect(escapeHtml(`<b>"x"&'y'</b>`)).toBe("&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;");
    const message = resetEmail({
      name: "<script>Ana",
      link: "https://profe.co/reset-password/abc",
    });
    expect(message.html).not.toContain("<script>");
    expect(message.text).toContain("https://profe.co/reset-password/abc");
    expect(message.text).toContain("vence en 1 hora");
  });
});
