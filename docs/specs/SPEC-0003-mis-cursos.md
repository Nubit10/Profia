# SPEC-0003 — Mis cursos y áreas de la Ley 115

| Campo                    | Valor                                                      |
| ------------------------ | ---------------------------------------------------------- |
| Estado                   | **Implementada** (2026-10-01)                              |
| Fase del roadmap         | 2 · Identity                                               |
| Módulo(s) responsable(s) | `modules/courses`                                          |
| Agentes                  | product, domain, database, backend, frontend, qa, reviewer |
| ADR relacionados         | ADR-0004                                                   |
| Depende de               | SPEC-0002                                                  |
| Autor / Fecha            | Claude, aprobada por el product owner / 2026-10-01         |

## 1. Objetivo

Que cada profesor organice su trabajo por **cursos**: "Matemáticas · 6° · 601". Un curso es el contexto sobre el que, en las fases siguientes, el profesor planifica, genera materiales y evalúa (milestone MVP).

Profe **no es un sistema académico**: nadie asigna cursos. Cada profesor crea los suyos.

## 2. Alcance

**Incluye:**

- **Asignaturas** del espacio, precargadas al crearlo con las áreas obligatorias y fundamentales de la **Ley 115 de 1994** (arts. 23 y 31). Cualquier profesor puede agregar asignaturas propias.
- **Cursos** del profesor: asignatura + grado (jardín a 11°) + grupo (por ejemplo "601" o "B"; opcional) + año lectivo + sede (opcional, solo en colegios).
- Pantalla **"Mis cursos"** en el inicio: listar, crear, editar, archivar y desarchivar.
- Cada profesor ve **solo sus cursos**.

**No incluye (explícitamente):**

- Estudiantes y listas de clase.
- Vincular la asignatura con estándares y DBA oficiales (Fase 3, Curriculum).
- Periodos, unidades y temas (Fase 4).
- Que el administrador vea o gestione los cursos de sus profesores (Fase 11).

## 3. Actores y permisos

| Actor                     | Puede                                                                     | No puede                                   |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| Miembro con rol `TEACHER` | Crear, editar, archivar y desarchivar **sus** cursos; agregar asignaturas | Ver o modificar cursos de otros profesores |
| `ADMIN`                   | Archivar y desarchivar asignaturas del espacio                            | Ver cursos ajenos (en esta spec)           |
| Miembro de otro espacio   | —                                                                         | Ver o modificar nada (404)                 |

Un ADMIN de colegio que no da clases (sin rol `TEACHER`) no tiene "Mis cursos".

## 4. Reglas de negocio

- **RN-01:** Asignaturas precargadas (Ley 115, arts. 23 y 31): Ciencias Naturales y Educación Ambiental · Ciencias Sociales · Educación Artística · Ética y Valores Humanos · Educación Física, Recreación y Deportes · Educación Religiosa · Lengua Castellana · Inglés · Matemáticas · Tecnología e Informática · Filosofía · Ciencias Económicas y Políticas. Se marcan como precargadas.
- **RN-02:** El nombre de la asignatura es único por espacio, sin distinguir mayúsculas ni acentos.
- **RN-03:** Grados: `JARDIN`, `TRANSICION`, `G1` … `G11`. Se muestran como "Jardín", "Transición", "1°" … "11°".
- **RN-04:** Año lectivo `AAAA` o `AAAA-AAAA`; por defecto, el año en curso.
- **RN-05:** No puede haber dos cursos del mismo profesor con la misma asignatura, grado, grupo y año.
- **RN-06:** La sede solo se elige en colegios y debe ser una sede activa del mismo colegio. En espacios independientes el curso usa la sede interna del espacio, que no se muestra (así la base garantiza con FK compuesta que la sede es del mismo espacio).
- **RN-07:** Un curso o asignatura archivado no aparece por defecto y no admite cursos nuevos sobre él; se conserva (trazabilidad).
- **RN-08:** Curso, asignatura, sede y membresía pertenecen al mismo espacio, garantizado por la base con FK compuestas (ADR-0004).

## 5. Entradas

- **Asignatura:** `name` (2–80).
- **Curso:** `subjectId`, `grade`, `groupName` (0–20, opcional), `academicYear`, `campusId` (opcional).
- **Archivar o desarchivar:** `id`.

## 6. Salidas

- Tablas `subjects` (con `isPreloaded`) y `courses`.
- Auditoría: `subject.created`, `subject.archived`, `subject.unarchived`, `course.created`, `course.updated`, `course.archived`, `course.unarchived`.
- Inicio con "Mis cursos": tarjetas con asignatura, grado, grupo, año y sede.

## 7. Errores y casos límite

| Caso                                           | Comportamiento esperado                           |
| ---------------------------------------------- | ------------------------------------------------- |
| Curso duplicado                                | "Ya tienes este curso"                            |
| Asignatura duplicada (mayúsculas o acentos)    | "Esa asignatura ya existe"                        |
| Asignatura o sede archivada, o de otro espacio | Se rechaza / 404                                  |
| Sede en espacio independiente                  | Se ignora (no aplica)                             |
| Curso de otro profesor del mismo colegio       | 404                                               |
| Sin cursos                                     | Estado vacío con el botón "Crear mi primer curso" |

## 8. Criterios de aceptación

- **CA-0003-01:** Dado un espacio recién creado (independiente o colegio), entonces tiene las 12 asignaturas de la Ley 115 precargadas.
- **CA-0003-02:** Dado un profesor, cuando crea un curso válido, entonces aparece en "Mis cursos" y se audita.
- **CA-0003-03:** Dado un curso igual (asignatura, grado, grupo, año), o una asignatura con el mismo nombre en otras mayúsculas o acentos, entonces se rechaza.
- **CA-0003-04:** Dado un profesor B del mismo colegio, cuando intenta ver, editar o archivar un curso de A, entonces recibe 404.
- **CA-0003-05:** Dado un usuario del espacio A, cuando usa IDs de asignatura, sede o curso de B, entonces recibe 404; un insert directo que mezcle espacios falla por la FK compuesta.
- **CA-0003-06:** Dado un curso archivado, entonces no aparece por defecto y puede desarchivarse. Una asignatura archivada no se ofrece para cursos nuevos.
- **CA-0003-07:** Dado un miembro sin rol `TEACHER`, entonces no puede crear cursos.

## 9. Seguridad y privacidad

- Todas las operaciones con `requireTenant()`; los cursos además filtran por la membresía del profesor.
- Sin datos personales nuevos.

## 10. Tareas

- [x] T1 — Migración: `Subject`, `Course` con FK compuestas; precarga de asignaturas al crear un espacio — `database`
- [x] T2 — `modules/courses` — `backend`
- [x] T3 — "Mis cursos" en el inicio y gestión de asignaturas — `frontend`
- [x] T4 — Tests de integración (dueño del curso, acceso cruzado, FK) y E2E — `qa`
- [x] T5 — Revisión contra spec y DoD — `reviewer`

## 11. Decisiones del product owner (2026-10-01)

- No hay carga académica asignada: cada profesor crea sus cursos.
- Grados de jardín a 11°.
- Precargar las áreas de la Ley 115.

## 12. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado   | Evidencia                                                                                              |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------ |
| CA-0003-01 | Cumplido | `tests/integration/institutions.test.ts` (12 asignaturas en espacio independiente y colegio)           |
| CA-0003-02 | Cumplido | `tests/integration/courses.test.ts` (auditado); E2E `workspaces.spec.ts`                               |
| CA-0003-03 | Cumplido | Integración (curso y asignatura duplicados, mayúsculas y acentos); E2E (curso duplicado)               |
| CA-0003-04 | Cumplido | Integración: otro profesor del mismo colegio → `NOT_FOUND` al ver, editar o archivar                   |
| CA-0003-05 | Cumplido | Integración: IDs de otro espacio → `NOT_FOUND`; insert directo que mezcla espacios rechazado por la FK |
| CA-0003-06 | Cumplido | Integración (archivar y desarchivar; asignatura archivada no se ofrece; el curso existente se edita)   |
| CA-0003-07 | Cumplido | Integración (ADMIN sin rol docente → `FORBIDDEN`); el inicio muestra la tarjeta de administración      |

**Hallazgo corregido:** las asignaturas se ordenaban con la intercalación de la base ("Ética" al final); ahora se ordenan con las reglas del español.

**Veredicto:** Aprobado.
