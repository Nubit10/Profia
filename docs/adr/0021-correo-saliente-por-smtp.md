# ADR-0021 — Correo saliente por SMTP con Nodemailer

| Campo              | Valor      |
| ------------------ | ---------- |
| Estado             | Aceptado   |
| Fecha              | 2026-11-21 |
| Specs relacionadas | SPEC-0035  |

## Contexto

Hasta ahora ProfIA no enviaba correos (las invitaciones se comparten por WhatsApp). Recuperar la
contraseña (SPEC-0035) necesita un correo que solo le llegue al dueño de la cuenta. El MVP se despliega
sin costo (ADR-0011) y todavía no se sabe qué proveedor de correo se usará.

## Decisión

ProfIA envía correo por **SMTP con Nodemailer**, detrás de un puerto propio en `lib/email`
(`getMailer().send({ to, subject, text, html })`).

- `SMTP_URL` (`smtp://` o `smtps://usuario:clave@servidor:puerto`) y `MAIL_FROM` (`ProfIA <no-responder@…>`)
  eligen el servidor. Cualquier proveedor sirve (Gmail con contraseña de aplicación, Brevo, Resend,
  Amazon SES…) sin cambiar código.
- Sin `SMTP_URL`, fuera de producción (o con `MAIL_OUTBOX_DIR`), los correos se guardan como archivos
  JSON en una carpeta (`apps/web/.mail-outbox/` por defecto, ignorada por git): así se prueban en local
  y en las e2e sin red.
- En producción sin `SMTP_URL` no hay canal: quien lo usa sigue funcionando y queda un error
  `mail.not_configured` en los registros.
- Los enlaces de los correos se arman con `APP_URL` (o `VERCEL_PROJECT_PRODUCTION_URL`), nunca con el
  encabezado `Host`.
- Los registros nunca llevan el destinatario ni el contenido.

## Alternativas consideradas

- **SDK de un proveedor (Resend, Brevo)** — ata el código a una empresa; todos ofrecen SMTP igual.
- **"Escríbenos" y restablecer a mano** — no escala y obliga a un humano a verificar identidades.

## Consecuencias

- Positivas: se cambia de proveedor con una variable; pruebas sin red.
- Negativas / costos: una dependencia nueva (`nodemailer`); el remitente necesita SPF/DKIM del proveedor
  para no caer en spam (con Gmail o un remitente verificado de Brevo no hace falta dominio propio).
- Qué queda prohibido o restringido a partir de ahora: enviar correo sin pasar por `lib/email`; poner
  datos de usuario en los registros del envío; armar enlaces con el `Host` de la petición.
