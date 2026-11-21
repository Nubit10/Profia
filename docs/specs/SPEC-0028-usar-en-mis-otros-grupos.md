# SPEC-0028 — Usar el mismo recurso en mis otros grupos, sin gastar cupo

| Campo                    | Valor                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                             |
| Fase del roadmap         | 6 · Generation (biblioteca) · Transversal de usabilidad                                  |
| Módulo(s) responsable(s) | `modules/resources` · `modules/planning`                                                 |
| Agentes                  | product, backend, frontend, auth-security, qa, reviewer                                  |
| ADR relacionados         | ADR-0004 (tenancy) · no requiere ADR nuevo (copia dentro del mismo módulo y del espacio) |
| Autor / Fecha            | product / 2026-11-21 (aprobada por el usuario: "lo demás, tu recomendación")             |

## 1. Objetivo

Es muy común dictar la misma materia en 601, 602 y 603. Hoy hay que crear el taller tres veces y
gastar tres del cupo. Con "Usar también en…" el docente lleva el recurso a sus otros grupos de la
misma asignatura y grado con un toque, **sin gastar cupo de IA**. Bloque 2 de
[usabilidad/proximos-pasos.md](../usabilidad/proximos-pasos.md).

## 2. Alcance

**Incluye:**

- En la página del recurso (menú "Más acciones" y botón en escritorio): **"Usar también en…"**, que
  abre una ventana con los otros cursos del docente de la misma asignatura y grado (no archivados),
  todos marcados por defecto.
- Por cada curso elegido se crea una **copia independiente**: contenido de la versión actual, ajustes,
  formato y escala; queda en "Borrador", versión 1, y no cuenta como generación con IA.
- El tema de destino se busca **por título** (sin tildes ni mayúsculas) entre los temas activos del
  curso. Si no existe, se crea en la unidad del mismo título (o se crea esa unidad, en el mismo
  periodo). En el examen se hace con cada uno de sus temas.
- Al terminar: aviso con los grupos y un enlace a cada copia.

**No incluye (explícitamente):**

- Copiar a cursos de otra asignatura o grado, o de otro docente.
- Mantener las copias sincronizadas (cada copia es independiente).
- Copiar los objetivos del tema (el docente los tiene en su planeación; la copia de planeación de
  SPEC-0006 ya los lleva).

## 3. Actores y permisos

| Actor         | Puede                                                           | No puede                                 |
| ------------- | --------------------------------------------------------------- | ---------------------------------------- |
| Docente dueño | Copiar sus recursos a sus cursos de la misma asignatura y grado | Copiar a cursos ajenos o de otro espacio |
| Otro docente  | —                                                               | Ver o copiar recursos ajenos             |

## 4. Reglas de negocio

- **RN-01 — Sin cupo.** La copia no llama al AI Engine y no cuenta en el cupo diario.
- **RN-02 — Mismo docente, mismo espacio, misma asignatura y grado.** El servidor lo verifica por
  cada destino; un destino que no cumple hace fallar toda la operación (nada se copia a medias).
- **RN-03 — Tema equivalente.** Por título normalizado; si no hay, se crea (RN de §2). El tema creado
  queda en la planeación del curso como cualquier otro.
- **RN-04 — Lo que viaja.** Contenido actual, blueprint (con los temas del destino y sin objetivos),
  contexto pedagógico (DBA y asignatura; tema del destino), formato propio, escala de la clave.
  No viajan evaluaciones, comentarios ni ajustes pendientes.
- **RN-05 — Estado.** Las copias quedan en "Borrador" aunque el original esté "Listo".
- **RN-06 — Auditoría.** `resource.copied_to_course` en cada copia, con el recurso de origen.

## 5. Entradas

- `copyResourceToCourses({ resourceId, courseIds: string[1..12] })`.
- `listResourceCopyTargets(resourceId)` → cursos `{ id, label }`.

## 6. Salidas

`[{ courseId, courseLabel, resourceId, createdTopic: boolean }]`.

## 7. Errores y casos límite

| Caso                                                    | Comportamiento esperado                                        |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| El docente no tiene otros grupos de esa materia         | La ventana lo dice y ofrece crear un curso                     |
| Un destino es de otra asignatura/grado o ajeno          | No encontrado; no se copia nada                                |
| El recurso no tiene contenido (generándose/fallido)     | La opción no aparece; el servidor responde error de validación |
| El curso de destino tiene dos temas con el mismo título | Se usa el primero en orden de la planeación                    |

## 8. Criterios de aceptación

- **CA-0028-01:** Dado un taller en 601 y los cursos 602 y 603 de la misma asignatura y grado, cuando
  el docente lo usa en ambos, entonces cada curso tiene una copia en borrador, versión 1, con el mismo
  contenido, y el cupo no cambia.
- **CA-0028-02:** Si 602 ya tiene un tema con el mismo título (con otras mayúsculas o tildes), la copia
  queda en ese tema; si 603 no lo tiene, se crea en una unidad con el mismo título.
- **CA-0028-03:** Un examen con dos temas se copia con sus dos temas emparejados.
- **CA-0028-04:** Los cursos de otra asignatura o grado no se ofrecen y el servidor los rechaza.
- **CA-0028-05:** (Acceso cruzado) un docente de otro espacio o del mismo colegio no puede copiar un
  recurso ajeno ni a un curso ajeno.
- **CA-0028-06:** En el celular (360 px) la ventana es una hoja inferior, cada opción mide 44 px, no
  hay scroll horizontal y pasa axe.

## 9. Seguridad y privacidad

Servicios con `ctx: TenantContext`, filtro por `institutionId` y `membershipId` en el recurso y en
cada curso; FK compuestas existentes. Sin datos de estudiantes. Test de acceso cruzado (CA-0028-05).

## 10. Tareas

- [x] T1 — `matchTopicsInCourse` en `modules/planning` (buscar o crear tema y unidad) — backend
- [x] T2 — `listResourceCopyTargets` y `copyResourceToCourses` en `modules/resources` — backend
- [x] T3 — Ventana "Usar también en…" — frontend
- [x] T4 — Tests de integración (incl. acceso cruzado) y e2e móvil + axe — qa
