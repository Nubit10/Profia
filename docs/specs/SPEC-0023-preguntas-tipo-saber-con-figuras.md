# SPEC-0023 — Preguntas tipo Saber (ICFES) con situación, figura y competencia

| Campo                    | Valor                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                           |
| Fase del roadmap         | 6 · Generation (exámenes y quices)                                                     |
| Módulo(s) responsable(s) | `ai-engine/app/generation` · `modules/resources` · `modules/documents` · `lib/figures` |
| Agentes                  | product, architect, ai-engine, backend, frontend, documents, qa, reviewer              |
| ADR relacionados         | **ADR-0018: figuras dibujadas por código** · ADR-0009 (documentos), ADR-0014, ADR-0017 |
| Autor / Fecha            | product / 2026-11-20 (aprobada por el usuario: "hazlo lo que recomendaste")            |

## 1. Objetivo

Los colegios preparan a sus estudiantes para las pruebas Saber. Una pregunta tipo Saber no es solo
"una pregunta con 4 opciones":

- parte de una **situación** (un texto, unos datos, una gráfica);
- evalúa una **competencia** del ICFES;
- trae distractores que salen de errores típicos.

Esta spec deja que el docente pida quices y exámenes en ese estilo, con **figuras exactas dibujadas por
código** (recta numérica, gráfica de barras, tabla, fracción, rectángulo) y no por la IA.

## 2. Alcance

**Incluye:**

- Interruptor **"Estilo Saber (ICFES)"** en los ajustes del quiz y del examen. Solo para Matemáticas y
  Lenguaje, las áreas con competencias en el catálogo.
- En ese estilo, cada pregunta de selección múltiple trae:
  - `context`: la situación o el texto;
  - `competency`: una competencia del catálogo;
  - en Matemáticas, opcionalmente, `figure`.
- Un catálogo de competencias por área, versionado y marcado como pendiente de revisión docente.
- Cinco tipos de figura, validados en el AI Engine y dibujados en SVG por una función propia.
- Las figuras en el editor, en el PDF (vector) y en el Word (imagen PNG).
- El cálculo de Matemáticas se sigue verificando (SPEC-0022).

**No incluye (explícitamente):**

- Varias preguntas sobre un mismo texto (contexto compartido): cada pregunta trae su situación.
- Afirmaciones y evidencias del ICFES: solo la competencia.
- Editar la figura en el editor (se puede quitar). Figuras de geometría libre, planos cartesianos ni
  diagramas.
- Otras áreas (Ciencias, Sociales, Inglés): llegan con el catálogo de esas áreas.

## 3. Actores y permisos

| Actor     | Puede                                                                      | No puede                                                        |
| --------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Docente   | Pedir el estilo Saber, editar situación y enunciado, quitar una figura     | Dibujar figuras a mano en ProfIA (fuera de alcance)             |
| AI Engine | Escribir la situación, elegir la competencia y describir la figura (datos) | Entregar figuras como imagen ni competencias fuera del catálogo |

## 4. Reglas de negocio

- **RN-01 — Dónde aplica.**
  - Quices y secciones de selección múltiple de exámenes de Matemáticas o Lenguaje (también "Lengua
    Castellana" o "Español").
  - El interruptor no aparece en otras asignaturas y se recuerda la última elección por docente, como el
    DUA.
- **RN-02 — Catálogo de competencias** (`apps/ai-engine/catalog/saber/competencias.v1.json`).
  - Por área, las competencias de los marcos de referencia del ICFES, citando la fuente.
  - Marcado "pendiente de revisión docente" (como SPEC-0004).
  - El motor recibe solo `saber: true` y elige la lista por la asignatura. Una competencia fuera de la
    lista es un error de estructura.
- **RN-03 — La pregunta tipo Saber.**
  - `context`: de 15 a 150 palabras en Matemáticas y de 15 a 250 en Lenguaje.
  - `stem`: la pregunta sobre la situación; sigue la regla de largo por grado de SPEC-0021.
  - 4 opciones, una correcta.
  - Si el quiz o la sección tiene 3 o más preguntas, deben usarse al menos 2 competencias distintas
    (error de calidad).
  - Las preguntas de verdadero/falso y de respuesta corta no cambian.
- **RN-04 — Figuras.** Solo en Matemáticas y como datos, nunca como imagen:

  | `kind`        | Datos                                                                                              |
  | ------------- | -------------------------------------------------------------------------------------------------- |
  | `NUMBER_LINE` | `min`, `max`, `step` (2 a 40 marcas) y `marks` (hasta 6: `value` dentro del rango y `label` corta) |
  | `BAR_CHART`   | `title`, `categories` (2 a 8), `values` (mismos, ≥ 0), `unit`                                      |
  | `TABLE`       | `headers` (2 a 5) y `rows` (1 a 8, misma cantidad de celdas)                                       |
  | `FRACTION`    | `numerator` (0 a `denominator`), `denominator` (2 a 12) y `shape` `CIRCLE` o `BAR`                 |
  | `RECTANGLE`   | `width` y `height` (> 0, ≤ 1000), `unit`                                                           |

  Una figura inválida es un error de estructura con el motivo, que va a la reparación.

- **RN-05 — Dibujo.** `lib/figures` arma el SVG con una función pura y escapa todo el texto.
  - El editor lo muestra como imagen (`img` con `data:`, nunca HTML inyectado), con un texto alternativo
    que describe la figura.
  - El PDF usa el SVG vectorial.
  - El Word usa un PNG que se genera en el servidor con la fuente que ya trae el proyecto (ADR-0018).
- **RN-06 — En los documentos.** La situación va antes del enunciado y la figura entre ambos. En la clave
  y la guía del docente se ve la competencia de cada pregunta. Las versiones A–D solo cambian el orden de
  las opciones.
- **RN-07 — Versión del prompt.** El anexo `saber.v1` se suma al prompt. La versión registrada es la
  combinación en este orden: base, `math_check.v1`, `saber.v1` (p. ej.
  `quiz.v1+math_check.v1+saber.v1`).

## 5. Entradas

- Blueprint del quiz y del examen: `saber: boolean` (opcional, `false` por defecto).
- Contrato `generation-quiz` v1 y `generation-exam` v1 (aditivo): el pedido lleva `saber`; la respuesta
  lleva `context`, `competency` y `figure` en cada pregunta (opcionales).

## 6. Salidas

- Preguntas con `context`, `competency` y `figure` guardadas en el contenido.
- Figuras en el editor, el PDF y el Word.

## 7. Errores y casos límite

| Caso                                | Comportamiento esperado                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| Estilo Saber en Ciencias Naturales  | El interruptor no aparece; el servidor responde que no aplica |
| Figura en Lenguaje                  | Error de estructura: en Lenguaje no van figuras               |
| Etiqueta de figura con `<script>`   | Se dibuja como texto escapado; nunca se ejecuta               |
| `marks` fuera del rango de la recta | Error de estructura con el valor                              |
| Docente quita la figura             | Se guarda sin figura en una versión nueva                     |
| Docente edita la situación          | Se guarda; la marca de verificación de Matemáticas se quita   |

## 8. Criterios de aceptación

- **CA-0023-01:** Dado un quiz de Matemáticas con estilo Saber, cuando se genera, entonces el prompt lleva
  el anexo, la versión es `quiz.v1+math_check.v1+saber.v1` y cada pregunta de selección múltiple trae
  situación y una competencia del catálogo.
- **CA-0023-02:** Dada una pregunta sin situación, con una competencia inventada o con una figura inválida
  (fuera de rango, columnas desiguales, más de 8 barras), cuando se valida, entonces la reparación recibe
  el error concreto.
- **CA-0023-03:** Dado un quiz de 4 preguntas con una sola competencia, cuando se valida, entonces hay un
  error de calidad que pide variar las competencias.
- **CA-0023-04:** Dada una figura en Lenguaje, cuando se valida, entonces hay un error. Dado el estilo
  Saber en Ciencias, entonces el servidor lo rechaza al crear.
- **CA-0023-05:** Dada cada clase de figura, cuando se dibuja, entonces el SVG tiene las marcas, barras,
  celdas o partes esperadas y escapa `<script>`. El texto alternativo describe la figura.
- **CA-0023-06:** Dado un quiz Saber generado, cuando se descarga en Word y PDF, entonces la situación va
  antes del enunciado, la figura está como imagen (Word) o vector (PDF) y la clave muestra la competencia.
- **CA-0023-07:** Dados los ajustes de un quiz de Matemáticas, cuando el docente activa "Estilo Saber
  (ICFES)" y genera, entonces el blueprint lleva `saber` y la próxima vez el interruptor arranca activo.
  En Ciencias no aparece.
- **CA-0023-08:** Dado un quiz Saber en el editor, cuando el docente lo abre, entonces ve la situación, la
  competencia y la figura con su texto alternativo. Puede quitar la figura y guardar.

## 9. Seguridad y privacidad

- El SVG se arma con texto escapado y se muestra como imagen: el texto del modelo no puede inyectar
  HTML ni scripts.
- No hay datos personales nuevos.

## 10. Tareas

- [x] T1 — ADR-0018 — architect
- [x] T2 — Catálogo de competencias, anexo `saber.v1`, schemas y validación en quiz y examen — ai-engine
- [x] T3 — `lib/figures` (SVG y texto alternativo) y PNG para Word — documents
- [x] T4 — Blueprint, contenido, cliente del motor y última elección — backend
- [x] T5 — Interruptor, editor (situación, competencia, figura) — frontend
- [x] T6 — Documentos (situación, figura, competencia en la clave) — documents
- [x] T7 — Pruebas por CA y revisión — qa, reviewer

## 11. Implementación y revisión (2026-11-20)

- **AI Engine:**
  - `app/generation/saber.py`: área, catálogo `data/saber_competencias.v1.json` (pendiente de revisión
    docente), figuras como modelos con discriminador `kind`, `saber_errors` (estructura),
    `saber_quality` (variedad) y `clean_saber`.
  - Anexo `prompts/saber.v1.md`.
  - Quiz, sección de examen e ítems; versiones `quiz.v1+math_check.v1+saber.v1` y `exam.v1+…`.
  - El mock produce situación, competencia en rueda y una recta numérica.
  - Pruebas: `tests/test_saber.py` (11).
- **Web:**
  - `lib/figures/schema.ts` y `lib/figures/svg.ts`: dibujo puro, escapado, texto alternativo y eje con
    pasos redondos.
  - `modules/documents/figure-png.ts`: resvg con la Roboto de pdfmake.
  - `saber` en los blueprints, `saberApplies`, `lastSaber`; `OptionSwitch` en los ajustes del quiz y
    del examen.
  - `SaberContext`, `CompetencyBadge` y `FigureImage` en los editores, con "Quitar figura".
  - Situación y figura en el Word (PNG) y el PDF (vector); competencia en la clave.
  - `@resvg/resvg-js` en `serverExternalPackages`.
  - Pruebas: `tests/unit/figures.test.ts` (4), `tests/integration/spec-0023.test.ts` (3) y
    `tests/e2e/spec-0023.spec.ts` (2).

| Criterio   | Estado   | Evidencia                                                                                |
| ---------- | -------- | ---------------------------------------------------------------------------------------- |
| CA-0023-01 | Cumplido | `test_saber.py` (anexo, versión, competencias); integración (pedido y guardado)          |
| CA-0023-02 | Cumplido | `test_saber.py`: 6 casos de reparación con el error concreto                             |
| CA-0023-03 | Cumplido | `test_saber.py`: variar competencias                                                     |
| CA-0023-04 | Cumplido | Motor (Lenguaje sin figuras, Ciencias 422); integración (Ciencias rechazado)             |
| CA-0023-05 | Cumplido | `figures.test.ts`: cinco figuras, escape y `data:`                                       |
| CA-0023-06 | Cumplido | Integración: situación antes del enunciado, PNG en el Word, competencia en la clave, PDF |
| CA-0023-07 | Cumplido | Integración (`lastSaber`, `saberAvailable`) y e2e (interruptor, Ciencias)                |
| CA-0023-08 | Cumplido | E2e: situación, competencia, figura con texto alternativo y quitarla                     |

- **Reglas globales:**
  - el SVG se muestra como imagen, nunca como HTML;
  - la figura es un dato validado;
  - dependencia nueva con ADR-0018 y licencia revisada;
  - contrato aditivo.
- **Verificación:**
  - lint, typecheck y build (e2e) sin errores;
  - Vitest 306 de 306; AI Engine 181 de 181;
  - e2e de SPEC-0023: 2 de 2.
- **No bloqueante:**
  - el catálogo de competencias está pendiente de revisión docente;
  - cada pregunta trae su propia situación (sin contexto compartido).
- **Veredicto: Aprobado.**
