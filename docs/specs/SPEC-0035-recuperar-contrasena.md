# SPEC-0035 — Recuperar la contraseña por correo y ver la contraseña al escribirla

| Campo                    | Valor                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| Estado                   | **Implementada**                                                         |
| Fase del roadmap         | 2 · Identity (requisito para entregar el piloto a los primeros docentes) |
| Módulo(s) responsable(s) | `modules/auth`, `lib/email`, `components/password-input.tsx`             |
| Agentes                  | product, auth-security, backend, frontend, qa                            |
| ADR relacionados         | ADR-0021 (correo saliente por SMTP con Nodemailer)                       |
| Autor / Fecha            | Claude con el usuario / 2026-11-21                                       |

Decisiones del usuario (2026-11-21): el camino **completo, por correo** (no "escríbenos"); el correo sale
con **Nodemailer** (cualquier servidor SMTP); a las vistas de contraseña les falta **poder ver lo que se
escribe**; y se hace una **prueba de usabilidad** de esas vistas.

## 1. Objetivo

Que un docente que olvidó su contraseña pueda entrar otra vez sin ayuda, con un enlace que le llega al
correo, y que en cualquier campo de contraseña pueda ver lo que escribe (en el celular es fácil
equivocarse).

## 2. Alcance

**Incluye:**

- "¿Olvidaste tu contraseña?" en el inicio de sesión → `/forgot-password` (correo) → correo con un enlace
  de un solo uso → `/reset-password/<token>` (contraseña nueva) → entra a Profe.
- Botón para mostrar u ocultar la contraseña en el inicio de sesión, el registro y la contraseña nueva.
- Envío de correo por SMTP (`lib/email`, ADR-0021), configurable con `SMTP_URL` y `MAIL_FROM`.

**No incluye (explícitamente):**

- Cambiar la contraseña con la sesión abierta (desde Ajustes): spec aparte si se pide.
- Verificar el correo al registrarse, iniciar sesión con Google o con un código.
- Quitar "Confirmar contraseña" del registro (se propone en el informe de usabilidad; decide el usuario).

## 3. Actores y permisos

| Actor              | Puede                                                              | No puede                                                  |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------------------------- |
| Visitante          | Pedir el enlace con un correo; usar un enlace vigente que le llegó | Saber si un correo tiene cuenta; usar un enlace dos veces |
| Docente con sesión | Lo mismo (la página no le exige cerrar sesión)                     | —                                                         |

## 4. Reglas de negocio

- **RN-01:** Pedir el enlace responde **siempre lo mismo**, exista o no la cuenta ("Si hay una cuenta con
  ese correo, te enviamos un enlace…"). El correo se envía después de responder (`after()`), para que el
  tiempo de respuesta tampoco lo delate.
- **RN-02:** El enlace lleva un token aleatorio de 32 bytes; en la base solo se guarda su SHA-256. Vence
  en **1 hora** y sirve **una sola vez**. Pedir otro anula los anteriores del mismo usuario.
- **RN-03:** Límite de pedidos: 5 por IP y 3 por correo cada 15 minutos. Pasado el límite, la respuesta
  es la misma de RN-01 (no se envía correo) para no delatar nada.
- **RN-04:** La contraseña nueva cumple las reglas del registro (8 a 128 caracteres) y se confirma.
- **RN-05:** Al cambiarla, en una transacción: se guarda el hash nuevo (argon2id), el token queda usado,
  se anulan los demás tokens del usuario y **se cierran todas sus sesiones abiertas** (`user_sessions`).
  Después Profe inicia sesión con la contraseña nueva y lleva al Inicio; si no puede, lleva al login con
  el correo escrito.
- **RN-06:** El enlace se arma con la URL pública del sitio (`APP_URL`, o la de producción de Vercel),
  **nunca** con el encabezado `Host` de la petición.
- **RN-07:** Mostrar la contraseña es un botón dentro del campo, con área táctil de 44 px, nombre
  accesible "Mostrar contraseña" / "Ocultar contraseña" y `aria-pressed`. Arranca oculta.
- **RN-08:** Sin servidor de correo en producción, el pedido responde igual (RN-01) y queda un error en
  los registros (`mail.not_configured`). En desarrollo y pruebas el correo se guarda como archivo en
  `MAIL_OUTBOX_DIR` (por defecto `apps/web/.mail-outbox/`, fuera de git).

## 5. Entradas

- `requestPasswordResetAction({ email })`: el mismo schema de correo del login.
- `resetPasswordAction({ token, password, confirmPassword })`: `resetPasswordSchema`.

## 6. Salidas

- Tabla `password_reset_tokens` (`id`, `userId`, `tokenHash` único, `expiresAt`, `usedAt`, `createdAt`).
- Correo en texto y HTML: saludo con el nombre, botón "Crear una contraseña nueva", vence en 1 hora,
  "si no lo pediste, ignora este correo".
- Auditoría: `auth.password_reset.requested` (solo si la cuenta existe) y `auth.password_reset.completed`.

## 7. Errores y casos límite

| Caso                              | Comportamiento esperado                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Correo sin cuenta                 | Mismo mensaje de RN-01; no se envía nada                                        |
| Enlace vencido, usado o inventado | La página lo dice y ofrece "Pedir un enlace nuevo" (sin formulario)             |
| Dos pestañas usan el mismo enlace | Solo una cambia la contraseña; la otra ve "Este enlace ya se usó"               |
| El servidor de correo falla       | El docente ve RN-01; el error queda en los registros sin el correo ni el enlace |
| Pide varios enlaces               | Solo el último sirve                                                            |

## 8. Criterios de aceptación

- **CA-0035-01:** Dado el login, cuando el docente toca "¿Olvidaste tu contraseña?", entonces llega a la
  página del correo con el correo que ya había escrito.
- **CA-0035-02:** Dado un correo con cuenta, cuando pide el enlace, entonces ve el mensaje de RN-01 y le
  llega un correo con un enlace a `/reset-password/<token>` armado con `APP_URL`.
- **CA-0035-03:** Dado un correo sin cuenta, cuando pide el enlace, entonces ve el mismo mensaje y no se
  crea token ni se envía correo.
- **CA-0035-04:** Dado un enlace vigente, cuando escribe y confirma una contraseña nueva, entonces entra a
  Profe, la contraseña anterior deja de servir y la nueva sirve.
- **CA-0035-05:** Dado un enlace ya usado, vencido o anulado por uno más nuevo, cuando lo abre o lo envía,
  entonces ve que no sirve y el enlace para pedir otro; la contraseña no cambia.
- **CA-0035-06:** Dado un docente con sesiones abiertas, cuando cambia la contraseña con el enlace,
  entonces esas sesiones se cierran.
- **CA-0035-07:** Dado que se pasó el límite de RN-03, cuando pide otro enlace, entonces la respuesta es
  la misma y no se envía correo.
- **CA-0035-08:** En la base solo queda el hash del token (nunca el token).
- **CA-0035-09:** Dado un campo de contraseña (login, registro, contraseña nueva), cuando toca "Mostrar
  contraseña", entonces ve lo escrito y el botón pasa a "Ocultar contraseña"; vuelve a ocultarse al tocarlo.
- **CA-0035-10:** Las tres pantallas no tienen fallas de accesibilidad (axe) y caben en 360 px sin
  desplazamiento lateral.

## 9. Seguridad y privacidad

- Sin enumeración de cuentas (RN-01, RN-03); token de un solo uso, corto y guardado como hash (RN-02).
- Cambiar la contraseña cierra las sesiones de un posible intruso (RN-05).
- Los registros no llevan el correo ni el enlace (`lib/observability/logger`); la auditoría no copia el
  correo.
- Credenciales SMTP solo en variables de entorno.

## 10. Tareas

- [x] T1 — ADR-0021 y `lib/email` (SMTP, carpeta de pruebas) — architect, backend
- [x] T2 — Tabla y servicio de tokens, acciones y límites — auth-security, database
- [x] T3 — Páginas `/forgot-password` y `/reset-password/[token]`, enlace en el login — frontend
- [x] T4 — `PasswordInput` (mostrar u ocultar) en login, registro y contraseña nueva — frontend
- [x] T5 — Pruebas unitarias, de integración y e2e (escritorio y celular, axe) — qa
- [x] T6 — Prueba de usabilidad de las vistas y guía de despliegue (`SMTP_URL`, `MAIL_FROM`, `APP_URL`)

## 11. Preguntas abiertas

- ¿Qué servidor SMTP se usa en producción (Gmail con contraseña de aplicación, Brevo, Resend…) y desde qué
  dirección sale el correo? El código sirve con cualquiera.
