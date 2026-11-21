import { BRAND_COLOR } from "@/lib/brand-colors";
import { escapeHtml } from "@/lib/email/escape";

/** SPEC-0035: el correo con el enlace para crear una contraseña nueva (texto y HTML). */
export function resetEmail(input: { name: string; link: string }) {
  const firstName = input.name.trim().split(/\s+/)[0] ?? "";
  const subject = "Crea una contraseña nueva para ProfIA";
  const text = [
    `Hola, ${firstName}:`,
    "",
    "Pediste crear una contraseña nueva para entrar a ProfIA. Abre este enlace:",
    input.link,
    "",
    "El enlace sirve una sola vez y vence en 1 hora.",
    "Si no lo pediste, ignora este correo: tu contraseña sigue igual.",
  ].join("\n");
  const name = escapeHtml(firstName);
  const href = escapeHtml(input.link);
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:#1d1b16">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="font-size:18px;font-weight:bold;margin:0 0 16px">Hola, ${name}:</p>
<p style="font-size:16px;line-height:1.5;margin:0 0 24px">Pediste crear una contraseña nueva para entrar a ProfIA.</p>
<p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 22px;border-radius:10px">Crear una contraseña nueva</a></p>
<p style="font-size:14px;line-height:1.5;color:#5c5a52;margin:0 0 8px">El enlace sirve una sola vez y vence en 1 hora.</p>
<p style="font-size:14px;line-height:1.5;color:#5c5a52;margin:0 0 16px">Si no lo pediste, ignora este correo: tu contraseña sigue igual.</p>
<p style="font-size:12px;color:#8a877d;margin:0;word-break:break-all">Si el botón no abre, copia este enlace: ${href}</p>
</div></body></html>`;
  return { subject, text, html };
}
