# SPEC-0008 — Talleres y quices con IA, revisión y evaluación docente

| Campo                    | Valor                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Estado                   | **Implementada** (2026-10-01)                                                                         |
| Fase del roadmap         | 6 · Generation                                                                                        |
| Módulo(s) responsable(s) | `modules/resources` (nuevo), `modules/generation`, `apps/ai-engine` (generation, validation, prompts) |
| Agentes                  | product, domain, ai-engine, backend, database, frontend, privacy, qa, reviewer                        |
| ADR relacionados         | ADR-0004 (tenancy), ADR-0007 (inferencia por etapas); ADR-0008 (generación en segundo plano)          |
| Autor / Fecha            | product / 2026-10-01                                                                                  |

## 1. Objetivo

Que el docente genere **talleres** y **quices** a partir de un tema de su planeación (con sus objetivos y DBA), los revise y edite, y **evalúe cada producción** (qué está bien, qué mejorar) para que las siguientes respuestas mejoren. Es la primera mitad del milestone MVP: tema → blueprint → IA → revisión → biblioteca (la exportación DOCX/PDF es la Fase 7).

## 2. Alcance

**Incluye:**

- **Blueprint del recurso** (plan maestro §9), configurado en un formulario corto: tipo (taller o quiz), tema, objetivos del tema que cubre, duración, dificultad, número de preguntas o actividades, distribución cognitiva y tipos de pregunta permitidos.
- **Generación de un taller:** título, propósito, instrucciones para el estudiante, actividades organizadas por los momentos de la **estructura que elige el docente** (RN-10) y orientaciones para el docente.
- **Generación de un quiz:** preguntas de selección múltiple (una correcta), verdadero/falso y respuesta corta, cada una con respuesta esperada, justificación, nivel cognitivo y DBA que evalúa.
- **Validación en el AI Engine** (igual que SPEC-0007): schema, validador pedagógico y reparación (máximo 3 intentos).
- **Generación en segundo plano:** el docente puede cerrar la página; el recurso aparece en la biblioteca cuando termina (ver RN-05 y ADR-0008).
- **Revisión y edición estructurada:** editar textos, cambiar la respuesta correcta, reordenar, eliminar o agregar preguntas/actividades a mano.
- **Regenerar una pregunta o actividad** con una indicación del docente ("más difícil", "con un ejemplo de la vida diaria").
- **Evaluación docente de cada producción:** calificación general (1–5) y, por pregunta o actividad, 👍/👎 con "qué está bien / qué se debe mejorar". Queda ligada al modelo y a la versión del prompt.
- **Mejora de las respuestas con esa evaluación:** las indicaciones del docente se usan al regenerar y como preferencias en sus siguientes generaciones, del curso o de todos sus cursos según decida el docente (RN-07); las métricas agregadas por versión de prompt guían los cambios de prompt.
- **Biblioteca del curso:** lista de recursos con tipo, tema, estado (generando, borrador, listo) y fecha; abrir, duplicar y archivar.

**No incluye (explícitamente):**

- Exámenes, planes de aula, clases, lecturas, rúbricas y refuerzo (specs siguientes; reutilizan el blueprint de esta).
- Exportar a DOCX/PDF e imprimir (Fase 7).
- Aplicar el quiz a estudiantes, calificar respuestas y analítica (Fase 8). Aquí no hay datos de estudiantes.
- Versiones diferenciadas (Fase 10) y biblioteca compartida entre docentes (Fase 11).
- Imágenes o gráficos generados.
- Fine-tuning con las evaluaciones (Fase 12): en esta fase la mejora se hace por prompt y contexto.

## 3. Actores y permisos

| Actor                           | Puede                                                                | No puede                                               |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Docente dueño del curso         | Generar, ver, editar, regenerar partes, evaluar, duplicar y archivar | Ver recursos de cursos de otros docentes               |
| Administrador de la institución | Ver la biblioteca de los cursos de su institución (solo lectura)     | Editar o evaluar recursos ajenos                       |
| Otra institución                | —                                                                    | Ver, inferir ni acceder por ID (respuesta `NOT_FOUND`) |

## 4. Reglas de negocio

- **RN-01:** Nada generado se guarda como recurso "listo" sin acción del docente. Lo generado queda en estado **borrador** hasta que el docente lo marque como listo.
- **RN-02:** Al AI Engine solo viaja contexto pedagógico: asignatura, grado, tema, objetivos, DBA con evidencias, blueprint e indicaciones del docente. Nunca nombres, correos, institución ni datos de estudiantes. El contrato rechaza campos adicionales.
- **RN-03:** Cada pregunta y actividad cita solo DBA presentes en el contexto; un código fuera del contexto invalida la salida (el validador pide reparación).
- **RN-04:** El quiz cumple el blueprint: número exacto de preguntas, distribución cognitiva con tolerancia de ±1 pregunta por nivel, solo los tipos permitidos, una sola opción correcta en selección múltiple, opciones sin duplicados y sin "todas/ninguna de las anteriores".
- **RN-05:** Una generación no bloquea al docente: se crea el recurso en estado **generando** y la respuesta llega en segundo plano. Si falla, queda en **fallido** con un mensaje y la opción de reintentar.
- **RN-06:** Cupo de IA: máximo **10 recursos por docente por día** y **3 en curso a la vez** por docente (el plan gratuito de Groq da ~35 talleres al día por modelo; ver §9). Regenerar una pregunta cuenta aparte (30 por hora).
- **RN-07:** El docente puede guardar una indicación de mejora como **preferencia** y decide su alcance: **solo este curso** o **todos mis cursos** (puede cambiarlo después). En cada generación se usan las preferencias activas que aplican al curso (máximo las 5 más recientes, máximo 500 caracteres en total). El docente las ve y puede quitarlas o desactivarlas antes de generar. No se comparten con otros docentes.
- **RN-08:** Cada edición del docente se guarda como una versión nueva del contenido; se conserva la versión generada original para medir cuánto se editó (señal de calidad).
- **RN-10:** El docente elige la **estructura del taller** entre opciones explicadas en la misma pantalla (para qué sirve cada una y qué momentos tiene): _Inicio, desarrollo y cierre_ (la más usada; por defecto), _Exploración, práctica y aplicación_, _Vivencia, fundamentación, ejercitación y aplicación_ (secuencia de muchas guías colombianas) y _Situación problema_ (plantear, investigar, proponer, socializar). Cada momento tiene al menos una actividad, así que el número de actividades es al menos el número de momentos.
- **RN-09:** Un recurso conserva su trazabilidad: curso, tema, objetivos, DBA, blueprint, modelo, versión de prompt y fecha. Si el tema u objetivo se elimina después, el recurso conserva una copia de su texto.

## 5. Entradas

**Blueprint** (mismo schema Zod en formulario y servidor):

| Campo                   | Tipo / validación                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `type`                  | `WORKSHOP` · `QUIZ`                                                                                                                 |
| `topicId`               | tema del curso del docente                                                                                                          |
| `objectiveIds`          | 1–5 objetivos del tema (si el tema no tiene objetivos, se usa el título y la descripción)                                           |
| `durationMinutes`       | 15–180                                                                                                                              |
| `difficulty`            | `BASIC` · `INTERMEDIATE` · `ADVANCED`                                                                                               |
| `itemCount`             | quiz: 3–15 preguntas · taller: 2–8 actividades                                                                                      |
| `cognitiveDistribution` | porcentajes por nivel (recordar, comprender, aplicar, analizar, evaluar, crear); suman 100                                          |
| `questionTypes`         | quiz: subconjunto no vacío de `MULTIPLE_CHOICE`, `TRUE_FALSE`, `SHORT_ANSWER`                                                       |
| `structure`             | taller: `START_DEVELOPMENT_CLOSE` · `EXPLORE_PRACTICE_APPLY` · `EXPERIENCE_FOUNDATION_EXERCISE_APPLY` · `PROBLEM_SITUATION` (RN-10) |
| `notes`                 | opcional, máx. 500 caracteres ("trabajarán en parejas", "sin calculadora")                                                          |

Valores por defecto según el grado (p. ej. Transición–3°: dificultad básica, más recordar/comprender, sin respuesta corta larga).

**Contratos nuevos del AI Engine:** `generation-quiz.v1`, `generation-workshop.v1` y `generation-item-regenerate.v1`, en [generation-resources.v1](../ai/contracts/generation-resources.v1.md).

## 6. Salidas

- `Resource` (tenant): tipo, curso, tema, estado (`GENERATING` · `FAILED` · `DRAFT` · `READY` · `ARCHIVED`), blueprint, snapshot de contexto (RN-09), versión actual.
- `ResourceVersion`: contenido JSON validado, origen (`AI` · `TEACHER`), autor, fecha.
- `GenerationLog` (reutiliza el de SPEC-0007): tipo de generación, modelo, versión de prompt, intentos, latencia, tokens, estado.
- `ResourceFeedback`: calificación general 1–5 y comentario; `ResourceItemFeedback`: 👍/👎 y comentario por pregunta/actividad.
- **Métricas para mejorar** (consulta interna, sin datos personales): por versión de prompt y modelo, calificación media, % de 👎, % de preguntas editadas o eliminadas y motivos más frecuentes. Se revisan antes de crear una versión nueva de un prompt.

## 7. Errores y casos límite

| Caso                                                               | Comportamiento esperado                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| AI Engine apagado o todos los proveedores en límite                | Recurso en `FAILED` con "La IA no está disponible, intenta más tarde"; botón Reintentar        |
| Groq pide esperar (429) más que el tiempo permitido                | Pasa al siguiente modelo de la cadena (ADR-0007); si ninguno responde, como el caso anterior   |
| Salida inválida tras 3 intentos                                    | `FAILED` con "No pudimos generar un recurso válido"; queda en `generation_logs` como `INVALID` |
| El docente cierra la página mientras se genera                     | La generación sigue; al volver ve el recurso en la biblioteca                                  |
| El servidor se reinicia durante una generación                     | Al arrancar o al abrir la biblioteca, lo que lleve > 5 min en `GENERATING` pasa a `FAILED`     |
| Tema sin DBA (asignatura sin catálogo, p. ej. Religión)            | Se genera con objetivos y tema; las preguntas no citan DBA y se muestra un aviso               |
| Cupo diario agotado                                                | Mensaje con la hora en que se libera; no se llama a la IA                                      |
| Distribución cognitiva imposible (p. ej. 3 preguntas en 6 niveles) | El formulario ajusta y explica antes de enviar                                                 |
| El docente edita mientras se regenera una pregunta                 | La regeneración llega como propuesta; el docente decide si reemplaza                           |
| Indicaciones del docente con órdenes ("ignora las reglas")         | Van delimitadas como datos (`<<<DATOS>>>`); el validador aplica igual                          |

## 8. Criterios de aceptación

- **CA-0008-01:** Dado un tema con objetivos y DBA, cuando el docente configura un blueprint de quiz y genera, entonces el recurso aparece en la biblioteca en estado borrador con el número de preguntas, tipos y distribución pedidos, y cada pregunta cita solo DBA del contexto.
- **CA-0008-02:** Dado un blueprint de taller, cuando se genera, entonces el taller tiene propósito, instrucciones, actividades por momentos y orientaciones docentes, en el número pedido.
- **CA-0008-03:** Dada una salida del modelo que no cumple el blueprint (cantidad, una sola correcta, códigos inventados), cuando el AI Engine la valida, entonces pide reparación con los errores concretos y, tras 3 intentos, responde `502`.
- **CA-0008-04:** Dado que el docente sale de la página durante la generación, cuando vuelve, entonces ve el recurso listo para revisar o fallido con opción de reintentar.
- **CA-0008-05:** La petición al AI Engine no contiene nombre, correo ni institución, y el contrato rechaza campos adicionales (`422`).
- **CA-0008-06:** Dado un recurso en borrador, cuando el docente edita una pregunta y guarda, entonces se crea una versión nueva y se conserva la original generada.
- **CA-0008-07:** Dada una pregunta, cuando el docente pide regenerarla con una indicación, entonces recibe una propuesta que puede aceptar o descartar, y la indicación queda registrada.
- **CA-0008-08:** Dado un recurso, cuando el docente lo califica (general y por pregunta con comentario), entonces la evaluación queda ligada al modelo y la versión del prompt, y aparece en las métricas por versión.
- **CA-0008-09:** Dada una preferencia guardada con alcance "solo este curso" y otra con "todos mis cursos", cuando el docente genera en ese curso, entonces la petición incluye ambas (máx. 5); cuando genera en otro curso, solo la de "todos mis cursos". El docente puede verlas, desactivarlas y cambiar su alcance antes de generar.
- **CA-0008-14:** Dado el formulario de taller, cuando el docente elige una estructura, entonces ve su explicación y momentos, y el taller generado organiza las actividades en esos momentos (cada momento con al menos una actividad).
- **CA-0008-10:** Dado el cupo diario agotado o 3 generaciones en curso, cuando el docente intenta generar, entonces recibe el mensaje de cupo y no se llama a la IA.
- **CA-0008-11:** Un recurso, una versión o una evaluación de otra institución o de otro docente responden `NOT_FOUND` (acceso cruzado).
- **CA-0008-12:** Dado un tema sin DBA, cuando se genera un quiz, entonces se genera sin citas y se muestra el aviso.
- **CA-0008-13:** El benchmark de generación incluye casos de taller y quiz (≥ 10, varias áreas y grados) y reporta tasa de salidas válidas, intentos, latencia y tokens; su resultado queda versionado.

## 9. Seguridad y privacidad

- **Tenancy:** `Resource`, `ResourceVersion` y las evaluaciones son tablas de tenant con FK compuestas `(id, institutionId)`; servicios con `ctx: TenantContext`; test de acceso cruzado (CA-0008-11).
- **Datos al modelo:** solo contexto pedagógico (RN-02). Las indicaciones y comentarios del docente son texto libre y podrían traer nombres de estudiantes: la UI lo advierte ("no escribas nombres de estudiantes") y el servidor quita correos y teléfonos antes de enviarlos.
- **Prompt injection:** blueprint, notas, preferencias e indicaciones van delimitados como datos; el validador no depende de que el modelo obedezca.
- **Costo y cupo:** con el plan gratuito (8K tokens/min y 200K tokens/día por modelo) un quiz de 10 preguntas usa ~4–6K tokens. RN-06 evita que un solo docente consuma el cupo de todos. Las generaciones en espera se procesan de a una por modelo para no chocar con el límite por minuto.
- **Auditoría:** generar, marcar listo, archivar y duplicar quedan en el log de auditoría.

## 10. Tareas

- [ ] T1 — ADR-0008: generación en segundo plano (ver pregunta 1) — architect
- [ ] T2 — Modelo `Resource`, `ResourceVersion`, evaluaciones y migración — database
- [ ] T3 — Schemas de taller y quiz, validador pedagógico, prompts `workshop.v1`, `quiz.v1`, `item_regenerate.v1`, contratos y endpoints — ai-engine
- [ ] T4 — Benchmark de taller y quiz (≥ 10 casos) con Groq — ai-engine, qa
- [ ] T5 — `modules/resources`: blueprint, generación en segundo plano, versiones, cupo, preferencias, biblioteca — backend
- [ ] T6 — UI: formulario de blueprint desde el tema, biblioteca del curso, editor de quiz y taller, regenerar parte, evaluación — frontend
- [ ] T7 — Filtro de datos personales en indicaciones y comentarios; revisión de privacidad — privacy
- [ ] T8 — Tests unitarios, integración (incluye acceso cruzado) y E2E con el AI Engine de prueba — qa
- [ ] T9 — Revisión contra esta spec y DoD — reviewer

## 11. Decisiones del product owner (2026-10-01)

1. Generación en segundo plano sin Redis por ahora (ADR-0008); Redis y workers cuando haya más colegios.
2. Tipos de pregunta: selección múltiple, verdadero/falso y respuesta corta.
3. La estructura del taller la decide el docente, con la explicación de cada opción en pantalla (RN-10).
4. Cupo: 10 recursos por docente al día.
5. El docente decide si cada preferencia aplica a ese curso o a todos sus cursos (RN-07).

## 12. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado   | Evidencia                                                                                                                              |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| CA-0008-01 | Cumplido | Integración (quiz en "generando" → borrador, solo DBA de los objetivos elegidos, log con tokens); motor `test_resources.py`; E2E       |
| CA-0008-02 | Cumplido | Motor (momentos en orden, cantidad, duración); integración; E2E con "Situación problema"                                               |
| CA-0008-03 | Cumplido | Motor: 9 casos de reparación con el error concreto (cantidad, correcta fuera de opciones, código inventado, …) y `502` tras 3 intentos |
| CA-0008-04 | Cumplido | Integración: fallo `unavailable`/`invalid` → reintentar → borrador; generación interrumpida → `FAILED` al abrir la biblioteca          |
| CA-0008-05 | Cumplido | Integración (claves exactas de la petición, sin datos personales, correo y teléfono de las notas omitidos); motor `422`                |
| CA-0008-06 | Cumplido | Integración (versión 2 del docente, versión 1 de la IA intacta, conflicto entre pestañas, respuesta fuera de opciones); E2E            |
| CA-0008-07 | Cumplido | Integración (propuesta, indicación registrada, reemplaza con el mismo id solo al aceptar, doble decisión rechazada); E2E               |
| CA-0008-08 | Cumplido | Integración (calificación 1–5 y por ítem ligadas a modelo y prompt; métricas por versión); E2E                                         |
| CA-0008-09 | Cumplido | Integración (alcance curso / todos, excluir en una generación, cambiar alcance); E2E (comentario → preferencia → formulario)           |
| CA-0008-10 | Cumplido | Integración: 3 en curso y cupo diario → `RATE_LIMITED` con la hora en que se libera, sin llamar a la IA                                |
| CA-0008-11 | Cumplido | Integración: recurso, contenido, evaluaciones, regeneración, estado, copia y biblioteca ajenos → `NOT_FOUND`                           |
| CA-0008-12 | Cumplido | Integración (Educación Religiosa: `dba: []`, aviso en el formulario)                                                                   |
| CA-0008-13 | Cumplido | `apps/ai-engine/benchmarks/results/2026-10-01-resources-qwen3.8-27b.json` (10 casos, Groq)                                             |
| CA-0008-14 | Cumplido | Unit (cada momento necesita una actividad), motor (las 4 estructuras) y E2E (explicación visible, cantidad ajustada)                   |

**Benchmark con Groq (`qwen/qwen3.8-27b`, 10 casos con 20 s entre casos):** 9/10 válidos, 8/10 al primer intento. Un quiz usa ~1.500–2.300 tokens (el de 12 preguntas, con una reparación, 6.800); un taller, ~1.800–2.800. Latencia mediana 8 s. El caso fallido lo explica el cupo: tras el quiz de 6.800 tokens, Qwen respondió 429 con una espera larga, gpt-oss respondió 400 (`json_validate_failed`) y el modelo local no alcanzó en 180 s. Se corrigió en el AI Engine:

- Los recursos esperan hasta 60 s el cupo por minuto de Groq antes de cambiar de modelo (corren en segundo plano, ADR-0008).
- Un 400 `json_validate_failed` de Groq ya no descarta el modelo: su texto entra a la reparación con los errores concretos.

**Capacidad del plan gratuito con estos números:** ~2.000 tokens por recurso → ~100 recursos al día por modelo (200K tokens/día), de sobra para el cupo de 10 por docente en los dos colegios piloto. El límite que más pesa es por minuto (8K tokens): ~3 recursos por minuto por modelo; el semáforo de la web (2 a la vez) y la espera del AI Engine lo absorben.

**Hallazgos corregidos durante la implementación:**

- La biblioteca (componente de servidor) importaba las etiquetas de estado desde un componente `"use client"` y llegaban vacías: ahora viven en `modules/resources/schemas.ts`.
- Un E2E aceptaba la regeneración y seguía antes de que llegara la versión guardada (la propuesta ya mostraba el texto nuevo): el test espera la versión 3.
- El login de los E2E podía tardar más de 5 s con 22 pruebas en paralelo: el helper espera hasta 15 s.

**Decisiones de implementación:**

- La evaluación general vive en columnas de `Resource` (`rating`, `ratingComment`): cada recurso tiene un solo docente dueño.
- Al AI Engine viajan solo los DBA vinculados a los objetivos elegidos (si no hay, los del grado): menos tokens y preguntas más enfocadas.
- El filtro de texto libre quita correos y teléfonos de 10 dígitos; con un umbral menor borraba cantidades de los talleres de matemáticas.
- Métricas por versión de prompt: `npm run metrics:resources -w @profe/web`.

**Pendiente (fuera de esta spec):** la vista de solo lectura para el administrador de la institución (§3) requiere ver cursos de otros docentes, que hoy responden 404 (CA-0004-07); se aborda con la coordinación institucional (Fase 11). Exportar a DOCX/PDF es la Fase 7.
