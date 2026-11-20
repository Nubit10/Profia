# SPEC-0019 — Asistente de crear: un paso por pantalla, lo elegido en los pasos y «Atrás»

| Campo                    | Valor                                            |
| ------------------------ | ------------------------------------------------ |
| Estado                   | **Implementada**                                 |
| Fase del roadmap         | Transversal (UX; continúa SPEC-0012 y SPEC-0013) |
| Módulo(s) responsable(s) | `app/(app)/create/` · `components/stepper.tsx`   |
| Agentes                  | product, frontend, qa                            |
| ADR relacionados         | —                                                |
| Autor / Fecha            | product / 2026-11-20                             |

## 1. Objetivo

En "Crear con IA", al elegir el curso aparecían los temas debajo en la misma pantalla (sobre todo en el
examen) y lo elegido se repetía en una tarjeta aparte ("Curso … / Tema …") que no aportaba. El docente
quiere un paso a paso de verdad: en cada pantalla elige una cosa y avanza, ve siempre lo que ya eligió y
puede volver al paso anterior.

## 2. Alcance

**Incluye:**

- Pasos separados: taller y quiz **Qué crear → Curso → Tema → Ajustes**; examen **Qué crear → Curso →
  Temas → Ajustes → Confirmar**; planeación **Qué crear → Curso**.
- La pantalla del curso solo muestra los cursos; elegir uno avanza a la del tema. La del tema no muestra
  la lista de cursos.
- Lo elegido se ve en los pasos, no en una tarjeta: en escritorio, bajo el nombre del paso hecho
  ("Curso / Educación Religiosa · 3°"); en el celular, fichas bajo la barra de avance ("Curso:
  Educación Religiosa · 3° · 601 ✎"). Tocar uno lleva a cambiarlo.
- **Volver al paso anterior** ("← Volver al curso", "← Volver a los temas"…) en todos los pasos después del
  primero, **debajo de los pasos** y antes del contenido, igual en escritorio y celular.
- Se elimina la tarjeta de resumen "Curso / Tema".

**No incluye:** cambios en los ajustes, la generación ni el material de referencia (SPEC-0020).

## 3. Reglas de negocio

- **RN-01:** Con un solo curso, el paso del curso se salta (como antes); «Atrás» o tocar el curso lleva
  a la lista igual (`curso=elegir`).
- **RN-02:** Con un solo tema, el taller y el quiz saltan al ajuste (SPEC-0013 RN-03); tocar el tema
  deja elegir otro (`elegir=1`).
- **RN-03:** Volver a los temas del examen conserva lo marcado (SPEC-0012 RN-04).
- **RN-04:** El paso sigue saliendo de la URL: recargar o usar el botón Atrás del navegador no pierde
  el avance.
- **RN-05:** Controles de 44 px en el celular; ninguna ficha pasa del ancho de la pantalla.

## 4. Criterios de aceptación

- **CA-0019-01:** La pantalla del curso no muestra temas ni el campo de tema nuevo.
- **CA-0019-02:** Elegir el curso abre otra pantalla con los temas, sin la lista de cursos; continuar
  con los temas abre los ajustes, sin los temas.
- **CA-0019-03:** Los pasos hechos muestran lo elegido (tipo, curso, tema o temas) y tocarlos lleva a
  cambiarlo.
- **CA-0019-04:** «Atrás» vuelve al paso anterior, en escritorio y en el celular, conservando lo marcado.
- **CA-0019-05:** No aparece la tarjeta "Curso / Tema".
- **CA-0019-06:** En el celular, lo elegido va en fichas de al menos 44 px que no se salen de la pantalla.

Pruebas: `tests/e2e/spec-0019.spec.ts`, `tests/e2e/spec-0019.movil.spec.ts` y ajustes en `ux.spec.ts`
y `spec-0013.spec.ts`. Capturas: `docs/design/capturas/spec-0019/`.

## 5. Tareas

- [x] T1 — Separar curso y tema en pasos propios (`create-wizard.tsx`, `page.tsx` con `curso=elegir`) — frontend
- [x] T2 — `Stepper` con `values` (lo elegido); enlace para volver debajo de los pasos (2026-11-20: el
      usuario lo pidió ahí, ni suelto encima de los pasos ni arriba del título) — frontend
- [x] T3 — Quitar `ChoiceSummary` — frontend
- [x] T4 — Pruebas e2e y capturas — qa
