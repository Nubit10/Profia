import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ADR-0015: cifrado en la aplicación para datos sensibles de estudiantes (PIAR, SPEC-0017).
// AES-256-GCM con IV aleatorio por escritura. Los datos asociados (AAD) atan el contenido a su
// registro y a su espacio: copiado a otra fila, no se descifra.

export type Sealed = { ciphertext: Buffer; iv: Buffer; tag: Buffer };

const ALGORITHM = "aes-256-gcm";

export class DecryptionError extends Error {
  override name = "DecryptionError";
}

/** La clave de 32 bytes en base64, o null si no es válida. */
export function parseKey(base64: string | undefined | null): Buffer | null {
  if (!base64) return null;
  const key = Buffer.from(base64, "base64");
  return key.length === 32 ? key : null;
}

export function sealJson(key: Buffer, value: unknown, aad: string): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), "utf8")),
    cipher.final(),
  ]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

export function openJson(key: Buffer, sealed: Sealed, aad: string): unknown {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, sealed.iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(sealed.tag);
    const plain = Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  } catch {
    // Nunca se devuelve contenido a medias ni el motivo exacto (clave, etiqueta o datos).
    throw new DecryptionError("No se pudo descifrar el contenido");
  }
}
