# SPEC-0022 — Verificar las respuestas de Matemáticas

| Campo                    | Valor                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                             |
| Fase del roadmap         | 6 · Generation (calidad de lo generado)                                                  |
| Módulo(s) responsable(s) | `ai-engine/app/generation` · `modules/resources` · editor de recursos                    |
| Agentes                  | product, architect, ai-engine, backend, frontend, qa, reviewer                           |
| ADR relacionados         | **ADR-0017: verificación de cálculos en el AI Engine** · se apoya en ADR-0014 y ADR-0016 |
| Autor / Fecha            | product / 2026-11-20 (aprobada por el usuario: "hazlo lo que recomendaste")              |

## 1. Objetivo

Los modelos de lenguaje se equivocan en cuentas. Una clave de respuestas errada en un quiz o examen de
Matemáticas le quita la confianza al docente. Esta spec hace que el AI Engine **recalcule** cada respuesta
numérica con un evaluador exacto, sin el modelo. El docente ve qué respuestas quedaron verificadas y cuáles
debe revisar.

## 2. Alcance

**Incluye:**

- Quices y exámenes de asignaturas de Matemáticas: preguntas de selección múltiple y de respuesta corta, al
  generar y al regenerar una pregunta.
- Que el modelo escriba, en cada pregunta con respuesta numérica, el cálculo que la produce (`check`): una
  expresión aritmética o una ecuación lineal de una incógnita. Va en un anexo de prompt (`math_check.v1`).
- Un evaluador propio, exacto (fracciones) y seguro (sin `eval`).
- El estado de la verificación de cada pregunta (`answerCheck`): verificada, corregida o por revisar. El
  editor lo muestra y la descarga no lo lleva.

**No incluye (explícitamente):**

- Geometría con figuras, estadística con tablas, demostraciones ni preguntas abiertas: no se verifican aquí
  (las figuras van en SPEC-0023).
- Talleres: sus actividades no tienen una sola respuesta.
- Otras asignaturas.

## 3. Actores y permisos

| Actor     | Puede                                                           | No puede                                           |
| --------- | --------------------------------------------------------------- | -------------------------------------------------- |
| Docente   | Ver qué respuestas están verificadas o por revisar, y editarlas | —                                                  |
| AI Engine | Recalcular y, si es inequívoco, corregir la respuesta marcada   | Inventar una respuesta que no está en las opciones |

## 4. Reglas de negocio

- **RN-01 — Dónde aplica.** Asignaturas cuyo nombre contiene "Matemática" (sin importar tildes ni
  mayúsculas). Preguntas `MULTIPLE_CHOICE` y `SHORT_ANSWER` de quices y exámenes, al generar y al
  regenerar una pregunta.
- **RN-02 — El cálculo lo escribe el modelo; el resultado lo calcula el motor.** En cada pregunta con
  respuesta numérica, el modelo agrega `check` con una de estas formas:
  - `{"expression": "(-3) + 5"}`;
  - `{"equation": "2*x + 3 = 11", "variable": "x"}`, que es lineal en la incógnita.

  El prompt lleva el anexo `math_check.v1`, y la versión registrada es la combinación (p. ej.
  `quiz.v1+math_check.v1`), como el DUA (ADR-0014).

- **RN-03 — Evaluador seguro y exacto.**
  - Solo admite números (con coma o punto decimal, signo menos tipográfico), `+ - * / ^ **`, paréntesis,
    porcentaje (`%`), `sqrt(...)` de cuadrados perfectos racionales y la incógnita de la ecuación.
  - Se analiza con el árbol de sintaxis de Python y una lista blanca de nodos; **nunca** se usa `eval`.
  - Los cálculos son exactos (fracciones).
  - Límites: expresión de hasta 120 caracteres, exponentes enteros de -6 a 6, resultados con valor absoluto
    menor que 10¹².
- **RN-04 — Comparación.**
  - Se toma el primer número de la respuesta: entero, decimal, fracción `a/b` o porcentaje (`3`, `-3 °C`,
    `x = 4`, `0,5`, `2/3`, `25 %`).
  - Coincide si es igual al resultado, o si es un decimal de **dos o más** cifras decimales que redondea al
    resultado ("0,33" sí es 1/3; "0,3" no).
  - En selección múltiple, ningún distractor puede coincidir con el resultado: serían dos opciones
    correctas.
- **RN-05 — Pide el cálculo.** Si una pregunta de Matemáticas tiene respuesta numérica y no trae `check`, o
  el `check` no se puede evaluar, es un error de calidad (SPEC-0021 RN-12): va a la reparación, pero no
  tumba la generación.
- **RN-06 — Desacuerdo.** Si el resultado no coincide con la respuesta, o coincide con un distractor, es un
  error de calidad con el cálculo concreto ("el cálculo da 2 y la respuesta dice 3"). Si persiste después de
  la reparación:
  - en selección múltiple, si el resultado coincide con **exactamente una** opción, el motor cambia la
    respuesta a esa opción y la marca como corregida;
  - en cualquier otro caso, la pregunta queda por revisar.
- **RN-07 — Estado por pregunta.** Cada pregunta verificable sale con `answerCheck`:

  | `status`    | Cuándo                                                      |
  | ----------- | ----------------------------------------------------------- |
  | `VERIFIED`  | El cálculo coincide con la respuesta                        |
  | `CORRECTED` | Se cambió la respuesta según el cálculo (RN-06)             |
  | `REVIEW`    | No se pudo verificar o no coincide; trae la nota del motivo |

  `note` es un texto corto para el docente. El campo `check` del modelo no sale del motor.

- **RN-08 — En el producto.**
  - El editor muestra junto a la respuesta "Respuesta verificada", "Respuesta corregida según el cálculo"
    o "Revisa esta respuesta: …".
  - Si el docente edita la pregunta, la marca se quita: la respuesta ya es suya.
  - Los Word y PDF no muestran las marcas.
- **RN-09 — Registro.** Los desacuerdos que quedan se suman a `qualityWarnings` (SPEC-0021). El log del
  motor cuenta cuántas preguntas quedaron verificadas, corregidas y por revisar, sin textos.

## 5. Entradas

- Respuesta del modelo: `questions[].check` opcional, de la forma
  `{"expression": str} | {"equation": str, "variable": str}`.
- Contrato hacia el producto: `questions[].answerCheck` opcional, de la forma
  `{"status": "VERIFIED" | "CORRECTED" | "REVIEW", "note": str}`. Es aditivo en `generation-quiz` v1,
  `generation-exam` v1 y la regeneración de ítems.

## 6. Salidas

- Preguntas con `answerCheck`, que se guarda en el contenido del recurso (versión 1 de la IA).
- Marcas en el editor.
- `meta.qualityWarnings` con los desacuerdos que quedaron.

## 7. Errores y casos límite

| Caso                                                                    | Comportamiento esperado                                           |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `check` con un nombre o una función no permitida (`__import__`, `open`) | No se evalúa; la pregunta queda por revisar ("cálculo no válido") |
| División por cero o exponente fuera de rango                            | Por revisar                                                       |
| Ecuación no lineal (`x^2 = 4`) o sin solución única                     | Por revisar                                                       |
| Respuesta sin número ("La mitad")                                       | Por revisar ("no se pudo comparar")                               |
| Opciones "1/2" y "0,5" (iguales)                                        | Error: dos opciones correctas                                     |
| Asignatura que no es Matemáticas                                        | No se pide ni se verifica nada                                    |
| Pregunta de verdadero/falso                                             | No se verifica                                                    |

## 8. Criterios de aceptación

- **CA-0022-01:** Dada una expresión con fracciones, decimales con coma, porcentaje, potencias y raíz de un
  cuadrado perfecto, cuando se evalúa, entonces el resultado es exacto. Dados `__import__('os')`, `open(...)`,
  atributos, división por cero o `2**99`, entonces se rechaza sin ejecutar nada.
- **CA-0022-02:** Dada la ecuación `2*x + 3 = 11`, cuando se resuelve, entonces da 4. `x^2 = 4` se rechaza
  por no ser lineal.
- **CA-0022-03:** Dado un quiz de Matemáticas donde la respuesta coincide con el cálculo, cuando termina la
  generación, entonces la pregunta sale `VERIFIED` y sin `check`.
- **CA-0022-04:** Dada una respuesta que no coincide, cuando se valida, entonces el mensaje de reparación
  trae el cálculo. Si en el último intento sigue mal y el resultado coincide con una sola opción, entonces la
  respuesta queda en esa opción con `CORRECTED`.
- **CA-0022-05:** Dada una respuesta corta que no coincide tras la reparación, cuando termina, entonces la
  pregunta queda `REVIEW` con la nota y el aviso se suma a `qualityWarnings`.
- **CA-0022-06:** Dado un distractor igual al resultado ("0,5" cuando la respuesta es "1/2"), cuando se
  valida, entonces hay un error de dos opciones correctas.
- **CA-0022-07:** Dada una pregunta numérica sin `check`, cuando se valida, entonces se pide el cálculo en
  la reparación. Si no llega, la pregunta queda `REVIEW`.
- **CA-0022-08:** Dado un quiz de Lenguaje, cuando se genera, entonces el prompt no lleva el anexo y ninguna
  pregunta trae `answerCheck`.
- **CA-0022-09:** Dado un examen de Matemáticas y la regeneración de una pregunta, cuando terminan, entonces
  sus preguntas también traen `answerCheck`, y la versión del prompt incluye `math_check.v1`.
- **CA-0022-10:** Dado un recurso generado con marcas, cuando el docente abre el editor, entonces ve
  "Respuesta verificada" o "Revisa esta respuesta: …". Si edita la pregunta y guarda, la marca de esa
  pregunta se quita y las demás siguen. El Word no trae las marcas.

## 9. Seguridad y privacidad

- El evaluador nunca ejecuta código del modelo: árbol de sintaxis con lista blanca y aritmética propia
  (CA-0022-01).
- No se envía nada nuevo al modelo. No hay datos personales.

## 10. Tareas

- [x] T1 — ADR-0017 — architect
- [x] T2 — `app/generation/mathcheck.py`, anexo `math_check.v1`, integración en quiz, examen e ítems, y
      pruebas — ai-engine
- [x] T3 — `answerCheck` en los schemas, el cliente del motor y el contenido; se quita al editar — backend
- [x] T4 — Marcas en el editor — frontend
- [x] T5 — Pruebas por CA y revisión — qa, reviewer

## 11. Implementación y revisión (2026-11-20)

- **AI Engine:**
  - `app/generation/mathcheck.py`: evaluador con `ast` y lista blanca, fracciones, ecuación lineal por
    diferencias en 5 puntos, lectura de números al estilo colombiano, `check_errors` (reparación) y
    `finalize` (estado, corrección inequívoca, quita `check`).
  - Anexo `prompts/math_check.v1.md` en quiz, sección de examen e ítems de Matemáticas.
  - Versiones registradas: `quiz.v1+math_check.v1`, `exam.v1+math_check.v1`,
    `exam_item.v1+math_check.v1` e `item_regenerate.v1+math_check.v1`.
  - Pruebas: `tests/test_mathcheck.py` (24); las de quiz y examen se actualizaron a la versión nueva.
- **Web:**
  - `answerCheckSchema` en `modules/resources/schemas.ts`.
  - `carryAnswerChecks` (`content.ts`): al guardar, una marca solo sobrevive si la pregunta no cambió; el
    navegador no puede inventarla.
  - `withoutStaleCheck` en los editores y `components/answer-check.tsx`.
  - Pruebas: `tests/integration/spec-0022.test.ts` (CA-10, incluido el Word sin marcas) y
    `tests/e2e/spec-0022.spec.ts` (CA-10 en el navegador).

| Criterio      | Estado   | Evidencia                                                                     |
| ------------- | -------- | ----------------------------------------------------------------------------- |
| CA-0022-01/02 | Cumplido | `test_mathcheck.py`: exactitud, 14 entradas peligrosas rechazadas, ecuaciones |
| CA-0022-03…07 | Cumplido | `test_mathcheck.py` con modelo guionado (reparación, corrección, revisión)    |
| CA-0022-08    | Cumplido | Lenguaje: sin anexo ni marcas                                                 |
| CA-0022-09    | Cumplido | Examen, ítem de quiz, ítem de examen (corrección) y versión del prompt        |
| CA-0022-10    | Cumplido | Integración (guardar, quitar, no inventar, Word) y e2e                        |

- **Reglas globales:**
  - el evaluador nunca ejecuta código del modelo;
  - sin dependencias nuevas;
  - el contrato es aditivo (ADR-0017).
- **Verificación:**
  - lint y typecheck sin errores;
  - Vitest 299 de 299; AI Engine 170 de 170 y ruff limpio;
  - e2e de SPEC-0022: 1 de 1.
  - Las e2e de quiz y examen que revisan el nombre del archivo descargado siguen fallando en este entorno,
    como antes de este cambio.
- **No bloqueante:** geometría, estadística y preguntas abiertas no se verifican (fuera de alcance).
- **Veredicto: Aprobado.**
