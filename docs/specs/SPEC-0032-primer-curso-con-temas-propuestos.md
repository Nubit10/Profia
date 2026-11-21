# SPEC-0032 — Primer curso sin escribir temas

| Campo                    | Valor                                                                        |
| ------------------------ | ---------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                 |
| Fase del roadmap         | Transversal de usabilidad (4 · Planning)                                     |
| Módulo(s) responsable(s) | `modules/planning` (`canProposeTopics`) · Inicio · planeación del curso      |
| Agentes                  | product, backend, frontend, qa                                               |
| ADR relacionados         | ADR-0013 (propuesta de planeación)                                           |
| Autor / Fecha            | product / 2026-11-21 (aprobada por el usuario: "lo demás, tu recomendación") |

## 1. Objetivo

Que el docente nuevo no tenga que escribir su primer tema: ProfIA le propone los del primer periodo
según los DBA (la propuesta de SPEC-0014 ya existe). Bloque 6 de
[usabilidad/proximos-pasos.md](../usabilidad/proximos-pasos.md).

## 2. Reglas de negocio

- **RN-01:** en "Primeros pasos", si el curso tiene DBA, el paso 2 es _"Revisa los temas que te
  propongo"_ y lleva a `/courses/{id}?tab=planeacion&proponer=1`, que abre la propuesta del periodo 1.
- **RN-02:** la propuesta solo se abre sola si el curso todavía no tiene unidades.
- **RN-03:** asignaturas sin DBA siguen con "Escribe tu primer tema".

## 3. Criterios de aceptación

- **CA-0032-01:** un curso de Matemáticas 6° sin temas tiene `canProposeTopics = true`; uno de
  Educación Física, `false` (`tests/integration/usabilidad-bloques.test.ts`).
- **CA-0032-02:** con `proponer=1` y sin unidades, la planeación abre con la propuesta del periodo 1.
