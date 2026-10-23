# SPEC-0011 — Exámenes con IA

| Campo                    | Valor                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Estado                   | En implementación                                                                                     |
| Fase del roadmap         | 6 · Generation (con exportación de 7 · Documents)                                                     |
| Módulo(s) responsable(s) | `modules/resources`, `modules/documents`, `apps/ai-engine` (generation, validation, prompts)          |
| Agentes                  | product, domain, assessment, ai-engine, backend, database, documents, frontend, privacy, qa, reviewer |
| ADR relacionados         | ADR-0004 (tenancy), ADR-0007 (inferencia por etapas), ADR-0008 (segundo plano), ADR-0009, ADR-0010    |
| Autor / Fecha            | product / 2026-10-05 · decisiones y ajuste a SPEC-0012: 2026-10-10                                    |

## 1. Objetivo

Que el docente genere el **examen** de una unidad o de un periodo: más largo y formal que un quiz, cubre **varios temas**, se organiza en **secciones por tipo de pregunta** y tiene **puntaje**. Lo revisa, lo edita, lo evalúa y lo descarga en Word y PDF con su clave, una hoja de respuestas opcional, sus versiones A–D y el logo de la institución. Reutiliza todo lo de talleres y quices (SPEC-0008, SPEC-0009 y SPEC-0010) y agrega solo lo propio del examen.

## 2. Alcance

**Incluye:**

- **Blueprint del examen** (plan maestro §9 y §12, `AssessmentBlueprint`): temas que cubre, objetivos, duración, dificultad, secciones (tipo de pregunta, número de preguntas y puntos por pregunta), distribución cognitiva, puntaje total e indicaciones.
- **Alcance por varios temas:** el docente parte de una **unidad** o de un **periodo** de su planeación ("Crear examen del periodo 2") y ve sus temas marcados; puede quitar temas o agregar **cualquier tema del mismo curso**, de otras unidades o periodos (sirve para un examen final acumulativo, decisión 5).
- **Creación desde el asistente de SPEC-0012:** "Crear → Examen" deja de estar en "Próximamente" y abre `/create?type=EXAM`. El paso "Curso y tema" pasa a "Curso y temas" con selección múltiple; el paso de ajustes trae secciones y puntos con valores por defecto según el grado y lo avanzado en "Más opciones". La planeación ofrece "Crear examen de esta unidad" y "Crear examen del periodo", que abren el asistente con esos temas marcados.
- **Secciones por tipo de pregunta**, en el orden que elija el docente. Tipos: los del quiz (selección múltiple con única respuesta, verdadero/falso, respuesta corta) y dos nuevos (ver pregunta 1):
  - **Emparejamiento:** dos columnas (4–8 pares) para relacionar.
  - **Pregunta abierta:** el estudiante desarrolla o resuelve; lleva **criterios de calificación** con su puntaje para la clave.
- **Puntaje:** cada sección tiene puntos por pregunta; el examen muestra el total. El docente puede cambiar los puntos de una pregunta al editar. La clave trae una **tabla de conversión a la escala 1,0–5,0**, que el docente ajusta (decisión 2).
- **Cobertura:** cada tema elegido tiene al menos una pregunta (si hay más temas que preguntas, el formulario lo advierte antes de enviar).
- **Generación en segundo plano** como los quices (ADR-0008), con validación en el AI Engine (schema, validador pedagógico, reparación).
- **Revisión, edición con versiones, regeneración de una pregunta, evaluación docente y preferencias:** igual que en SPEC-0008, ahora también por sección.
- **Exportar** (SPEC-0009) en DOCX y PDF:
  - **Hoja del estudiante:** encabezado del curso con el logo (SPEC-0010), periodo, temas, duración, puntaje total, casilla de calificación, instrucciones generales y las secciones con sus instrucciones y el puntaje de cada pregunta.
  - **Clave:** respuesta correcta y justificación de cada pregunta, los pares correctos del emparejamiento y los criterios de calificación de las preguntas abiertas, con una tabla resumen de puntos por sección.
  - **Hoja de respuestas (opcional):** una tabla de casillas para marcar en las secciones de selección múltiple (A–D) y verdadero/falso (V/F), con el encabezado del curso y espacio para nombre y versión. Las demás secciones se responden en la hoja del examen (decisión 3).
  - **Versiones A–D:** las secciones conservan su orden; dentro de cada sección cambian el orden de las preguntas y de las opciones, y en el emparejamiento el de la segunda columna. Cada versión con su clave.
- **Biblioteca del curso:** el examen aparece con su tipo, los temas que cubre y su estado.

**No incluye (explícitamente):**

- Formato propio del docente para exámenes (subir su plantilla de examen): spec siguiente, extiende SPEC-0010.
- Aplicar el examen a estudiantes, calificar sus respuestas, resultados y analítica (Fase 8).
- Banco de preguntas reutilizables entre exámenes, y preguntas tipo Saber/ICFES con un contexto compartido por varias preguntas (decisión 1: spec siguiente).
- Imágenes, gráficos, fórmulas con editor de ecuaciones.
- Exámenes que mezclen cursos o asignaturas.
- Planes de aula (spec aparte).

## 3. Actores y permisos

| Actor                           | Puede                                                                             | No puede                                                 |
| ------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Docente dueño del curso         | Generar, ver, editar, regenerar preguntas, evaluar, duplicar, archivar, descargar | Incluir temas de otro curso; ver exámenes de otros       |
| Administrador de la institución | Lo mismo que hoy con talleres y quices (vista de solo lectura sigue en Fase 11)   | Editar o evaluar exámenes ajenos                         |
| Otra institución                | —                                                                                 | Ver, descargar ni inferir por ID (respuesta `NOT_FOUND`) |

## 4. Reglas de negocio

- **RN-01:** Lo generado queda en **borrador** hasta que el docente lo marca como listo (igual que SPEC-0008 RN-01).
- **RN-02:** Todos los temas del examen pertenecen al mismo curso del docente y no están archivados; pueden ser de cualquier unidad o periodo de ese curso. Mínimo 1, máximo 12 temas.
- **RN-03:** El examen cumple el blueprint: número exacto de preguntas por sección, solo los tipos de cada sección, distribución cognitiva con tolerancia de ±1 pregunta por nivel en todo el examen, al menos una pregunta por tema elegido y reglas del quiz para selección múltiple (una sola correcta, opciones sin duplicados, sin "todas/ninguna de las anteriores").
- **RN-04:** Emparejamiento: entre 4 y 8 pares, sin elementos repetidos en ninguna columna; la columna de respuestas puede tener hasta 2 distractores adicionales.
- **RN-05:** Pregunta abierta: tiene entre 1 y 4 criterios de calificación cuyos puntos suman los puntos de la pregunta. Los criterios van solo en la clave.
- **RN-06:** Puntaje: los puntos son números positivos con máximo un decimal. El total del examen es la suma de las preguntas y se recalcula al editar. El docente elige el total al configurar (por defecto, 100) y Profe reparte los puntos por sección según el número de preguntas y su tipo; el docente puede ajustarlos.
- **RN-07:** Cada pregunta cita el tema que evalúa (de los elegidos) y solo DBA presentes en el contexto; un tema o código fuera del contexto invalida la salida y pide reparación.
- **RN-08:** Al AI Engine solo viaja contexto pedagógico (SPEC-0008 RN-02): asignatura, grado, temas, objetivos, DBA con evidencias, blueprint e indicaciones. Nunca nombres, correos, institución ni datos de estudiantes. El contrato rechaza campos adicionales.
- **RN-09:** Tamaño: de 2 a 5 secciones y de 10 a 40 preguntas en total (selección múltiple, verdadero/falso y respuesta corta: hasta 20 por sección; emparejamiento: hasta 2 bloques por sección; abiertas: hasta 5 por sección).
- **RN-10:** Si el examen es grande para el límite por minuto de Groq, el AI Engine puede generarlo **por secciones** en varias llamadas y unirlas; para el docente sigue siendo una sola generación y una sola entrada en la biblioteca. Cada llamada queda en `generation_logs`.
- **RN-11:** Cupo: un examen cuenta como **2 recursos** del cupo diario de SPEC-0008 RN-06 (decisión 4) y como 1 de las 3 generaciones en curso. La línea de cupo del menú (SPEC-0012 RN-12) usa el mismo conteo, y el asistente avisa desde el primer paso si no alcanza.
- **RN-12:** Trazabilidad (SPEC-0008 RN-09): el examen guarda la copia del contexto de **todos** sus temas, objetivos y DBA; si un tema se borra después, el examen y sus descargas no cambian.
- **RN-13:** Versiones A–D (SPEC-0009 RN-07): barajado determinista, sin mover preguntas entre secciones; verdadero/falso conserva su orden; cada versión tiene su clave con las letras y los pares de esa hoja.
- **RN-14:** Conversión a nota: la tabla de la clave va de 1,0 a 5,0 con un decimal, es lineal desde 0 puntos (1,0) hasta el total (5,0) y marca la nota mínima aprobatoria (por defecto 3,0). El docente puede cambiar la nota mínima y el puntaje con el que se aprueba; la tabla no modifica los puntos del examen.
- **RN-15:** Hoja de respuestas: solo se ofrece si el examen tiene al menos una sección de selección múltiple o de verdadero/falso. En las versiones A–D la hoja es la misma (las casillas no dependen del orden); la clave de cada versión dice qué marcar.

## 5. Entradas

**Blueprint del examen** (mismo schema Zod en formulario y servidor):

| Campo                   | Tipo / validación                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                  | `EXAM`                                                                                                                                                                 |
| `scope`                 | `{ kind: "UNIT", unitId }` · `{ kind: "PERIOD", periodNumber }` · `{ kind: "TOPICS" }`; solo indica de dónde partió el docente                                         |
| `topicIds`              | 1–12 temas del curso (RN-02)                                                                                                                                           |
| `objectiveIds`          | opcional, 0–15 objetivos de esos temas; si no hay, se usan los títulos y descripciones de los temas                                                                    |
| `durationMinutes`       | 30–240                                                                                                                                                                 |
| `difficulty`            | `BASIC` · `INTERMEDIATE` · `ADVANCED`                                                                                                                                  |
| `sections`              | 2–5: `{ questionType, questionCount, pointsPerQuestion, instructions? }`; `questionType` ∈ `MULTIPLE_CHOICE`, `TRUE_FALSE`, `SHORT_ANSWER`, `MATCHING`, `OPEN` (RN-09) |
| `totalPoints`           | 10–100 (por defecto 100); reparte los `pointsPerQuestion` sugeridos (RN-06)                                                                                            |
| `cognitiveDistribution` | porcentajes por nivel; suman 100                                                                                                                                       |
| `notes`                 | opcional, máx. 500 caracteres ("sin calculadora", "incluir una pregunta de la salida de campo")                                                                        |

Valores por defecto según el grado (p. ej. Transición–3°: 2 secciones, 10–15 preguntas, sin preguntas abiertas largas; bachillerato: 3–4 secciones con una abierta).

**Contrato nuevo del AI Engine:** `generation-exam.v1` (y su variante por sección si aplica RN-10), en [generation-resources.v1](../ai/contracts/generation-resources.v1.md). `generation-item-regenerate.v1` se amplía a los tipos nuevos como versión nueva del contrato.

**Configuración de la clave:** `gradingScale` opcional `{ passingGrade: 1.0–5.0 (por defecto 3.0), passingPoints?: número ≤ totalPoints }` (RN-14), editable después de generar sin crear versión nueva del contenido.

**Rutas:** la descarga usa el mismo route handler de SPEC-0009 (`doc=student|key|answers`, `variant=A|B|C|D`); `answers` es la hoja de respuestas (RN-15). En la UI sigue el único botón "Descargar" de SPEC-0012.

## 6. Salidas

- `Resource` con `type = EXAM` y relación con **varios temas** (hoy un recurso tiene un solo tema; el modelo de datos se amplía, ver §10 T2).
- `ResourceVersion` con el contenido validado: secciones → preguntas, cada una con tipo, enunciado, opciones o pares, respuesta, justificación o criterios, puntos, tema, DBA y nivel cognitivo.
- `GenerationLog` por cada llamada (RN-10), evaluaciones y preferencias como en SPEC-0008.
- Documentos DOCX y PDF (hoja, clave con tabla de conversión, hoja de respuestas opcional, versiones A–D) con evento de auditoría `resource.exported`.
- Las métricas por versión de prompt (`metrics:resources`) incluyen el examen.

## 7. Errores y casos límite

| Caso                                                         | Comportamiento esperado                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Más temas que preguntas                                      | El formulario lo advierte y no deja enviar hasta ajustar (RN-03)                                              |
| Un tema o la unidad se archiva mientras se genera            | La generación termina con la copia del contexto; el examen queda en borrador                                  |
| Unidad o periodo sin temas                                   | El botón "Crear examen" no aparece o explica que primero hay que planear temas                                |
| Falla una sección cuando se genera por secciones (RN-10)     | Se reintenta esa sección; si no hay salida válida tras 3 intentos, el examen queda en `FAILED` con Reintentar |
| Los puntos editados no suman el total pedido                 | Se permite; el examen muestra el total real y un aviso suave ("suma 95 de 100")                               |
| Criterios de una abierta no suman sus puntos                 | El editor no deja guardar y muestra la diferencia                                                             |
| Emparejamiento con menos de 4 pares tras editar              | El editor no deja guardar                                                                                     |
| Temas de asignatura sin DBA (p. ej. Religión)                | Se genera con temas y objetivos, sin citas, con el aviso de SPEC-0008                                         |
| Cupo diario insuficiente para un examen (queda 1 y cuesta 2) | Mensaje con la hora en que se libera; no se llama a la IA                                                     |
| Examen sin secciones de selección múltiple ni V/F            | "Hoja de respuestas" no aparece en el menú Descargar (RN-15)                                                  |
| El docente pone una nota mínima fuera de 1,0–5,0             | El formulario no deja guardar                                                                                 |
| Examen largo en PDF                                          | Las preguntas no se parten entre páginas; el emparejamiento se mantiene en una tabla de dos columnas          |

## 8. Criterios de aceptación

- **CA-0011-01:** Dada una unidad con 3 temas, cuando el docente elige "Crear examen de la unidad", entonces el formulario muestra los 3 temas marcados y puede quitar uno o agregar otro tema del mismo curso; un tema de otro curso se rechaza.
- **CA-0011-02:** Dado un blueprint con 3 secciones, cuando se genera, entonces el examen queda en borrador con las secciones en ese orden, el número exacto de preguntas y el tipo de cada sección, al menos una pregunta por tema elegido y solo DBA del contexto.
- **CA-0011-03:** Dada una salida del modelo que no cumple el blueprint (cantidad por sección, tema sin pregunta, tema o DBA inventado, emparejamiento con pares repetidos, criterios que no suman), cuando el AI Engine la valida, entonces pide reparación con el error concreto y, tras 3 intentos, responde `502`.
- **CA-0011-04:** Dado un examen generado, cuando el docente cambia los puntos de una pregunta y guarda, entonces se crea una versión nueva, el total se recalcula y la versión original generada se conserva.
- **CA-0011-05:** Dada una pregunta abierta, cuando el docente edita sus criterios y no suman los puntos de la pregunta, entonces no puede guardar y ve la diferencia.
- **CA-0011-06:** Dada una pregunta de emparejamiento o abierta, cuando el docente pide regenerarla con una indicación, entonces recibe una propuesta del mismo tipo que puede aceptar o descartar.
- **CA-0011-07:** Dado un examen, cuando el docente descarga la hoja del estudiante en PDF y DOCX, entonces tiene el logo, el encabezado del curso con periodo y temas, la duración, el puntaje total, la casilla de calificación y las secciones con el puntaje de cada pregunta, **sin respuestas, justificaciones ni criterios**.
- **CA-0011-08:** Dado un examen, cuando descarga la clave, entonces incluye la respuesta y justificación de cada pregunta, los pares correctos, los criterios de las abiertas y la tabla de puntos por sección.
- **CA-0011-09:** Dada la versión B, entonces tiene las mismas secciones en el mismo orden, las preguntas de cada sección y sus opciones en otro orden, la segunda columna del emparejamiento barajada, y su clave usa las letras y pares de la hoja B; descargarla de nuevo da el mismo orden.
- **CA-0011-10:** La petición al AI Engine no contiene nombre, correo ni institución, y el contrato rechaza campos adicionales (`422`).
- **CA-0011-11:** Dado que al docente le queda 1 recurso de cupo, cuando intenta generar un examen, entonces recibe el mensaje de cupo y no se llama a la IA.
- **CA-0011-12:** Un examen, su contenido, sus evaluaciones o su descarga de otra institución o de otro docente responden `NOT_FOUND` (acceso cruzado).
- **CA-0011-13:** Dado un examen generado, cuando se archiva uno de sus temas, entonces el examen conserva el título del tema y sus descargas no cambian.
- **CA-0011-14:** El benchmark de generación incluye ≥ 5 casos de examen (varias áreas y grados, con 20 y 40 preguntas) y reporta tasa de salidas válidas, intentos, latencia, tokens y número de llamadas; su resultado queda versionado.
- **CA-0011-15:** Dado un examen con una sección de selección múltiple y una abierta, cuando el docente descarga la hoja de respuestas, entonces trae casillas A–D solo para las preguntas de selección múltiple, numeradas como en el examen; en un examen sin selección múltiple ni V/F la opción no aparece.
- **CA-0011-16:** Dado un examen de 100 puntos, cuando el docente descarga la clave, entonces trae la tabla de conversión a 1,0–5,0 con la nota mínima 3,0 marcada; si cambia la nota mínima, la siguiente descarga la refleja y el contenido del examen no cambia de versión.
- **CA-0011-17:** Dado un docente con un curso con temas en dos periodos, cuando usa "Crear → Examen", entonces el asistente le deja elegir temas de ambos periodos, aplica valores por defecto según el grado y llega a "Generar examen"; la landing ya no muestra Exámenes como "Próximamente".

## 9. Seguridad y privacidad

- **Tenancy:** la relación examen–temas es tabla de tenant con FK compuestas `(id, institutionId)`; servicios con `ctx: TenantContext`; test de acceso cruzado (CA-0011-12), incluido el intento de meter en el blueprint un tema de otro curso u otra institución.
- **Datos al modelo:** solo contexto pedagógico (RN-08). Notas, indicaciones y comentarios pasan por el filtro de correos y teléfonos de SPEC-0008 y van delimitados como datos.
- **Costo:** un examen de 40 preguntas puede usar 8.000–12.000 tokens (estimado a partir de ~2.000 por quiz de 10), por encima del límite por minuto de un modelo en Groq gratuito (8K). Por eso RN-10 (generar por secciones) y RN-11 (cuenta doble en el cupo). El benchmark (CA-0011-14) confirma o corrige estos números antes de cerrar la spec.
- **Auditoría:** generar, marcar listo, archivar, duplicar y descargar, como en SPEC-0008 y SPEC-0009.

**ADR:** no se requiere uno nuevo. La relación de un recurso con varios temas es un cambio de modelo dentro de `modules/resources`, y `generation-exam.v1` es un contrato versionado nuevo que sigue el patrón de SPEC-0008. Si el benchmark obliga a generar por secciones (RN-10), se agrega una nota a ADR-0008.

## 10. Tareas

- [x] T1 — Modelo de dominio del examen (secciones, tipos nuevos, puntos, criterios) en `content.ts` y schemas — domain, assessment
- [x] T2 — Migración: `ResourceType.EXAM`, relación recurso–temas (con `topicId` actual como tema principal o reemplazado por la relación) y datos existentes migrados — database
- [x] T3 — AI Engine: schema y validador del examen, prompt `exam.v1`, generación por secciones si hace falta, contrato `generation-exam.v1` e `item_regenerate` para los tipos nuevos — ai-engine
- [x] T4 — Benchmark de examen (≥ 5 casos) con Groq — ai-engine, qa
- [x] T5 — `modules/resources`: blueprint con alcance por unidad o periodo, cupo doble, cobertura, versiones, regeneración — backend
- [x] T6 — `modules/documents`: hoja y clave del examen, emparejamiento, espacio para abiertas, tabla de puntos, tabla de conversión a 1,0–5,0, hoja de respuestas, barajado por sección — documents
- [x] T7 — UI sobre el sistema de diseño de SPEC-0012: "Examen" en "Crear" y en el asistente `/create` (temas múltiples, secciones y puntos), "Crear examen" desde unidad y periodo, editor por secciones, nota mínima, "Mis recursos" y biblioteca con el tipo Examen, landing sin "Próximamente" — frontend
- [x] T8 — Revisión de privacidad del contrato nuevo — privacy
- [x] T9 — Tests unitarios, integración (con acceso cruzado) y E2E con el AI Engine de prueba — qa
- [ ] T10 — Revisión contra esta spec y DoD, con documentos reales abiertos — reviewer

## 11. Decisiones (resueltas por el usuario el 2026-10-10, con las recomendaciones de product)

1. **Tipos de pregunta:** se agregan emparejamiento y pregunta abierta con criterios. Las preguntas tipo Saber/ICFES quedan para una spec siguiente.
2. **Puntaje:** en puntos (100 por defecto), con una tabla de conversión a 1,0–5,0 en la clave que el docente ajusta (RN-14).
3. **Hoja de respuestas:** sí, como documento opcional en "Descargar" para selección múltiple y V/F (RN-15).
4. **Cupo:** un examen cuenta como 2 recursos del cupo diario (RN-11).
5. **Alcance de temas:** cualquier tema del mismo curso, de cualquier unidad o periodo (RN-02).
6. **Tamaño:** máximo 40 preguntas (RN-09); el benchmark de CA-0011-14 confirma que cabe en el límite de Groq generando por secciones.

## 12. Notas de implementación

**Datos (T2).**

- Migración `20261010230000_exams`:
  - agrega `EXAM` a `ResourceType`;
  - crea la tabla `resource_topics`, con FK compuestas `(id, institutionId)` hacia el recurso y el tema;
  - agrega la columna `resources.gradingScale` (escala de la clave, RN-14).
- Los talleres y quices existentes quedaron con su tema en `resource_topics`.
- `resources.topicId` sigue siendo el **tema principal**: en el examen es el primero.

**Dominio (T1, T5).**

- Los schemas viven en `modules/resources/schemas.ts`:
  - blueprint `EXAM` con alcance `UNIT`, `PERIOD` o `TOPICS`;
  - `examQuestionSchema` (emparejamiento y abierta con criterios), `examContentSchema` y `gradingScaleSchema`;
  - las funciones `distributePoints`, `gradeFor` y `examDefaultsForGrade`.
- El contexto de varios temas sale de `getTopicsGenerationContext` (planning). Valida que todos los temas sean del docente, del mismo curso y no estén archivados.
- `getExamFormContext` arma los datos del asistente y `setGradingScale` guarda la escala, que no crea versión del contenido.
- El cupo se pondera con `quotaCost`: el examen cuesta 2. El aviso dice cuándo se libera el cupo suficiente para ese examen.
- El título se arma según el alcance: "Examen: Números enteros", "Examen del periodo 2" o "Examen: La recta numérica y 2 temas más".
- Al guardar, los temas del examen salen de la copia hecha al generarlo; el cliente no los puede cambiar.

**AI Engine (T3).**

- El código está en `app/generation/exams.py` y los prompts en `exam.v1` y `exam_item.v1`.
- Los endpoints son `POST /v1/generation/exam` y `/v1/generation/exam/item`. Contrato: [generation-exam.v1](../ai/contracts/generation-exam.v1.md).
- Siempre se genera **por secciones**. Antes de llamar al modelo, el motor reparte:
  - los niveles, en orden de exigencia;
  - los temas, en rueda.
- La distribución cognitiva se valida acumulada. Así el examen completo queda con ±1 por nivel y cada tema tiene al menos una pregunta.
- **Reparación determinista:** el benchmark mostró una sección de 20 preguntas que llegó con 22 en los tres intentos. Ahora el pipeline acepta un paso `normalize`, y la sección se recorta a las preguntas que mejor cumplen los temas obligatorios y los niveles. El resultado vuelve a pasar por el validador completo.
- El modelo de prueba (`mock_llm.py`) genera exámenes válidos para CI y los E2E.

**Documentos (T6).**

- El constructor está en `modules/documents/build-exam.ts`.
- **Hoja del estudiante:**
  - secciones con su puntaje y los puntos de cada pregunta;
  - emparejamiento en tabla, con la columna B barajada también en la versión A;
  - 8 líneas para cada abierta y la casilla "Calificación".
- **Clave:**
  - respuesta y puntos de cada pregunta;
  - pares de emparejamiento como "1 → c";
  - criterios de calificación;
  - tablas de puntos por sección y de preguntas por tema;
  - conversión a 1,0–5,0 con la nota mínima marcada.
- **Hoja de respuestas** (`doc=answers`): casillas A–D (según el máximo de opciones de la sección) o V/F. Es la misma para todas las versiones.
- **Versiones B–D:** barajan dentro de cada sección.
- El modelo intermedio ganó un bloque `table` genérico, que dibujan los renderizadores DOCX y PDF.

**UI (T7).**

- "Crear → Examen" lleva a `/create?type=EXAM`.
- **Paso "Curso y temas":**
  - selección múltiple agrupada por periodo y unidad;
  - "Toda la unidad" y "Todo el periodo";
  - el alcance se conserva solo si lo marcado coincide exactamente con esa unidad o ese periodo.
- **Ajustes:**
  - secciones con tipo, cantidad y puntos;
  - el total se reparte solo, con el aviso "Suman X de Y" y la opción "Repartir";
  - en "Más opciones", objetivos, niveles, indicaciones y preferencias;
  - el borrador se guarda en `sessionStorage`.
- La planeación ofrece "Crear examen de esta unidad" y "Crear examen del periodo". No aparecen si la unidad o el periodo no tienen temas activos.
- **Editor por secciones** (`exam-editor.tsx`): puntos, tema, parejas, sobrantes y criterios, con "Suman X de Y" y el error del schema antes de guardar.
- **Panel "Nota del examen"** (`grading-scale.tsx`) para la escala.
- **Descargas:** "Descargar" agrega la hoja de respuestas, y el quiz y el examen pueden salir en versiones.
- La landing y el menú quitan "Próximamente", y "Mis recursos" filtra por exámenes.

**Privacidad (T8).**

- Al motor solo viaja contexto pedagógico.
- Los temas van con su clave (`T1`…) y nunca con su id.
- Las notas, las indicaciones por sección, las preferencias y el título y la descripción de cada tema pasan por `redactContactData`.
- El contrato rechaza campos de más en todos sus niveles (CA-0011-10, con test en el motor y en la web).
- Los logs del motor solo registran métricas.

**Segundo plano (nota en ADR-0008).** Un examen generándose se da por interrumpido a los **6 minutos**, no a los 5: el timeout del cliente es de 280 s, por las varias llamadas. Antes eran 600 s y 11 minutos; se bajó para caber en el límite de 300 s de Vercel (ADR-0011). El benchmark tardó como máximo 145 s.

**Benchmark (T4, CA-0011-14).** `uv run python -m app.cli benchmark-exams` corre 6 casos: Matemáticas 3°, 6° y 9°, Lengua Castellana 4° y 8°, y Religión sin DBA, de 20 y 40 preguntas. Con Groq `qwen/qwen3.8-27b`:

| Corrida                  | Válidos | Al primer intento | Latencia p50 / máx. | Tokens p50 / máx. | Llamadas p50 |
| ------------------------ | ------- | ----------------- | ------------------- | ----------------- | ------------ |
| Sin recorte (primera)    | 5 de 6  | 33 %              | 79 s / 109 s        | 16.886 / 24.643   | 4            |
| Con recorte determinista | 6 de 6  | 17 %              | 80 s / 145 s        | 21.446 / 29.225   | 4            |

- Los resultados están en `apps/ai-engine/benchmarks/results/2026-10-10-exams-qwen3.8-27b*.json`.
- La estimación de §9 era de 8.000–12.000 tokens. Lo real son 15.000–30.000 por examen, contando las reparaciones. Confirma la cuenta doble en el cupo (RN-11) y la generación por secciones (RN-10).
- Las reparaciones son frecuentes (la mayoría de los exámenes necesita al menos una), pero no llegan al docente.

**Tests (T9).**

| Archivo                                    | Cubre                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `apps/ai-engine/tests/test_exams.py`       | CA-02, CA-03, CA-06 y CA-10; plan por secciones, distribución, recorte           |
| `apps/web/tests/unit/exams.test.ts`        | CA-05, CA-07, CA-08, CA-09 y CA-15; RN-04, RN-06 y RN-14                         |
| `apps/web/tests/integration/exams.test.ts` | CA-01 a CA-13, CA-15 y CA-16, con acceso cruzado, métricas y la nota de ADR-0008 |
| `apps/web/tests/e2e/exams.spec.ts`         | CA-0011-17 y CA-11 (de la planeación a las descargas)                            |
| `apps/web/tests/e2e/ux.spec.ts`            | Actualizado: Examen en "Crear" y en la landing, sin "Próximamente"               |
