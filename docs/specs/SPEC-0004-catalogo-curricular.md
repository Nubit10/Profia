# SPEC-0004 — Catálogo curricular oficial (DBA y Estándares) por curso

| Campo                    | Valor                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| Estado                   | **Implementada** (2026-10-01) — revisión docente del contenido pendiente |
| Fase del roadmap         | 3 · Curriculum                                                           |
| Módulo(s) responsable(s) | `modules/curriculum`, `modules/courses` (vínculo de áreas)               |
| Agentes                  | curriculum, domain, database, backend, frontend, qa, reviewer            |
| ADR relacionados         | ADR-0005                                                                 |
| Autor / Fecha            | Claude, aprobada por el product owner / 2026-10-01                       |

## 1. Objetivo

Que el docente vea, desde cada curso, los **referentes oficiales del MEN** para esa área y ese grado (DBA con sus evidencias, y Estándares Básicos de Competencias), con la fuente citada. Es el contexto curricular sobre el que se apoyarán la planificación (Fase 4) y la generación con IA (Fase 6).

## 2. Alcance

**Incluye:**

- Modelo del catálogo global y versionado (ADR-0005): fuentes, áreas curriculares e ítems (DBA y estándares).
- Comando de importación idempotente desde archivos JSON del repositorio, validados con schema.
- **Contenido inicial:** DBA de Matemáticas (v2) y Lenguaje de 1° a 11°, y los DBA de Transición (documento propio del MEN, no dividido por áreas, que aplica a cualquier curso de Transición).
- Vínculo **asignatura → área curricular**: las asignaturas precargadas de la Ley 115 se vinculan solas (Matemáticas → Matemáticas; Lengua Castellana → Lenguaje; Ciencias Naturales y Educación Ambiental → Ciencias Naturales; Ciencias Sociales → Ciencias Sociales; Inglés → Inglés). Las asignaturas propias pueden vincularse a un área.
- **Página del curso** (`/courses/[id]`): sus referentes por área y grado, con enunciado, evidencias de aprendizaje y cita de la fuente con enlace a la página del PDF (los ejemplos se consultan allí: tienen tablas y figuras que no se transcriben fielmente) (documento, versión, año, página, enlace oficial).
- Filtro por texto dentro de los referentes del curso (búsqueda literal; la búsqueda semántica es SPEC-0005).

**No incluye (explícitamente):**

- Vincular referentes a objetivos o temas (Fase 4, Planning).
- Lineamientos curriculares y orientaciones pedagógicas (se agregan con el mismo modelo después).
- Búsqueda semántica y RAG (SPEC-0005).
- Edición del catálogo desde la aplicación (ADR-0005).

## 3. Actores y permisos

| Actor                     | Puede                                                                | No puede                   |
| ------------------------- | -------------------------------------------------------------------- | -------------------------- |
| Docente (dueño del curso) | Ver los referentes de sus cursos; vincular sus asignaturas a un área | Editar el catálogo oficial |
| `ADMIN`                   | Vincular las asignaturas del espacio a un área                       | Editar el catálogo oficial |
| Equipo de Profe (repo)    | Agregar o actualizar fuentes con un PR y el comando de importación   | —                          |

## 4. Reglas de negocio

- **RN-01:** Cada ítem pertenece a una fuente y conserva su `code` estable, enunciado, área, grado (DBA) o rango de grados (estándares), evidencias, componente o eje, y página de referencia.
- **RN-02:** Una fuente nueva de un mismo documento (otra versión) deja a la anterior `SUPERSEDED`, sin borrar sus ítems. Por defecto se muestran solo los ítems de fuentes `PUBLISHED`.
- **RN-03:** La importación es idempotente: reimportar el mismo archivo no duplica nada; un archivo inválido no escribe nada (transacción).
- **RN-04:** Toda vista de un ítem muestra su cita: emisor, documento, versión, año y página, más enlace a la fuente oficial.
- **RN-05:** El texto del catálogo se muestra tal como está en la fuente; no se resume ni se reescribe con IA.
- **RN-06:** Los estándares agrupan grados (1–3, 4–5, 6–7, 8–9, 10–11): un estándar aplica a un curso si su grado cae en el rango.
- **RN-07:** Un curso cuya asignatura no tiene área vinculada muestra cómo vincularla, en vez de una lista vacía sin explicación.

## 5. Entradas

- Archivos `apps/web/curriculum/men/<documento>-<version>.json` con `source` (issuer, title, documentType, area, version, year, url, usageNote) e `items[]` (code, number, type, grade o gradeFrom/gradeTo, component, statement, evidences[], example, page).
- Vincular asignatura: `subjectId`, `curriculumAreaId` (o vacío para desvincular).

## 6. Salidas

- Tablas `curriculum_sources`, `curriculum_areas`, `curriculum_items`, y la columna `subjects.curriculumAreaId`.
- Página del curso con los referentes y sus citas.
- Reporte del comando de importación: fuentes e ítems creados, actualizados y sin cambios.

## 7. Errores y casos límite

| Caso                                                            | Comportamiento esperado                                         |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| Archivo con `code` repetido o campo faltante                    | La importación falla nombrando el archivo y el ítem; no escribe |
| Curso de otro profesor o de otro espacio                        | 404                                                             |
| Asignatura propia sin área                                      | Mensaje con el botón "Vincular a un área curricular"            |
| Grado sin DBA en esa área (por ejemplo, Sociales en Transición) | "El MEN no publica DBA de esta área para este grado"            |
| Fuente reemplazada                                              | Sus ítems no se muestran por defecto, pero siguen en la base    |

## 8. Criterios de aceptación

- **CA-0004-01:** Dado un archivo válido, cuando se importa dos veces, entonces la segunda no crea ni duplica nada, y el reporte lo indica.
- **CA-0004-02:** Dado un archivo con un error, cuando se importa, entonces falla nombrando el problema y la base queda intacta.
- **CA-0004-03:** Dada una versión nueva de una fuente, cuando se importa, entonces la anterior queda `SUPERSEDED` y sus ítems se conservan.
- **CA-0004-04:** Dado un curso de Matemáticas 6°, cuando el docente abre su página, entonces ve los DBA de Matemáticas de 6° con evidencias y cita (documento, versión, año, página, enlace).
- **CA-0004-05:** Dado un espacio nuevo, las asignaturas precargadas quedan vinculadas a su área según la sección 2.
- **CA-0004-06:** Dada una asignatura propia, cuando el docente la vincula a un área, entonces sus cursos muestran los referentes de esa área.
- **CA-0004-07:** Dado un curso de otro profesor o de otro espacio, su página responde 404.
- **CA-0004-08:** El texto mostrado de cada ítem es idéntico al del archivo importado.

## 9. Seguridad y privacidad

- El catálogo es público y no tiene datos personales.
- La página del curso usa `requireTenant()` y verifica que el curso sea del docente.
- Vincular asignaturas a un área se audita (`subject.area_linked`).

## 10. Tareas

- [x] T1 — ADR-0005 aceptado; migración del catálogo y de `subjects.curriculumAreaId` — `database`
- [x] T2 — Schema Zod de los archivos y comando `curriculum:import` — `curriculum` / `backend`
- [x] T3 — Transcribir y revisar DBA de Matemáticas v2 y Lenguaje (Transición–11°) — `curriculum` + revisión humana
- [x] T4 — `modules/curriculum`: consultas por área y grado; vínculo de asignaturas — `backend`
- [x] T5 — Página del curso con referentes y citas; vincular asignatura a un área — `frontend`
- [x] T6 — Tests de importación (idempotencia, error, versión), consultas y E2E — `qa`
- [x] T7 — Revisión contra spec y DoD — `reviewer`

## 11. Decisiones del product owner (2026-10-01)

- Se guardan y muestran los textos oficiales del MEN **citando siempre la fuente y enlazando al MEN**. Antes del lanzamiento comercial se hace una revisión legal.
- Contenido inicial: Matemáticas y Lenguaje (más Transición). Las demás áreas y los Estándares vienen después, con el mismo modelo.
- La transcripción la hace Claude desde los PDF oficiales. **Una persona del equipo del product owner revisa una muestra** contra el original antes de marcar la fuente como revisada (`reviewedBy`, `reviewedAt` en el archivo).

## 12. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado   | Evidencia                                                                                                      |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| CA-0004-01 | Cumplido | `tests/integration/curriculum.test.ts` (segunda importación `unchanged`); comando real corrido dos veces       |
| CA-0004-02 | Cumplido | Integración: código repetido y enunciado vacío fallan nombrando archivo y campo; la base queda vacía           |
| CA-0004-03 | Cumplido | Integración: V2 deja a V1 `SUPERSEDED`, conserva sus ítems y el curso muestra solo V2; quitar ítems se rechaza |
| CA-0004-04 | Cumplido | Integración (Matemáticas 6° con cita completa; Transición con 16 DBA); E2E con enlace a la página del PDF      |
| CA-0004-05 | Cumplido | Integración (5 áreas vinculadas al crear el espacio); la migración vincula las asignaturas existentes          |
| CA-0004-06 | Cumplido | Integración y E2E (asignatura propia → Lenguaje → 8 DBA)                                                       |
| CA-0004-07 | Cumplido | Integración (`NOT_FOUND`) y E2E (404 para otro docente)                                                        |
| CA-0004-08 | Cumplido | Integración: el texto en la base es idéntico al archivo para los 223 ítems                                     |

**Contenido:** 119 DBA de Matemáticas V.2, 88 de Lenguaje V.2 y 16 de Transición V.1. `curriculum:verify` confirma que el texto es literal respecto al PDF y que no falta ninguna evidencia. Las 9 reasignaciones de evidencias quedan documentadas en `curriculum/tools/fixes/` y en la guía `docs/curriculum/revision-dba.md`.

**Pendiente (bloquea marcar las fuentes como `APPROVED`, no la spec):** revisión docente de la muestra y de las 9 reasignaciones por el equipo del product owner.

**Veredicto:** Aprobado. El contenido se muestra con el aviso «pendiente de revisión docente» hasta la aprobación.
