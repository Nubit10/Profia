# SPEC-0033 — Barra de navegación abajo en el celular

| Campo                    | Valor                                                                        |
| ------------------------ | ---------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                 |
| Fase del roadmap         | Transversal de usabilidad                                                    |
| Módulo(s) responsable(s) | `components/app-shell`                                                       |
| Agentes                  | product, frontend, qa                                                        |
| ADR relacionados         | —                                                                            |
| Autor / Fecha            | product / 2026-11-21 (aprobada por el usuario: "lo demás, tu recomendación") |

## 1. Objetivo

Llegar a "Mis recursos" en el celular tomaba 3 toques (menú de tres rayas). Bloque 7 de
[usabilidad/proximos-pasos.md](../usabilidad/proximos-pasos.md).

## 2. Reglas de negocio

- **RN-01:** debajo de `lg`, para el docente, barra fija abajo: Inicio · Mis cursos · **Crear**
  (centro, abre el menú de crear) · Mis recursos. Reemplaza el botón flotante "Crear".
- **RN-02:** no aparece en la página de un recurso ni de un PIAR (tienen su propia barra) ni dentro
  del asistente de crear. Lleva `data-floating="tab-bar"` (la prueba de elementos encimados la cubre).
- **RN-03:** cada destino mide al menos 44 px y marca la página actual con `aria-current`.

## 3. Criterios de aceptación

- **CA-0033-01:** a 360 px la barra muestra los cuatro destinos, "Mis recursos" lleva a `/resources`
  y queda marcado, y "Crear" abre el menú (`tests/e2e/usabilidad-bloques.movil.spec.ts`).
