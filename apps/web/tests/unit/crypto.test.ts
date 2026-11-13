import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DecryptionError, openJson, parseKey, sealJson } from "@/lib/crypto";

// ADR-0015: cifrado de datos sensibles en la aplicación (SPEC-0017 CA-0017-02).

describe("lib/crypto (ADR-0015)", () => {
  const key = randomBytes(32);
  const data = { student: { name: "Valentina Ríos" }, barriers: "Le cuesta leer textos largos." };

  it("CA-0017-02: cifra y descifra; el texto cifrado no contiene nada en claro", () => {
    const sealed = sealJson(key, data, "piar:1:inst");
    expect(sealed.iv).toHaveLength(12);
    expect(sealed.tag).toHaveLength(16);
    expect(sealed.ciphertext.toString("utf8")).not.toContain("Valentina");
    expect(openJson(key, sealed, "piar:1:inst")).toEqual(data);
    // Cada escritura usa un IV nuevo: el mismo contenido no se repite.
    expect(sealJson(key, data, "piar:1:inst").ciphertext.equals(sealed.ciphertext)).toBe(false);
  });

  it("CA-0017-02: otra clave, otros datos asociados o un byte alterado no descifran", () => {
    const sealed = sealJson(key, data, "piar:1:inst");
    expect(() => openJson(randomBytes(32), sealed, "piar:1:inst")).toThrow(DecryptionError);
    expect(() => openJson(key, sealed, "piar:2:inst")).toThrow(DecryptionError);
    const tampered = Buffer.from(sealed.ciphertext);
    tampered[0] = tampered[0]! ^ 1;
    expect(() => openJson(key, { ...sealed, ciphertext: tampered }, "piar:1:inst")).toThrow(
      DecryptionError,
    );
  });

  it("la clave debe ser de 32 bytes en base64", () => {
    expect(parseKey(randomBytes(32).toString("base64"))).toHaveLength(32);
    expect(parseKey(randomBytes(16).toString("base64"))).toBeNull();
    expect(parseKey("")).toBeNull();
    expect(parseKey(undefined)).toBeNull();
  });
});
