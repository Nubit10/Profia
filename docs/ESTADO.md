# Estado del trabajo (2026-11-20)

Bitácora para retomar el trabajo después de borrar la conversación. **Se actualiza al cerrar cada tarea**
(qué se hizo, qué quedó a medias y con qué seguir). Lo más reciente va arriba de cada sección.

## En curso

- **SPEC-0024** — Plan de aula y rúbrica en la escala del colegio
  ([spec](specs/SPEC-0024-plan-de-aula-y-escala-de-valoracion.md), ADR-0019). **Pausada por el usuario**
  el 2026-11-20 ("para ahora; haz los specs uno por uno y dame resultados").
  - Hecho: spec y ADR-0019; AI Engine completo (`app/generation/lesson_plan.py`, prompt
    `lesson_plan.v1`, `POST /v1/generation/lesson-plan`, mock y `tests/test_lesson_plan.py`; 189 pruebas
    en verde).
  - Falta: web (`ResourceType.LESSON_PLAN`, `institutions.gradingBands` y migración, blueprint y
    contenido, generación, página "Escala de valoración", asistente, editor, Word/PDF), pruebas y
    revisión.
  - Después: SPEC-0025 (resultados → dificultades → refuerzo) y SPEC-0026 (validación con docentes),
    una por una y esperando al usuario entre cada una.

- **SPEC-0020** — Material de referencia del docente ([spec](specs/SPEC-0020-material-de-referencia.md)).
  Estado: **Borrador**, esperando que el usuario responda las 3 preguntas abiertas y la apruebe.
  - Pedido: cuando la asignatura no tiene DBA, que el docente pueda subir un PDF, pegar contenido, dar el
    nombre de un libro o una página web para que el taller/quiz/examen se haga con eso.
  - Propuesta: primero PDF, Word y texto pegado; enlaces después; el libro solo como referencia (la IA
    no lo tiene). Necesita un ADR antes de implementar (texto de terceros a la IA, lectura segura de enlaces).
  - Siguiente paso: aprobación → ADR → `/implement SPEC-0020`.

## Hecho

- **SPEC-0023** — Preguntas tipo Saber (ICFES) con situación, figura y competencia
  ([spec](specs/SPEC-0023-preguntas-tipo-saber-con-figuras.md), ADR-0018), implementada el 2026-11-20.
  - Interruptor "Estilo Saber (ICFES)" en quiz y examen (Matemáticas y Lenguaje; se recuerda).
  - Figuras dibujadas por código (recta, barras, tabla, fracción, rectángulo) en el editor, el PDF y el
    Word (PNG con resvg y la Roboto de pdfmake).
  - Pendiente: revisión docente del catálogo de competencias; contexto compartido entre preguntas.
  - Siguen SPEC-0024 (planes de aula y rúbricas), SPEC-0025 (resultados → refuerzo) y SPEC-0026
    (validación con docentes).

- **SPEC-0022** — Verificar las respuestas de Matemáticas
  ([spec](specs/SPEC-0022-verificar-respuestas-de-matematicas.md), ADR-0017), implementada el 2026-11-20.
  Primera de las recomendaciones que el usuario pidió hacer ("hazlo lo que recomendaste"); siguen
  SPEC-0023 (Saber/ICFES con figuras), SPEC-0024 (planes de aula y rúbricas en la escala del colegio),
  SPEC-0025 (resultados → dificultades → refuerzo) y SPEC-0026 (validación con docentes).
  - El modelo escribe el cálculo (`check`); el motor lo evalúa exacto y seguro, marca cada pregunta como
    verificada, corregida o por revisar, y el editor lo muestra.
  - Pruebas: AI Engine 170; web 299; e2e spec-0022 en verde.

- **SPEC-0021** — Mejora continua de la IA con lo que hace el docente
  ([spec](specs/SPEC-0021-mejora-continua-con-el-docente.md), ADR-0016), implementada el 2026-11-20 con
  las recomendaciones de producto (el usuario aprobó "hazlo todo con tus recomendaciones").
  - A: Profe propone preferencias a partir de ediciones, 👎 con comentario, regeneraciones aceptadas y
    comentarios de 1–3 estrellas (60 días, ≥ 3 recursos, una por semana, 1 llamada al día). Tarjeta
    "Profe aprendió algo de ti" en "Mis recursos" (hoja inferior en el celular); el docente edita, elige el
    alcance y acepta o descarta.
  - B: validador de calidad `quality.v1` en el AI Engine (opción más larga, posición de la correcta
    reordenando, distractores repetidos, verbo y nivel, palabras por grado). No tumba la generación: lo
    que queda va a `generation_logs.qualityWarnings`.
  - C: `npm run benchmark:cases -w @profe/web` (casos anonimizados en `apps/ai-engine/benchmarks/real/`,
    fuera de git) y `benchmark-resources --real`; `metrics:resources` con señales implícitas.
  - Revisión (reviewer): Aprobado; se corrigió que un 👎 reciente en un recurso viejo no contaba.
  - Pruebas: AI Engine 146; web 298 unitarias e integración; build; e2e spec-0021 (2) en verde. Las e2e que
    revisan el nombre de un archivo descargado fallan en este entorno ("download"): no es de esta spec.
  - Pendiente: política de privacidad y términos antes de correr `benchmark:cases` en producción;
    revisión de los primeros casos reales; ajustar umbrales con las métricas.

- **PIAR sin autorización obligatoria para el docente independiente**, 2026-11-20 (decisión del usuario).
  - "Nuevo PIAR" del docente independiente ya no tiene casilla: muestra el aviso "Recuerda contarle al
    acudiente…" y `piars.consentAt` queda null (migración `20261120180000_piar_consent_optional`). En el
    espacio de un colegio la casilla sigue siendo obligatoria y el servidor la exige (`createPiar`).
  - Se le advirtió al usuario el riesgo: la Ley 1581 (arts. 6 y 7) pide autorización para datos
    sensibles de menores; el modelo de autorización queda como respaldo opcional.
  - Pruebas: integración spec-0017 (10) en verde; e2e: los pasos de crear pasan, pero
    `spec-0017.spec.ts:93` falla aquí porque el PDF descargado llega como "download" (no se tocó la
    exportación; revisar en el computador del usuario).

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
