/**
 * Canal de soporte del piloto: WhatsApp del equipo de ProfIA (decisión del usuario, 2026-11-21).
 * Un solo lugar para el número; `NEXT_PUBLIC_SUPPORT_WHATSAPP` lo cambia sin tocar código.
 * El mensaje inicial no lleva datos del docente: él decide qué escribe.
 */
export const SUPPORT_WHATSAPP_DISPLAY = "320 568 5222";
const DEFAULT_NUMBER = "573205685222";

export function supportWhatsAppNumber(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "");
  return fromEnv && fromEnv.length >= 10 ? fromEnv : DEFAULT_NUMBER;
}

/** Enlace a wa.me con un mensaje inicial según dónde está el docente. */
export function supportWhatsAppUrl(where?: string): string {
  const text = where
    ? `Hola, equipo de ProfIA. Necesito ayuda con ${where}.`
    : "Hola, equipo de ProfIA. Necesito ayuda.";
  return `https://wa.me/${supportWhatsAppNumber()}?text=${encodeURIComponent(text)}`;
}
