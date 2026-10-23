import { MAX_LOGO_BYTES, MAX_LOGO_SIDE } from "./schemas";
import type { LogoInfo } from "./types";

// Validación del logo por su contenido (RN-09, ADR-0010): solo PNG o JPEG, tamaño y dimensiones
// acotados. SVG nunca: puede llevar scripts.

export type LogoCheck = { ok: true; info: LogoInfo } | { ok: false; error: string };

function pngSize(data: Buffer) {
  // Firma PNG + bloque IHDR: ancho y alto en los bytes 16–23.
  const signature = "89504e470d0a1a0a";
  if (data.length < 24 || data.subarray(0, 8).toString("hex") !== signature) return null;
  if (data.subarray(12, 16).toString("latin1") !== "IHDR") return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function jpegSize(data: Buffer) {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) return null;
    const marker = data[i + 1]!;
    const length = data.readUInt16BE(i + 2);
    // SOF0–SOF15 (sin DHT, JPG ni DAC) traen alto y ancho.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

export function checkLogo(data: Buffer): LogoCheck {
  if (data.length === 0) return { ok: false, error: "El archivo está vacío" };
  if (data.length > MAX_LOGO_BYTES) return { ok: false, error: "El logo pesa más de 500 KB" };
  const png = pngSize(data);
  const jpeg = png ? null : jpegSize(data);
  const size = png ?? jpeg;
  if (!size) return { ok: false, error: "El logo debe ser una imagen PNG o JPG" };
  if (!size.width || !size.height || size.width > MAX_LOGO_SIDE || size.height > MAX_LOGO_SIDE) {
    return { ok: false, error: `La imagen debe medir como máximo ${MAX_LOGO_SIDE} px por lado` };
  }
  return { ok: true, info: { mimeType: png ? "image/png" : "image/jpeg", ...size } };
}
