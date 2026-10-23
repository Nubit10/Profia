# SPEC-0006 — Planeación del curso: periodos, unidades, temas y objetivos vinculados a los DBA

| Campo                    | Valor                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| Estado                   | **Implementada** (2026-10-01)                                          |
| Fase del roadmap         | 4 · Planning                                                           |
| Módulo(s) responsable(s) | `modules/planning` (nuevo)                                             |
| Agentes                  | product, domain, database, backend, frontend, curriculum, qa, reviewer |
| ADR relacionados         | ADR-0004, ADR-0005                                                     |
| Depende de               | SPEC-0003, SPEC-0004                                                   |
| Autor / Fecha            | Claude, aprobada por el product owner / 2026-10-01                     |

## 1. Objetivo

Que el profesor organice **lo que va a enseñar** en cada curso: periodos → unidades → temas → objetivos, en orden, y que cada objetivo quede **vinculado a los DBA oficiales** (y, si quiere, a evidencias concretas). Esta estructura es el contexto que usará la IA para generar planes de aula, talleres, quices y exámenes (Fase 6): el milestone del MVP dice "selecciona asignatura y **tema**, vincula contexto curricular…".

No es un sistema académico: no hay notas, horarios ni asistencia. Es la planeación del propio profesor.

## 2. Alcance

**Incluye:**

- **Periodos del curso:** cada profesor define los de cada curso. Por defecto 4 ("Periodo 1" … "Periodo 4"), con nombre editable y fechas opcionales.
- **Unidades** dentro de un curso, cada una en un periodo (o "sin periodo"), con título y descripción opcional.
- **Temas** dentro de una unidad, con título, descripción opcional y número estimado de sesiones (secuencia).
- **Objetivos de aprendizaje** dentro de un tema, redactados por el profesor.
- **Vínculo curricular** de cada objetivo: cero, uno o varios DBA del área y grado del curso y, opcionalmente, evidencias específicas de esos DBA.
- **Orden** (secuencia) de unidades, temas y objetivos: subir y bajar.
- **Cobertura:** qué DBA del grado ya están vinculados a algún objetivo y cuáles no.
- **Copiar la planeación** de un curso a otro curso propio de la misma asignatura y grado (p. ej. de 601 a 602), como copia independiente.
- Editar, archivar y restaurar unidades, temas y objetivos (nada se borra: más adelante tendrán recursos asociados).

**No incluye (explícitamente):**

- Generar unidades, temas u objetivos con IA (Fase 6).
- Clases o sesiones con fecha concreta (calendario) y plan de aula detallado (Fase 6, como recurso generado).
- Planeación compartida entre profesores o revisada por coordinación (Fase 11).
- Estándares Básicos de Competencias (se vinculan igual cuando se carguen en el catálogo).

## 3. Actores y permisos

| Actor                    | Puede                                                                                | No puede                                      |
| ------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| Profesor dueño del curso | Todo sobre la planeación y los periodos de **sus** cursos; copiarla entre sus cursos | Ver o editar la planeación de otro profesor   |
| `ADMIN` del espacio      | —                                                                                    | Ver la planeación de los profesores (Fase 11) |
| Miembro de otro espacio  | —                                                                                    | Nada (404)                                    |

## 4. Reglas de negocio

- **RN-01:** Cada curso tiene entre 1 y 6 periodos, numerados sin huecos. Si un curso sin periodos abre su planeación, se crean los 4 por defecto.
- **RN-02:** Las fechas de un periodo son opcionales; si existen, el inicio es anterior o igual al fin y los periodos no se solapan.
- **RN-03:** Quitar periodos solo es posible si no tienen unidades.
- **RN-04:** Unidad, tema, objetivo, periodo y vínculo pertenecen al mismo curso y espacio (FK compuestas, ADR-0004); solo el dueño del curso los ve y modifica.
- **RN-05:** Un objetivo solo se vincula a DBA **publicados** del área y grado del curso (en Transición, los de Transición). Las evidencias elegidas deben pertenecer a esos DBA.
- **RN-06:** El vínculo apunta al ítem exacto del catálogo (ADR-0005): si el MEN publica una versión nueva, el objetivo conserva el DBA con el que se planeó y se muestra «versión anterior del MEN».
- **RN-07:** El orden es explícito (posición) y se conserva al copiar.
- **RN-08:** Copiar crea elementos nuevos en el curso destino (no comparte nada con el original) y solo se permite hacia cursos propios de la misma asignatura y grado. Si el destino no tiene periodos, recibe una copia de los del origen; si los tiene, se conservan los suyos y cada unidad mantiene su número de periodo cuando existe en el destino (si no, queda "sin periodo"). Lo copiado se agrega al final de lo que ya exista.
- **RN-09:** Archivar una unidad la oculta con su contenido, sin borrarlo; restaurarla la devuelve intacta.
- **RN-10:** Se permiten objetivos sin DBA. Si el área del curso tiene DBA, el objetivo sin vínculo muestra un aviso.

## 5. Entradas

- **Periodos:** `courseId`, lista de `{ number, name (2–40), startDate?, endDate? }`.
- **Unidad:** `courseId`, `periodNumber?`, `title` (3–150), `description?` (≤ 2.000).
- **Tema:** `unitId`, `title` (3–150), `description?` (≤ 2.000), `plannedSessions?` (1–60).
- **Objetivo:** `topicId`, `statement` (5–500), `links: [{ code, evidenceIndexes }]`.
- **Mover:** `id`, `direction` (`up` · `down`).
- **Copiar:** `fromCourseId`, `toCourseId`.

## 6. Salidas

- Tablas `course_periods`, `units`, `topics`, `objectives`, `objective_curriculum_links`.
- Pestaña **Planeación** en la página del curso (junto a **Referentes**): periodos → unidades → temas → objetivos, con los DBA vinculados de cada objetivo y su cita.
- Panel de **cobertura**: DBA del grado vinculados / pendientes.
- Editor de **periodos del curso** dentro de la pestaña Planeación.
- Auditoría: `course_periods.updated`, `unit.*`, `topic.*`, `objective.*`, `planning.copied`.

## 7. Errores y casos límite

| Caso                                                  | Comportamiento esperado                                    |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| Vincular un DBA de otra área o grado                  | Se rechaza                                                 |
| Vincular una evidencia que no es de ese DBA           | Se rechaza                                                 |
| DBA vinculado de una fuente reemplazada               | Se conserva y se muestra «versión anterior del MEN»        |
| Asignatura sin área curricular                        | Se puede planear; el vínculo pide vincular primero el área |
| Copiar a un curso de otra asignatura o grado, o ajeno | Se rechaza / 404                                           |
| Copiar a un curso que ya tiene planeación             | Se agrega al final de lo existente (no reemplaza)          |
| Quitar un periodo que tiene unidades                  | «El periodo 4 tiene unidades; muévelas antes»              |
| Mover el primer elemento hacia arriba                 | No hace nada                                               |

## 8. Criterios de aceptación

- **CA-0006-01:** Dado un curso sin periodos, cuando el profesor abre la planeación, entonces el curso tiene 4 periodos por defecto.
- **CA-0006-02:** Dado un profesor, cuando define 3 periodos con fechas válidas en su curso, entonces ese curso muestra 3 y los demás no cambian; fechas solapadas o quitar un periodo con unidades se rechaza.
- **CA-0006-03:** Dado un profesor, cuando crea unidad → tema → objetivo, entonces aparecen en orden en su periodo, y se auditan.
- **CA-0006-04:** Dado un objetivo, cuando lo vincula a DBA del área y grado del curso (con o sin evidencias), entonces se muestran con su cita; un DBA de otro grado o área, o una evidencia ajena, se rechaza.
- **CA-0006-05:** Dada la planeación, el panel de cobertura muestra qué DBA del grado tienen al menos un objetivo y cuáles no.
- **CA-0006-06:** Dado un elemento, cuando se sube o baja, el nuevo orden se conserva al recargar.
- **CA-0006-07:** Dado un curso con planeación, cuando se copia a otro curso propio de la misma asignatura y grado, entonces el destino tiene una copia independiente (editar una no cambia la otra), con el mismo orden y vínculos.
- **CA-0006-08:** Dado otro profesor del mismo colegio, o un usuario de otro espacio, cuando usa IDs de la planeación ajena, recibe 404; un insert que mezcle cursos o espacios falla por FK compuesta.
- **CA-0006-09:** Archivar una unidad la oculta con su contenido; restaurarla la devuelve intacta.
- **CA-0006-10:** Un objetivo sin DBA se guarda; si el área tiene DBA, se muestra el aviso.

## 9. Seguridad y privacidad

- `requireTenant()`; toda consulta filtra por `institutionId` y por la membresía dueña del curso.
- Sin datos personales nuevos: la planeación es contenido pedagógico del profesor.
- Los textos de la planeación serán contexto para la IA (Fase 6): se tratarán como datos, nunca como instrucciones.

## 10. Tareas

- [x] T1 — Migración: periodos, unidades, temas, objetivos y vínculos, con FK compuestas — `database`
- [x] T2 — Periodos del curso (servicio + editor) — `backend` / `frontend`
- [x] T3 — `modules/planning`: CRUD, orden, archivo, vínculo curricular, cobertura, copia — `backend` / `curriculum`
- [x] T4 — Pestaña Planeación en el curso: árbol, formularios, diálogo de vínculo con DBA — `frontend`
- [x] T5 — Tests de integración (permisos, FK, vínculos, copia, orden) y E2E — `qa`
- [x] T6 — Revisión contra spec y DoD — `reviewer`

## 11. Decisiones del product owner (2026-10-01)

- Los periodos los define **cada profesor en cada curso**; 4 por defecto.
- Se incluye copiar la planeación entre cursos de la misma asignatura y grado.
- Se incluye el vínculo opcional a evidencias específicas de cada DBA.
- Se permiten objetivos sin DBA, con un aviso cuando el área sí tiene DBA.

## 12. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado   | Evidencia                                                                                                                        |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| CA-0006-01 | Cumplido | `tests/integration/planning.test.ts` (4 por defecto, idempotente); E2E (4 encabezados de periodo)                                |
| CA-0006-02 | Cumplido | Integración (3 periodos con fechas, otro curso intacto, quitar periodo con unidades → CONFLICT); E2E                             |
| CA-0006-03 | Cumplido | Integración (orden, periodo, auditoría) y E2E (unidad → tema con sesiones → objetivo)                                            |
| CA-0006-04 | Cumplido | Integración (evidencias ordenadas sin repetir, cita; otro grado, otra área, evidencia ajena o código inexistente → INVALID); E2E |
| CA-0006-05 | Cumplido | Integración (vinculados y pendientes) y E2E (cobertura 0 → 1)                                                                    |
| CA-0006-06 | Cumplido | Integración (subir, extremo sin cambios) y E2E (el orden se conserva al recargar)                                                |
| CA-0006-07 | Cumplido | Integración (copia independiente con orden y evidencias; destino con periodos propios) y E2E                                     |
| CA-0006-08 | Cumplido | Integración: 8 operaciones de otro profesor del mismo colegio → NOT_FOUND; insert que mezcla espacios rechazado por FK           |
| CA-0006-09 | Cumplido | Integración (archivar oculta todo el contenido; restaurar lo devuelve)                                                           |
| CA-0006-10 | Cumplido | Integración (objetivo sin DBA; aviso solo si el área tiene DBA) y captura de pantalla                                            |

**Hallazgos corregidos durante la implementación:** los formularios cerraban el diálogo sin refrescar los datos (la unidad nueva no aparecía hasta recargar); los creates anidados de Prisma no aceptan `institutionId` cuando llega por la FK compuesta.

**Límites conocidos (no bloqueantes):** el orden se cambia con botones subir y bajar (no hay arrastrar y soltar); el panel de cobertura cuenta solo DBA (los estándares, cuando se carguen).

**Veredicto:** Aprobado.
