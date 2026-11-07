# ADR-0012 — App instalable, notificaciones del navegador y recursos sin conexión

| Campo              | Valor      |
| ------------------ | ---------- |
| Estado             | Aceptado   |
| Fecha              | 2026-11-05 |
| Specs relacionadas | SPEC-0013  |

## Contexto

SPEC-0013 pide tres cosas que Profe no tiene: instalarse en la pantalla de inicio, avisar con una
notificación del navegador cuando un recurso termina de generarse (aunque Profe esté cerrado) y
dejar todos los recursos generados disponibles para descargar sin conexión. Las tres necesitan un
**service worker**, una pieza que corre en el navegador del docente aparte de la página, y la
segunda necesita un canal de envío desde el servidor. Es tecnología nueva en el stack y toca
privacidad (qué queda guardado en el dispositivo), así que se decide aquí.

Dos productos del mismo equipo ya lo resolvieron: Terram (`app/manifest.ts`, `public/sw.js`, Web
Push con `web-push`, ADR-0024 de Terram) y CliqCut-Web (manifiesto por rol, service worker mínimo).

## Decisión

**Profe es una PWA con un service worker escrito a mano, Web Push estándar con VAPID y una
biblioteca sin conexión de documentos ya generados por el servidor.**

1. **Instalable.** `app/manifest.ts` (API nativa de Next) con `display: standalone`,
   `start_url: /dashboard`, íconos 192 y 512 "any maskable" generados a partir del logo. El layout
   raíz declara `appleWebApp` y `themeColor`.
2. **Service worker** en `public/sw.js`, alcance `/`, sin librerías (sin Workbox ni Serwist).
   - Nunca guarda páginas del área de trabajo ni respuestas de acciones: van a la red.
   - Guarda solo: `/_next/static/*` (inmutables, con huella), los íconos, la página estática
     `/offline` y los documentos de la biblioteca sin conexión.
   - Sin red, una navegación responde con `/offline`.
   - Al desplegar, el service worker nuevo se instala, borra las cachés de versiones anteriores
     (todas llevan un número de versión en el nombre) y toma el control con `clients.claim()`.
3. **Notificaciones: Web Push estándar con VAPID**, con la librería `web-push` (la misma de Terram).
   - Módulo nuevo `modules/notifications`: tabla `PushSubscription` (una por instalación del
     navegador, endpoint único), registrar y quitar el dispositivo, enviar.
   - Se envía desde el trabajo en segundo plano de la generación (ADR-0008) cuando un recurso pasa
     a `DRAFT` o `FAILED`. Un fallo al enviar nunca afecta la generación.
   - 404/410 borran la suscripción. Sin `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` el
     canal no existe y la UI no lo ofrece.
   - Si una ventana de Profe está a la vista, el service worker no muestra la notificación del
     sistema (el docente ya ve el aviso dentro de la app), igual que Claude.
4. **Recursos sin conexión: se guardan los archivos que genera el servidor**, no se generan en el
   navegador.
   - Una ruta del servidor da la lista de documentos del docente en el espacio activo (recurso,
     versión, URL de cada documento), filtrada por tenant.
   - La página, con señal, baja lo que falta de a un archivo por la ruta de descarga existente
     (con `purpose=offline`) y lo guarda en Cache Storage; el índice va en IndexedDB.
   - Las cachés llevan la cuenta y el espacio en el nombre y se borran al cerrar sesión o al
     entrar otra cuenta.

## Alternativas consideradas

- **Firebase Cloud Messaging** (CliqCut) — obliga a una cuenta de Google y a su SDK, y en Safari
  igual termina en Web Push. Web Push con VAPID funciona en todos los navegadores sin terceros.
- **Workbox o Serwist** — resuelven estrategias de caché que no necesitamos. Un `sw.js` de
  ~150 líneas se entiende y se revisa entero.
- **Generar los Word y PDF en el navegador** desde el contenido guardado — permitiría las versiones
  A–D sin guardar archivos, pero los generadores son de servidor (`server-only`, logo, formatos del
  docente de SPEC-0010) y pdfmake con sus fuentes pesa varios MB. Se tendrían dos caminos que
  pueden dar documentos distintos. Guardar lo que genera el servidor da exactamente el mismo
  archivo.
- **Background Sync / Periodic Sync** — no existe en Safari ni en Firefox. La sincronización corre
  en la página mientras Profe está abierto, que funciona en todos.

## Consecuencias

- Positivas:
  - Profe se instala en Android, iPhone (Safari) y computadores.
  - El docente recibe el aviso aunque cierre Profe.
  - En el salón sin señal tiene sus talleres y quices en Word y PDF.
- Negativas / costos:
  - Una dependencia nueva (`web-push`).
  - Tres variables de entorno nuevas; las claves VAPID se generan una vez y no se cambian, porque
    cambiarlas invalida todas las suscripciones.
  - La primera sincronización de un docente con muchos recursos genera muchos documentos en el
    servidor: se limita a 30 archivos por minuto por docente.
  - En iPhone las notificaciones solo llegan con Profe instalado (iOS 16.4+).
- Queda prohibido o restringido:
  - El service worker no guarda páginas ni respuestas de acciones, nunca.
  - No se guarda en el dispositivo nada distinto de los documentos de la biblioteca y su índice.
  - Las notificaciones no llevan datos de estudiantes ni más que el tipo y el título del recurso.
  - Toda caché nueva lleva la versión en el nombre.
