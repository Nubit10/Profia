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

- **SPEC-0019** — Asistente de crear un paso por pantalla
  ([spec](specs/SPEC-0019-asistente-un-paso-por-pantalla.md)), implementada el 2026-11-20.
  - Curso y Tema son pasos separados (examen: Curso → Temas → Ajustes → Confirmar); elegir avanza a otra
    pantalla. Lo elegido se ve en los pasos (escritorio) o en fichas (celular) y tocarlo lo cambia.
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

- **Pruebas e2e de descargas que ya fallaban antes de SPEC-0018:** el archivo descargado llega con nombre
  `download` en vez del nombre real. Fallan: CA-0013-38 (`spec-0013-offline.spec.ts`, sin red), CA-0013-14 y
  CA-0013-15/16 (`spec-0013.spec.ts`, .zip) y CA-0011-17 (`exams.spec.ts`, clave del examen).
  Comprobado: falla igual sin los cambios de SPEC-0018. Revisar cómo el service worker / la página
  `/offline` arma el nombre del archivo (`Content-Disposition` o atributo `download`).
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
