# SPEC-0021 — Mejora continua de la IA con lo que hace el docente

| Campo                    | Valor                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                                             |
| Fase del roadmap         | 6 · Generation (evaluación docente que alimenta la mejora) y §20 del plan maestro (observabilidad de IA) |
| Módulo(s) responsable(s) | `modules/resources` · `modules/generation` · `ai-engine/app/generation` · `ai-engine/app/cli.py`         |
| Agentes                  | product, architect, ai-engine, backend, frontend, privacy, qa, reviewer                                  |
| ADR relacionados         | **ADR-0016: señales del docente para mejorar la IA** · se apoya en ADR-0007, ADR-0008 y SPEC-0008        |
| Autor / Fecha            | product / 2026-11-20                                                                                     |

## 1. Objetivo

Hoy Profe guarda las estrellas, los 👍/👎, las ediciones y las regeneraciones del docente, pero lo único que
cambia la siguiente generación son las preferencias que el docente escribe a mano (SPEC-0008 RN-07). Esta spec
cierra el ciclo de tres formas:

1. **Profe propone preferencias** a partir de lo que el docente hace, y el docente las acepta o las descarta.
2. **Un validador de calidad de preguntas**, determinista y sin gastar cupo de IA, detecta los defectos
   típicos de una prueba (la correcta siempre es la más larga, siempre en la misma posición…).
3. **Los casos reales mal calificados se vuelven pruebas** del benchmark, y las métricas usan señales
   implícitas (cuánto editó, qué borró, si lo descargó sin cambios), no solo las estrellas.

## 2. Alcance

**Incluye:**

- Parte A — Preferencias propuestas:
  - detectar patrones en las señales del docente: ediciones (versión de la IA frente a la última del docente),
    👎 con comentario, indicaciones de regeneraciones aceptadas y comentarios de la calificación del recurso;
  - pedirle al AI Engine que las resuma en 1 a 3 preferencias cortas (contrato nuevo
    `generation-preference-suggestions.v1`);
  - mostrarlas al docente, que puede editarlas, elegir su alcance (este curso o todos) y aceptarlas o
    descartarlas. Al aceptarlas se crean como `TeacherPreference` (RN-07 de SPEC-0008, sin cambios).
- Parte B — Validador de calidad de preguntas en el AI Engine para quices y exámenes:
  - sesgo de la opción más larga, posición de la correcta, distractores repetidos entre preguntas, verbo
    coherente con el nivel cognitivo pedido y longitud del enunciado según el grado;
  - sus errores entran a la reparación que ya existe; la posición de la correcta se corrige reordenando,
    sin llamar al modelo.
- Parte C — Casos reales y métricas:
  - comando que extrae los recursos con 👎 y comentario (o 1–2 estrellas) como casos de regresión
    anonimizados del benchmark;
  - métricas implícitas por versión de prompt y modelo en `npm run metrics:resources`.

**No incluye (explícitamente):**

- Fine-tuning ni entrenamiento de modelos (Fase 12).
- Usar como ejemplos en el prompt lo que el docente aprobó (few-shot): spec aparte.
- Aprender entre docentes o compartir señales de un docente con otro (Fase 11).
- Un juez automático con LLM para el benchmark: los casos reales se revisan a mano (pregunta 4).
- Comparar versiones de prompt al azar en producción (A/B): spec aparte cuando haya volumen.
- Cambios a los talleres en la Parte B: el validador de calidad es para preguntas (quiz y examen).
- Planes de aula, PIAR y planeación: sus señales no se usan aquí.

## 3. Actores y permisos

| Actor                     | Puede                                                                               | No puede                                                   |
| ------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Docente                   | Ver las preferencias propuestas con su porqué, editarlas, aceptarlas o descartarlas | Ver propuestas o señales de otro docente                   |
| Administrador del colegio | —                                                                                   | Ver las señales, propuestas o preferencias de sus docentes |
| Equipo de Profe (scripts) | Correr métricas agregadas y extraer casos anonimizados para el benchmark            | Ver quién es el docente o el colegio de un caso; usar PIAR |
| AI Engine                 | Resumir señales en preferencias y validar la calidad de las preguntas               | Guardar nada; recibir datos personales                     |

## 4. Reglas de negocio

### Parte A — Preferencias propuestas

- **RN-01 — Señales que cuentan.** Por docente, en los últimos 60 días y solo de sus recursos (quiz, taller,
  examen):
  - ediciones de ítems: el texto de la versión de la IA frente al de la última versión del docente (solo los
    ítems que cambiaron);
  - 👎 por ítem con comentario;
  - indicaciones de regeneraciones aceptadas;
  - comentario de la calificación del recurso, cuando la calificación es de 1 a 3 estrellas.
- **RN-02 — Cuándo se propone.** Se calcula al marcar un recurso como listo o al abrir "Mis recursos", con
  un barrido perezoso, sin trabajos programados. Se propone solo si hay **al menos 3 recursos distintos con
  señales** desde la última propuesta. Como máximo **una propuesta por docente cada 7 días**.
- **RN-03 — La IA resume, el docente decide.** El AI Engine recibe las señales (RN-01, ya filtradas por
  RN-12) y las preferencias activas del docente, y devuelve de 1 a 3 preferencias. Cada una trae:
  - texto: imperativo, de 10 a 160 caracteres;
  - el porqué para el docente (p. ej. "acortaste 7 enunciados en 4 quices");
  - el alcance sugerido: el curso, si todas las señales son de un curso; si no, todos.

  Nada se guarda como preferencia sin que el docente lo acepte (teacher-in-control).

- **RN-04 — Sin repetir ni contradecir.** El AI Engine descarta lo que ya es una preferencia activa. Si una
  propuesta contradice una preferencia activa, la propuesta lo dice y, al aceptarla, se ofrece desactivar la
  anterior. Una propuesta descartada no se vuelve a proponer igual en 90 días (se compara el texto
  normalizado).
- **RN-05 — Aceptar.** Al aceptar se crea una `TeacherPreference` con el texto (editado o no) y el alcance
  elegido. Siguen aplicando los límites de RN-07 de SPEC-0008: 5 preferencias y 500 caracteres por
  generación.
- **RN-06 — Cupo.** Proponer preferencias no gasta el cupo de recursos. Tiene su propio límite: 1 llamada al
  día por docente. Si el AI Engine falla, no se muestra nada y se intenta en el siguiente barrido.

### Parte B — Validador de calidad de preguntas

Aplica a las preguntas de selección múltiple de quices y exámenes. Se mide sobre todo el quiz o sobre toda la
sección del examen. Los umbrales viven en una sola constante versionada (`QUALITY_RULES_VERSION`).

- **RN-07 — Opción más larga.**
  - Es error si, con 4 o más preguntas de selección múltiple, la correcta es estrictamente la más larga en más
    del 50 % de ellas.
  - En una pregunta, es error si la correcta mide más de 1,5 veces el promedio de los distractores y más de 30
    caracteres.
- **RN-08 — Posición de la correcta.** Ninguna posición puede tener más del 40 % de las correctas, ni la misma
  posición puede repetirse 4 veces seguidas.
  - No se corrige con el modelo: el AI Engine **reordena las opciones** con una semilla determinista y
    actualiza la respuesta.
  - No se reordenan las preguntas con opciones ordenadas ("1, 2, 3, 4", "de menor a mayor"), que detecta una
    regla simple.
- **RN-09 — Distractores repetidos.** Es error si el mismo distractor (texto normalizado) aparece en más de 2
  preguntas del mismo quiz o sección. Los de verdadero/falso no cuentan, ni los distractores cortos (3
  caracteres o menos) o solo numéricos, que se repiten con razón en Matemáticas.
- **RN-10 — Verbo y nivel cognitivo.** Una lista corta de verbos por nivel (Bloom, en español) marca **solo
  contradicciones claras**: un ítem de Analizar o más que solo pide definir, nombrar o enumerar, o un ítem de
  Recordar que pide justificar o crear. Lo dudoso no es error: queda como aviso en el log.
- **RN-11 — Longitud según el grado.** Máximo de palabras del enunciado, sin contar el texto de contexto o
  lectura. Si el enunciado tiene varios párrafos, se mide solo el último, que es la pregunta; el mensaje de
  reparación pide acortarla o poner el contexto en un párrafo aparte:

  | Grado         | Máximo de palabras |
  | ------------- | ------------------ |
  | Transición–2° | 25                 |
  | 3°–5°         | 40                 |
  | 6°–9°         | 60                 |
  | 10°–11°       | 80                 |

  Un enunciado más largo es error. Se arranca con estos umbrales y se ajustan con las métricas (decisión 3).

- **RN-12 — La calidad no tumba la generación.** Los errores de RN-07, RN-09, RN-10 (claros) y RN-11 entran
  a la reparación existente, con el mensaje concreto. Si algún intento quedó **solo** con errores de calidad,
  el recurso sale con el último de esos intentos y esos errores, junto con los avisos dudosos de RN-10, se
  guardan como avisos (`qualityWarnings` en `generation_logs`). Los errores de estructura siguen fallando
  como hoy. Aplica a generar quices y exámenes; regenerar un ítem queda igual.

### Parte C — Casos reales y métricas

- **RN-13 — Casos reales.** El comando `npm run benchmark:cases -w @profe/web` extrae los recursos con 👎 y
  comentario o con 1 a 2 estrellas en un JSONL con:
  - el contexto del blueprint (asignatura, grado, tema, objetivos, códigos de DBA, ajustes);
  - el ítem o recurso señalado y el comentario.

  Antes de escribir el archivo:
  - quita el id del docente y del colegio;
  - quita correos, teléfonos y nombres propios que no estén en el catálogo curricular;
  - deja un id opaco (hash con sal) para no duplicar casos.

  El archivo sale a una carpeta ignorada por git. Solo pasa al benchmark versionado
  (`benchmarks/generation-real-cases.jsonl`) después de una revisión humana (pregunta 4).

- **RN-14 — Correr los casos.** `benchmark-resources --real` genera cada caso con el prompt actual y deja,
  lado a lado, el ítem que se quejó, el comentario y el nuevo resultado, con los errores del validador.
  Una versión nueva de prompt no se adopta sin ese reporte.
- **RN-15 — Métricas implícitas.** `metrics:resources` agrega, por versión de prompt y modelo:
  - proporción de texto editado por ítem (distancia de edición normalizada entre la versión de la IA y la
    última);
  - ítems borrados y agregados por el docente;
  - recursos descargados (`resource.exported`) o marcados listos **sin editar**;
  - promedio de `qualityWarnings` y tasa de aceptación de las preferencias propuestas.

  Todo agregado, sin textos ni ids de docentes.

## 5. Entradas

- `POST /v1/generation/preference-suggestions` (contrato `generation-preference-suggestions.v1`, prompt
  `preference_suggestions.v1.md`):
  - `signals`: hasta 30, cada una con
    - `kind`: `EDIT` · `ITEM_DOWN` · `REGENERATION` · `RESOURCE_COMMENT`;
    - `resourceType`: `QUIZ` · `WORKSHOP` · `EXAM`;
    - `subject`, `grade`;
    - `before` y `after` (máximo 600 caracteres cada uno; solo en `EDIT`);
    - `comment` (máximo 300);
  - `activePreferences` (hasta 5);
  - `declined` (textos descartados en los últimos 90 días, hasta 10).
- Acciones del docente:
  - `acceptPreferenceSuggestion({ suggestionId, text, scope: "COURSE" | "ALL", courseId?, deactivateIds? })`;
  - `declinePreferenceSuggestion({ suggestionId })`.

  El mismo schema Zod valida el formulario y el servidor.

## 6. Salidas

- Tabla `preference_suggestions`:
  - `id`, `institutionId`, `membershipId`, `courseId?`, `text`, `reason`, `conflictsWith?`;
  - `status` (`PENDING` · `ACCEPTED` · `DECLINED`), `createdAt`, `decidedAt`, `generationId`;
  - FK compuestas `(id, institutionId)` (ADR-0004).
- Una tarjeta "Profe aprendió algo de ti" en "Mis recursos":
  - en escritorio, una tarjeta; en el celular, una hoja inferior;
  - lleva el porqué, el texto editable, el alcance y los botones "Usar de ahora en adelante" y "No, gracias";
  - si se acepta, aparece en la lista de preferencias que ya existe.
- `generation_logs`: columnas `qualityWarnings Int?` y `qualityRulesVersion String?`.
- Respuestas de quiz y examen del AI Engine con `qualityWarnings: string[]` (cambio aditivo del contrato).
- Archivo de casos (RN-13), reporte lado a lado (RN-14) y columnas nuevas en `metrics:resources` (RN-15).

## 7. Errores y casos límite

| Caso                                                      | Comportamiento esperado                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Señales de menos de 3 recursos                            | No se propone nada                                                         |
| El docente solo corrigió tildes u ortografía              | Las ediciones con distancia normalizada < 0,1 no cuentan como señal        |
| El AI Engine devuelve una preferencia que ya existe       | Se descarta; si no queda ninguna, no se muestra la tarjeta                 |
| El AI Engine falla o tarda más de 20 s                    | No se muestra nada; se reintenta en el siguiente barrido, respetando RN-06 |
| Dos pestañas aceptan la misma propuesta                   | La segunda recibe "Ya la decidiste" y no crea un duplicado                 |
| El docente borra el curso de la propuesta (archivado)     | La propuesta pasa a alcance "todos" o se descarta si era solo de ese curso |
| Un quiz con menos de 4 preguntas de selección múltiple    | RN-07 (sesgo global) y RN-08 no aplican; RN-07 por pregunta sí             |
| Opciones con orden natural ("2, 4, 6, 8")                 | No se reordenan (RN-08)                                                    |
| Pregunta con texto de lectura largo                       | RN-11 mide solo el enunciado, no el contexto                               |
| Tras 3 intentos quedan errores de calidad y de estructura | Falla como hoy (errores de estructura)                                     |
| Un comentario con correo o teléfono                       | Se quita antes de enviarlo al AI Engine y antes de extraer el caso         |
| Un PIAR                                                   | Nunca entra a señales, casos ni métricas                                   |

## 8. Criterios de aceptación

**Parte A**

- **CA-0021-01:** Dado un docente con ediciones y 👎 con comentario en 3 recursos distintos de los últimos 60
  días, cuando marca uno como listo, entonces se crea una propuesta `PENDING` con 1 a 3 preferencias y su
  porqué. Con señales en solo 2 recursos, no se crea.
- **CA-0021-02:** Dada una propuesta creada hace menos de 7 días, cuando se cumplen otra vez las condiciones,
  entonces no se crea otra.
- **CA-0021-03:** Dada una propuesta, cuando el docente edita el texto, elige "Solo este curso" y la acepta,
  entonces existe una `TeacherPreference` activa con ese texto y ese curso, y la siguiente generación del
  curso la envía en `preferences`.
- **CA-0021-04:** Dada una propuesta descartada, cuando las mismas señales la vuelven a producir en menos de
  90 días, entonces no se muestra.
- **CA-0021-05:** Dada una propuesta que contradice una preferencia activa, cuando el docente la acepta
  marcando "desactivar la anterior", entonces la anterior queda inactiva en la misma transacción.
- **CA-0021-06:** Dadas las señales de un docente, cuando se arma la petición al AI Engine, entonces solo
  lleva las claves del contrato, sin correos, teléfonos, nombres del docente ni ids, y nunca incluye datos de
  un PIAR.
- **CA-0021-07:** Dado otro docente o el administrador del mismo colegio, cuando intenta ver, aceptar o
  descartar la propuesta, entonces recibe "no encontrado" (acceso cruzado).
- **CA-0021-08:** Dado el AI Engine caído, cuando se calcula una propuesta, entonces "Mis recursos" carga sin
  error y sin tarjeta, y no se gasta el cupo de recursos.
- **CA-0021-09:** Dado el celular a 360 px, cuando aparece la propuesta, entonces se abre en una hoja
  inferior que se cierra con Atrás, sin violaciones de axe.

**Parte B**

- **CA-0021-10:** Dado un quiz de 6 preguntas de selección múltiple donde la correcta es la más larga en 4,
  cuando se valida, entonces hay un error de RN-07 y el mensaje de reparación lo dice.
- **CA-0021-11:** Dado un quiz donde 5 de 8 correctas están en la posición B, cuando termina la generación,
  entonces las opciones quedan reordenadas: ninguna posición pasa del 40 % ni se repite 4 veces seguidas,
  cada `answer` sigue siendo exactamente una de sus opciones y no hubo otra llamada al modelo. Las preguntas
  con opciones "2, 4, 6, 8" conservan su orden.
- **CA-0021-12:** Dado el mismo distractor en 3 preguntas, cuando se valida, entonces hay un error de RN-09.
- **CA-0021-13:** Dado un ítem de nivel Analizar con el enunciado "Define qué es una fracción", cuando se
  valida, entonces hay un error de RN-10. Un caso dudoso solo deja un aviso.
- **CA-0021-14:** Dado un enunciado de 45 palabras en grado 2°, cuando se valida, entonces hay un error de
  RN-11. El mismo enunciado en 7° no lo tiene.
- **CA-0021-15:** Dado un modelo que en los 3 intentos deja solo errores de calidad, cuando termina,
  entonces el recurso queda en borrador y `generation_logs.qualityWarnings` registra cuántos. Si quedan
  errores de estructura, falla como hoy.
- **CA-0021-16:** Dado el benchmark de exámenes y quices con `--mock`, cuando se corre, entonces pasa con
  las reglas nuevas.

**Parte C**

- **CA-0021-17:** Dados recursos con 👎 y comentario en dos colegios, cuando se corre `benchmark:cases`,
  entonces el JSONL trae el contexto y el comentario, sin ids de docente ni de colegio, sin correos ni
  teléfonos, con id opaco estable, y no incluye ningún PIAR.
- **CA-0021-18:** Dado un caso real, cuando se corre `benchmark-resources --real --mock`, entonces el reporte
  muestra el ítem original, el comentario, el resultado nuevo y los errores del validador.
- **CA-0021-19:** Dados recursos editados, descargados sin editar y con ítems borrados, cuando se corre
  `metrics:resources`, entonces cada grupo de versión de prompt y modelo trae la proporción editada, los
  ítems borrados y agregados, los recursos descargados sin editar y la tasa de aceptación de propuestas, con
  valores correctos.

## 9. Seguridad y privacidad

- Tenancy: las señales, propuestas y preferencias filtran por `institutionId` y `membershipId`. La tabla
  nueva usa FK compuestas y lleva una prueba de acceso cruzado (CA-0021-07).
- Al AI Engine van solo textos de ítems (sin datos de estudiantes por SPEC-0008) y comentarios pasados por
  `redactContactData`. Nunca van el nombre del docente, ids ni nada del PIAR.
- Las señales de un docente nunca se usan para otro docente.
- Los casos reales salen anonimizados y quedan fuera de git hasta la revisión humana (RN-13).
- Auditoría: aceptar y descartar propuestas quedan en la auditoría con el id, sin el texto.
- Logs: sin textos de ítems ni comentarios; solo conteos.
- Hay que decir en la política de privacidad y los términos que las calificaciones y ediciones se usan para
  mejorar Profe (pregunta 5).

## 10. Tareas

- [x] T1 — ADR-0016: señales del docente, contrato `generation-preference-suggestions.v1`, `qualityWarnings`
      aditivo y casos reales fuera de git — architect
- [x] T2 — Tabla `preference_suggestions`, columnas de `generation_logs` y migración — database
- [x] T3 — Validador de calidad (RN-07 a RN-12), reordenamiento determinista y pruebas — ai-engine
- [x] T4 — Endpoint y prompt `preference_suggestions.v1`, validación y pruebas — ai-engine
- [x] T5 — Señales, barrido, límites, aceptar y descartar (`modules/resources`) — backend
- [x] T6 — Tarjeta y hoja inferior "Profe aprendió algo de ti" — frontend
- [x] T7 — `benchmark:cases`, `--real` y métricas implícitas — backend, ai-engine
- [x] T8 — Revisión de privacidad (señales, anonimización, textos legales) — privacy
- [x] T9 — Pruebas por CA (unitarias, integración con acceso cruzado, E2E en el celular) — qa
- [x] T10 — Revisión contra la spec — reviewer

## 11. Decisiones (2026-11-20)

El usuario aprobó la spec con las recomendaciones de producto:

1. **Dónde se muestra:** una tarjeta en "Mis recursos"; en el celular, una hoja inferior. Sin avisos del
   navegador por ahora.
2. **Frecuencia:** como máximo una propuesta por semana y con señales de al menos 3 recursos.
3. **Umbrales:** se arranca con los de RN-07 a RN-11 y se ajustan con las métricas (`qualityWarnings` y
   ediciones). Cambiar un umbral sube `QUALITY_RULES_VERSION`.
4. **Casos reales:** el archivo extraído queda fuera de git (`benchmarks/real/`). Lo revisa el product owner
   antes de pasarlo al benchmark versionado. Sin juez automático con IA por ahora.
5. **Términos:** correr `benchmark:cases` contra la base de producción exige antes publicar la política de
   privacidad y los términos que digan que las calificaciones y ediciones se usan para mejorar Profe. Las
   partes A y B y las métricas agregadas no dependen de eso: usan los datos del mismo docente para él o solo
   conteos.

## 12. Implementación (2026-11-20)

- **AI Engine:**
  - `app/generation/quality.py` (`quality.v1`): RN-07 a RN-11 y `balance_positions` (RN-08, semilla
    de los enunciados, sin tocar opciones en orden natural).
  - `pipeline.run_structured(quality=…)` separa los errores de calidad de los de estructura y devuelve
    `warnings` (RN-12). Quiz y examen (solo secciones de selección múltiple, verdadero/falso y
    respuesta corta) lo usan; regenerar un ítem queda igual.
  - Preferencias propuestas: `app/generation/preferences.py`, `prompts/preference_suggestions.v1.md` y
    `POST /v1/generation/preference-suggestions`. Lo activo y lo descartado se quita sin llamar al
    modelo (`drop_known`); la respuesta puede ser vacía.
  - `benchmark-resources --real [ruta]`: reporte lado a lado en `benchmarks/real/` (ignorada por git).
    El examen todavía no se corre con casos reales: queda marcado como omitido.
  - Mock con distractores propios por pregunta.
  - Pruebas: `tests/test_quality.py` y `tests/test_preferences.py`.
- **Web:**
  - Migraciones `20261120200000_preference_suggestions`: tabla `preference_suggestions` y
    `generation_logs.qualityWarnings` / `qualityRulesVersion`.
  - `modules/resources/edits.ts`: textos por ítem y distancia de edición, compartidos por señales y
    métricas.
  - `modules/resources/suggestions.ts`: señales, barrido con límites, aceptar y descartar. Se revisa
    después de responder al marcar listo y al abrir "Mis recursos"; fuera de una petición se omite.
  - `components/preference-suggestion.tsx`: tarjeta en escritorio; franja y hoja inferior en el celular.
  - `modules/resources/benchmark-cases.ts` y `npm run benchmark:cases -w @profe/web`, con una sal local
    en `apps/ai-engine/benchmarks/real/.salt`.
  - `metrics:resources` suma `editedShare`, `itemsDeleted`, `itemsAdded`, `exportedUnedited`,
    `readyUnedited`, `averageQualityWarnings` y la aceptación de propuestas.
  - Pruebas: `tests/integration/spec-0021.test.ts` (CA-01 a 08, 15, 17 y 19) y
    `tests/e2e/spec-0021*.spec.ts` (CA-04 y CA-09).
- **Pendiente fuera del código:** publicar la política de privacidad y los términos antes de correr
  `benchmark:cases` contra producción (decisión 5), y que el product owner revise los primeros casos.
