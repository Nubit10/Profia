# SPEC-0024 — Plan de aula (secuencia didáctica) y rúbrica en la escala del colegio

| Campo                    | Valor                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                                    |
| Fase del roadmap         | 6 · Generation (planes de aula, pendientes de la fase)                                          |
| Módulo(s) responsable(s) | `modules/resources` · `modules/institutions` · `modules/documents` · `ai-engine/app/generation` |
| Agentes                  | product, architect, domain, ai-engine, backend, frontend, documents, qa, reviewer               |
| ADR relacionados         | **ADR-0019: plan de aula como tipo de recurso y escala de valoración del espacio**              |
| Autor / Fecha            | product / 2026-11-20 (aprobada por el usuario: "hazlo lo que recomendaste")                     |

## 1. Objetivo

Es lo que el coordinador le pide al docente cada semana y lo que más tiempo le quita: el **plan de aula**
de un tema, es decir, la secuencia didáctica por sesiones (inicio, desarrollo y cierre), con evaluación y
una **rúbrica por desempeños** (Superior, Alto, Básico y Bajo, Decreto 1290). La rúbrica muestra los
rangos de la **escala de valoración del colegio** (su SIEE) o la del docente independiente.

## 2. Alcance

**Incluye:**

- Un tipo de recurso nuevo, `LESSON_PLAN` ("Plan de aula"), de un tema, generado con IA en segundo plano
  como los talleres. Los ajustes son:
  - sesiones (1 a 6) y minutos por sesión (30 a 120);
  - objetivos, dificultad y notas, como en el taller.
- El contenido del plan:
  - propósito;
  - sesiones con inicio, desarrollo, cierre y recursos;
  - evaluación (evidencias e instrumentos);
  - rúbrica de 2 a 5 criterios × 4 desempeños;
  - ajustes para la diversidad (sugerencias generales, sin datos de estudiantes).
- **Escala de valoración** del espacio:
  - la nota mínima, la máxima y los rangos de los 4 desempeños;
  - la define el administrador del colegio o el docente independiente;
  - la predeterminada es la nacional más usada: 1,0–5,0, con Bajo 1,0–2,9, Básico 3,0–3,9, Alto 4,0–4,5
    y Superior 4,6–5,0.
- Editor del plan (textos de sesiones y rúbrica), Word y PDF del plan, en el asistente "Crear" y en
  "Mis recursos".

**No incluye (explícitamente):**

- Planes de varios temas o del periodo completo, que ya cubre la planeación (SPEC-0006 y SPEC-0014).
- Regenerar una sesión con IA (se edita a mano). Formato propio del plan (como el de SPEC-0010).
- Cambiar la conversión a nota de los exámenes (SPEC-0011 sigue en 1,0–5,0).
- Notas de estudiantes: llegan con SPEC-0025.

## 3. Actores y permisos

| Actor                     | Puede                                              | No puede                                |
| ------------------------- | -------------------------------------------------- | --------------------------------------- |
| Docente                   | Generar, editar y descargar sus planes de aula     | Cambiar la escala de un colegio         |
| Docente independiente     | Todo lo anterior y definir la escala de su espacio | —                                       |
| Administrador del colegio | Definir la escala del colegio (todas las sedes)    | Ver o editar los planes de sus docentes |

## 4. Reglas de negocio

- **RN-01 — El plan es un recurso.** Usa todo lo de SPEC-0008:
  - cupo (cuesta 1), segundo plano (ADR-0008) y estados;
  - versiones con la de la IA intacta, evaluación del docente y preferencias;
  - "Mis recursos" y agrupado por tema.

  Nada queda listo sin acción del docente.

- **RN-02 — Sesiones.**
  - Exactamente las pedidas, numeradas.
  - Cada una con título, inicio, desarrollo y cierre (de 20 a 1500 caracteres cada uno), recursos (0 a 6)
    y minutos.
  - Los minutos de inicio, desarrollo y cierre suman lo de la sesión (±10 %).
  - Cada sesión cita al menos un DBA de los datos, si los hay.
- **RN-03 — Rúbrica.**
  - De 2 a 5 criterios.
  - Cada criterio tiene un descriptor por desempeño (Superior, Alto, Básico y Bajo), distintos entre sí y
    de 10 a 300 caracteres.
  - El Bajo describe lo que falta, sin juicios sobre la persona.
  - La IA no escribe rangos ni notas: los pone el producto con la escala del espacio.
- **RN-04 — Escala de valoración.**
  - `min` < `max`, con `max` de 5, 10 o 100.
  - Los 4 rangos son contiguos, sin huecos ni cruces, en el orden Bajo < Básico < Alto < Superior, y
    cubren de `min` a `max`.
  - Una cifra decimal en la escala de 5; enteros en las de 10 y 100.
  - Se guarda en el espacio (`institutions.gradingBands`).
  - Al cambiarla, los planes muestran los rangos nuevos: no se copia en cada plan.
- **RN-05 — Documentos.** El plan sale como documento del docente: encabezado, propósito, DBA y objetivos,
  sesiones, evaluación y la rúbrica como tabla con los rangos de la escala. Lleva marca de borrador hasta
  que esté listo.
- **RN-06 — Privacidad.** El plan no tiene datos de estudiantes. A la IA van solo los datos del tema, como
  en el taller.

## 5. Entradas

- Blueprint: `{ type: "LESSON_PLAN", topicId, objectiveIds, sessions, minutesPerSession, difficulty,
notes, excludedPreferenceIds }`.
- Escala: `{ min, max, bands: { LOW: {from, to}, BASIC: …, HIGH: …, SUPERIOR: … } }`.
- Contrato `generation-lesson-plan.v1` (`POST /v1/generation/lesson-plan`): contexto del tema (como el
  taller), `sessions` y `minutesPerSession`.

## 6. Salidas

- Recurso `LESSON_PLAN` con su contenido versionado.
- Documento Word y PDF del plan.
- Página "Escala de valoración" en Ajustes.

## 7. Errores y casos límite

| Caso                                               | Comportamiento esperado                                        |
| -------------------------------------------------- | -------------------------------------------------------------- |
| Rangos con hueco o cruce                           | "Los rangos deben ir seguidos, de Bajo a Superior, sin huecos" |
| Un docente de un colegio intenta cambiar la escala | Prohibido: solo el administrador                               |
| Sesiones con minutos que no suman                  | Reparación con el error concreto                               |
| Rúbrica con dos desempeños iguales                 | Reparación                                                     |
| Plan sin DBA (asignatura sin catálogo)             | Se genera sin citar DBA                                        |

## 8. Criterios de aceptación

- **CA-0024-01:** Dado un tema, cuando el docente pide un plan de 3 sesiones de 55 minutos, entonces el
  recurso queda en "generando", luego en borrador con 3 sesiones, rúbrica y evaluación, y gasta 1 del cupo.
- **CA-0024-02:** Dado el AI Engine, cuando el plan trae sesiones de menos, minutos que no suman, una
  rúbrica con un desempeño vacío o repetido, o un DBA inventado, entonces la reparación recibe el error
  concreto y tras 3 intentos responde `502`.
- **CA-0024-03:** Dada la escala predeterminada, cuando se lee la del espacio, entonces es 1,0–5,0 con los
  4 rangos nacionales. Dada una escala de 1 a 10 válida guardada por el administrador, cuando un docente
  abre su plan, entonces la rúbrica muestra esos rangos.
- **CA-0024-04:** Dados rangos con hueco, cruzados o fuera de la escala, cuando se guardan, entonces se
  rechazan. Dado un docente de un colegio, cuando intenta guardar la escala, entonces es prohibido. Dado un
  administrador de otro colegio, entonces no cambia la de este (acceso cruzado).
- **CA-0024-05:** Dado un plan, cuando el docente edita el desarrollo de la sesión 2 y un descriptor de la
  rúbrica, entonces se guarda una versión nueva y la de la IA sigue intacta.
- **CA-0024-06:** Dado un plan, cuando se descarga en Word y PDF, entonces trae las sesiones en orden y la
  rúbrica con los rangos de la escala del espacio, y la marca de borrador si no está listo.
- **CA-0024-07:** Dado el asistente "Crear", cuando el docente elige "Plan de aula", el curso, el tema y
  los ajustes, entonces se genera y se abre el plan en el editor. En el celular (360 px) no hay
  desbordes ni violaciones de axe.

## 9. Seguridad y privacidad

- Tenancy:
  - el plan es un recurso, con su filtro por espacio y docente;
  - la escala se lee y se escribe con `ctx.institutionId`;
  - solo el administrador o el docente independiente cambian la escala, comprobado en el servidor.
- Sin datos de estudiantes.

## 10. Tareas

- [x] T1 — ADR-0019 — architect
- [x] T2 — `ResourceType.LESSON_PLAN`, `institutions.gradingBands` y migración — database
- [x] T3 — `app/generation/lesson_plan.py`, prompt `lesson_plan.v1`, endpoint, mock y pruebas — ai-engine
- [x] T4 — Blueprint, contenido, generación, escala (servicio y página) — backend
- [x] T5 — Asistente, ajustes, editor del plan y rúbrica — frontend
- [x] T6 — Word y PDF del plan — documents
- [x] T7 — Pruebas por CA — qa (la revisión formal con `/review SPEC-0024` queda pendiente)
