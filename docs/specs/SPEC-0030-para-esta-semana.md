# SPEC-0030 — "Para esta semana" en el Inicio

| Campo                    | Valor                                                                        |
| ------------------------ | ---------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                 |
| Fase del roadmap         | Transversal de usabilidad                                                    |
| Módulo(s) responsable(s) | `modules/resources` (`overview.ts`) · Inicio                                 |
| Agentes                  | product, backend, frontend, qa                                               |
| ADR relacionados         | —                                                                            |
| Autor / Fecha            | product / 2026-11-21 (aprobada por el usuario: "lo demás, tu recomendación") |

## 1. Objetivo

"Crear rápido" todavía obligaba a elegir qué y para qué tema. El Inicio dice _"Lo que sigue en 6°01:
Fracciones equivalentes"_ con [Taller] [Quiz] [Plan de aula] y crea con un toque. Bloque 4 de
[usabilidad/proximos-pasos.md](../usabilidad/proximos-pasos.md).

## 2. Reglas de negocio

- **RN-01:** por curso (en el orden de "Mis cursos", máximo 3), el tema que sigue es el primero de la
  planeación, en orden, sin recursos activos del docente (los archivados no cuentan).
- **RN-02:** cada opción usa `createResourceQuick` (valores recomendados del grado, mismo cupo y
  avisos) y "Ajustar" abre el asistente con el curso y el tema elegidos.
- **RN-03:** mientras se muestran los "Primeros pasos", la tarjeta no aparece (un solo bloque guía).
- **RN-04:** solo temas y recursos del docente en su espacio.

## 3. Criterios de aceptación

- **CA-0030-01:** con 601 (tema 1 con quiz, tema 2 sin nada) y 602 (tema con un recurso archivado),
  el Inicio propone el tema 2 de 601 y el tema de 602.
- **CA-0030-02:** no aparecen temas de otro docente.
- **CA-0030-03:** "Crear quiz de «tema»" crea el quiz y abre el recurso (componente compartido
  `QuickCreateList`, el mismo de "¿Qué más necesitas?").

Pruebas: `tests/integration/usabilidad-bloques.test.ts`.
