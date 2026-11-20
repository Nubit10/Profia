# Estado del trabajo (2026-11-20)

Bitácora para retomar el trabajo después de borrar la conversación. **Se actualiza al cerrar cada tarea**
(qué se hizo, qué quedó a medias y con qué seguir). Lo más reciente va arriba de cada sección.

## En curso

- **SPEC-0020** — Material de referencia del docente ([spec](specs/SPEC-0020-material-de-referencia.md)).
  Estado: **Borrador**, esperando que el usuario responda las 3 preguntas abiertas y la apruebe.
  - Pedido: cuando la asignatura no tiene DBA, que el docente pueda subir un PDF, pegar contenido, dar el
    nombre de un libro o una página web para que el taller/quiz/examen se haga con eso.
  - Propuesta: primero PDF, Word y texto pegado; enlaces después; el libro solo como referencia (la IA
    no lo tiene). Necesita un ADR antes de implementar (texto de terceros a la IA, lectura segura de enlaces).
  - Siguiente paso: aprobación → ADR → `/implement SPEC-0020`.

## Hecho

- **Modelo de autorización del acudiente para el PIAR**, 2026-11-20
  ([docs/legal/autorizacion-acudiente-piar.md](legal/autorizacion-acudiente-piar.md)). Pensado para el
  **docente independiente**: él es el responsable de los datos y Profe su encargado; no necesita al colegio.
  Trae el texto para firmar (Ley 1581, datos sensibles facultativos, IA sin datos personales, servidores en
  EE. UU., borrado y derechos) y una nota para cuando el que contrata es el colegio.
  - En la app, la casilla de "Nuevo PIAR" del docente independiente dice "autorización firmada del acudiente"
    (ya no "y del colegio"); en un espacio de colegio sigue igual. RN-04 de SPEC-0017 actualizada.
  - Falta (de Profe, no del docente): publicar la política de privacidad y los términos con la sección del
    PIAR, llenar en el modelo la razón social, el enlace y el correo de soporte, y ofrecerlo para descargar
    desde la pantalla del PIAR. Es un modelo: conviene que lo revise un abogado.

- **PIAR (SPEC-0017) listo para usar en local**, 2026-11-20. En el computador del usuario salía "El PIAR no
  está disponible todavía" porque su `apps/web/.env` no tenía `PIAR_ENCRYPTION_KEY` (el `.env` no va en git).
  - Nuevo comando `npm run piar:key -w @profe/web` (`apps/web/scripts/piar-key.mjs`): crea la clave y la
    escribe en `apps/web/.env` si falta; nunca reemplaza una existente (si se pierde, los PIAR guardados no se
    leen) y avisa si la que hay no es válida. Luego hay que reiniciar `npm run dev`.
  - Producción (Vercel): clave aparte en las variables de entorno (`docs/deploy/README.md`).
  - Pendiente fuera del código (de SPEC-0017): política de datos del colegio (Ley 1581) y autorización de
    los acudientes.

- **SPEC-0019** — Asistente de crear un paso por pantalla
  ([spec](specs/SPEC-0019-asistente-un-paso-por-pantalla.md)), implementada el 2026-11-20.
  - Curso y Tema son pasos separados (examen: Curso → Temas → Ajustes → Confirmar); elegir avanza a otra
    pantalla. Lo elegido se ve en los pasos (escritorio) o en una fila de fichas que se desliza de lado con flechas (celular; el usuario no quiso las fichas una debajo de otra) y tocarlo lo cambia.
    Volver al paso anterior ("← Volver al curso"…) va **debajo de los pasos**, igual en escritorio y celular
    (el usuario descartó ponerlo suelto encima de los pasos y arriba del título).
    Se quitó la tarjeta "Curso / Tema".
  - Código: `apps/web/app/(app)/create/create-wizard.tsx`, `page.tsx` (`curso=elegir`),
    `apps/web/components/stepper.tsx` (`values`), enlace para volver en `create-wizard.tsx`.
  - Pruebas: `spec-0019.spec.ts`, `spec-0019.movil.spec.ts` y ajustes en `ux.spec.ts`, `spec-0013.spec.ts`.
    Capturas: `docs/design/capturas/spec-0019/`.

- **SPEC-0018** — "Sin conexión" compacto en el celular
  ([spec](specs/SPEC-0018-sin-conexion-compacto-en-celular.md)), implementada el 2026-11-20.
  - En el celular, en "Mis recursos", la tarjeta pasó a ser un ícono (nube) con punto de aviso junto a
    "Crear con IA"; al tocarlo abre una hoja inferior con la explicación y "Guardar en este dispositivo" /
    "No, gracias". Ya decidido, el ícono sigue sin punto y la hoja muestra "guardados N de M" y "Dejar de
    guardar". En escritorio sigue la tarjeta de siempre.
  - Código: `apps/web/components/offline/offline-panel.tsx` (`OfflineButton`, `OfflinePanel`),
    `apps/web/app/(app)/resources/page.tsx`.
  - Pruebas: `apps/web/tests/e2e/spec-0018.movil.spec.ts` (3 en verde) y CA-0018-07 en
    `spec-0013-offline.spec.ts`. Capturas: `docs/design/capturas/spec-0018/`.
- SPEC-0001 a SPEC-0014, SPEC-0016 y SPEC-0017 implementadas (detalle en `CLAUDE.md` → "Estado actual").

## Pendiente conocido

- **Pruebas e2e de descargas en la nube:** el archivo llega con nombre `download` en vez del nombre real
  (CA-0013-38, CA-0013-14, CA-0013-15/16, CA-0011-17, CA-0017-05). **No es un error de Profe:** el 2026-11-20 se
  probó con un servidor mínimo (sin Profe ni service worker) y el Chromium preinstalado de este contenedor da
  `download` incluso con `Content-Disposition` correcto, y no dispara la descarga de un enlace `blob:` con
  `download`. En una máquina normal deberían pasar; si fallan allí, revisar entonces.
- SPEC-0012: recorrido guiado con el usuario.
- SPEC-0013: validación manual en un iPhone real y recorrido con docentes.
- SPEC-0014: recorrido con docentes.

## Siguientes candidatos (por priorizar)

- Planes de aula (Fase 6).
- Preguntas tipo Saber/ICFES para exámenes.
- Formatos propios para quices y exámenes.

## Notas del entorno

- En la nube no hay Docker: PostgreSQL 16 local en el puerto 5434 sirve para las e2e
  (`initdb` con usuario `profe`, bases `profe` y `profe_test`).
- El proyecto "movil" de Playwright (iPhone 13) tiene 390 × 664 px visibles, no 844.
