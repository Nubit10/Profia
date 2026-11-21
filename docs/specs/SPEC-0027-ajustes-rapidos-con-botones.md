# SPEC-0027 — Ajustes rápidos con botones: «Más fácil», «Más corto»… sin escribir instrucciones

| Campo                    | Valor                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Estado                   | Borrador                                                                                       |
| Fase del roadmap         | 6 · Generation (revisión docente) · Transversal de usabilidad                                  |
| Módulo(s) responsable(s) | `modules/resources` · `modules/generation` · `ai-engine/app/generation` · `ai-engine/prompts`  |
| Agentes                  | product, architect, ai-engine, backend, frontend, qa, reviewer                                 |
| ADR relacionados         | ADR-0008 (segundo plano) · **ADR-0020 propuesto: ajustes del recurso completo como propuesta** |
| Autor / Fecha            | product / 2026-11-20                                                                           |

## 1. Objetivo

Hoy, para cambiar un recurso, el docente tiene que escribir qué quiere ("Regenerar" de un ítem pide
texto libre). Con ChatGPT bastaría con decir "hazlo más fácil". Esta spec pone **botones con
indicaciones fijas** debajo de cada recurso y **fichas** en cada pregunta o actividad: Profe propone la
versión ajustada y el docente se queda con ella o vuelve a la anterior con un toque. Es el bloque 1 de
[usabilidad/proximos-pasos.md](../usabilidad/proximos-pasos.md).

## 2. Alcance

**Incluye:**

- **Ajustes del recurso completo** (botones debajo del recurso), según el tipo:

  | Ajuste                          | Taller | Quiz | Examen | Plan de aula |
  | ------------------------------- | :----: | :--: | :----: | :----------: |
  | Más fácil                       |   sí   |  sí  |   sí   |      sí      |
  | Más difícil                     |   sí   |  sí  |   sí   |      sí      |
  | Más corto                       |   sí   |  sí  |   no   |      sí      |
  | Más ejemplos de la vida diaria  |   sí   |  sí  |   sí   |      sí      |
  | Agregar 2 preguntas/actividades |   sí   |  sí  |   no   |      no      |

  En el examen no hay "Más corto" ni "Agregar": cambiarían los puntos, que deben sumar 100
  (SPEC-0011). En el plan de aula, "Más corto" reduce la duración de los momentos, no el número de
  sesiones elegido.

- **Fichas por ítem** (pregunta o actividad) que reemplazan la caja de texto de "Regenerar":
  _Más fácil · Otra pregunta (u Otra actividad) · Mejor redactada_. Usan el flujo de regenerar ítem que
  ya existe (propuesta → "Usar esta versión" / "Descartar").
- La propuesta del recurso completo se genera **en segundo plano** (ADR-0008), parte de la **versión
  actual** (con las ediciones del docente) y respeta lo que el recurso ya tenía: formato propio
  (SPEC-0010), DUA (SPEC-0016), estilo Saber (SPEC-0023), DBA y objetivos del tema.
- Al terminar, el recurso muestra **la versión ajustada** con un aviso: _"Así quedó «Más fácil».
  [Quedarme con esta] [Volver a la anterior]"_. Mientras no decida, la versión guardada sigue siendo
  la anterior.
- Aviso del navegador al terminar (como las generaciones de SPEC-0013), si el docente los activó.

**No incluye (explícitamente):**

- Texto libre en los ajustes del recurso completo. Las indicaciones son del producto, fijas y
  versionadas.
- Combinar varios ajustes en una sola petición (se aplican uno tras otro).
- Ajustes de recursos con estado "Listo" sin volver a borrador (ver RN-07), ni de PIAR (SPEC-0017).
- Usar el recurso en otros grupos: es el bloque 2 (siguiente spec, salvo que se junten; ver §11).

## 3. Actores y permisos

| Actor                | Puede                                      | No puede                             |
| -------------------- | ------------------------------------------ | ------------------------------------ |
| Docente dueño        | Pedir ajustes y decidir sobre sus recursos | Ajustar recursos de otro docente     |
| Otro docente / admin | —                                          | Ver, pedir ni decidir ajustes ajenos |

## 4. Reglas de negocio

- **RN-01 — Indicaciones fijas.** Cada ajuste es un código (`EASIER`, `HARDER`, `SHORTER`,
  `EVERYDAY_EXAMPLES`, `ADD_ITEMS`; en ítems `EASIER`, `ANOTHER`, `CLEARER`). El texto que recibe la IA
  vive en un anexo de prompt versionado (`apps/ai-engine/prompts/adjust.v1.md`); cambiarlo es versión
  nueva. El producto nunca envía texto del docente en un ajuste.
- **RN-02 — Cupo.** Un ajuste del recurso completo cuesta lo mismo que generarlo: 1 (taller, quiz,
  plan de aula) o 2 (examen). Cuenta en el límite de 24 horas y en el de 3 generándose a la vez. Si la
  IA falla, no cuenta (como hoy). Las fichas por ítem siguen con el límite de regeneraciones por hora y
  no gastan cupo.
- **RN-03 — Nada se guarda sin el docente.** El resultado es una **propuesta** guardada aparte; la
  versión del recurso solo cambia con "Quedarme con esta", que crea la versión siguiente con origen IA.
  "Volver a la anterior" descarta la propuesta y no crea versión.
- **RN-04 — Un ajuste a la vez por recurso.** Mientras uno se genera, los botones de ese recurso
  quedan deshabilitados con "Ajustando…"; el docente puede seguir leyendo y descargando la versión
  actual. Si queda una propuesta sin decidir y pide otro ajuste, la anterior se descarta.
- **RN-05 — Ediciones mientras se ajusta.** Si el docente guarda cambios mientras se genera, la
  propuesta sigue llegando, con el aviso _"Se hizo sobre la versión N; después editaste"_. Aceptarla
  reemplaza también esas ediciones (se pueden recuperar en el historial de versiones).
- **RN-06 — Validación.** La propuesta pasa por lo mismo que una generación: schema, validador
  pedagógico, reparación, `quality.v1` y, en Matemáticas, `math_check.v1`. Queda en
  `generation_logs` con modelo, versión de prompt y el código del ajuste. Se conserva la estructura:
  mismas claves de ítems cuando el ítem sigue existiendo (para no perder evaluaciones 👍/👎).
- **RN-07 — Estado.** Se puede ajustar un recurso en "Borrador". En "Listo" los botones aparecen, y al
  aceptar la propuesta el recurso vuelve a "Borrador" (es contenido nuevo sin revisar).
- **RN-08 — Interrupciones.** Un ajuste que lleva más del tiempo de ADR-0008 §5 se marca como
  interrumpido, no cuenta en el cupo y el recurso queda como estaba.
- **RN-09 — Lo que aprende Profe.** Los ajustes elegidos alimentan las sugerencias de preferencias de
  SPEC-0021 (p. ej., si el docente pide "Más fácil" en 3 quices de 6°, Profe puede proponer la
  preferencia "Preguntas más sencillas en 6°"); el docente sigue aceptando o descartando.

## 5. Entradas

- `requestAdjustment({ resourceId, adjustment })`: `adjustment` en el enum de RN-01 y permitido para
  el tipo (tabla §2). Server action con `runAction` y schema Zod en `modules/resources/schemas.ts`.
- `decideAdjustment({ adjustmentId, accept })`.
- `regenerateItem` acepta `adjustment` (código de ítem) en lugar de `instruction`.
- AI Engine: las rutas de generación existentes aceptan, de forma aditiva, `adjust: { code, current }`
  con el contenido actual (sin datos de estudiantes). Contratos `generation-*.v1` con campo opcional;
  se documenta en `docs/ai/contracts/`.

## 6. Salidas

- Tabla nueva `resource_adjustments` (tenant: `institutionId`, FK compuesta al recurso): código,
  versión de origen, estado (`GENERATING`, `PROPOSED`, `ACCEPTED`, `DISCARDED`, `FAILED`), propuesta
  (JSON), `generationId`, fechas. Es la fuente del cupo para ajustes y del sondeo de estado.
- Versión nueva del recurso (origen `AI`) solo al aceptar. Auditoría: `resource.adjustment_requested`,
  `resource.adjustment_decided`.
- UI:
  - `resource-view.tsx`: fila "Ajustar" con los botones del tipo (chips de 44 px; en el celular, fila
    deslizable), estado "Ajustando…" y el aviso de decisión arriba de la vista;
  - `item-tools.tsx`: las tres fichas en lugar de la caja de texto.

## 7. Errores y casos límite

| Caso                                                         | Comportamiento esperado                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Sin cupo (o examen con 1 disponible)                         | Mensaje como al generar, con la hora en que vuelve a haber; no llama a la IA |
| La IA no responde o la propuesta no es válida                | "No pudimos ajustarlo. Intenta de nuevo"; no cuenta en el cupo               |
| Ajuste no permitido para el tipo (p. ej. examen + Más corto) | Error de validación; el botón no aparece                                     |
| Otro docente intenta pedir o decidir                         | No encontrado (sin revelar que existe)                                       |
| Doble toque en el mismo botón                                | Una sola petición (RN-04)                                                    |
| El recurso se archivó mientras se ajustaba                   | La propuesta se descarta                                                     |

## 8. Criterios de aceptación

- **CA-0027-01:** Dado un taller en borrador, cuando el docente toca "Más fácil", entonces el recurso
  muestra "Ajustando…", la versión actual sigue visible y descargable, y se descuenta 1 del cupo.
- **CA-0027-02:** Dado un ajuste terminado, cuando el docente toca "Quedarme con esta", entonces se crea
  la versión siguiente con origen IA y el historial conserva la anterior.
- **CA-0027-03:** Dado un ajuste terminado, cuando toca "Volver a la anterior", entonces no se crea
  versión y el contenido es el de antes.
- **CA-0027-04:** Dado un examen, entonces solo aparecen "Más fácil", "Más difícil" y "Más ejemplos de
  la vida diaria", el ajuste cuesta 2 del cupo y la propuesta mantiene los puntos y la suma de 100.
- **CA-0027-05:** Dado un taller con formato propio, DUA o un quiz con estilo Saber, cuando se ajusta,
  entonces la propuesta conserva el formato, los apoyos DUA y la situación/competencia de cada pregunta.
- **CA-0027-06:** Dado que la IA falla o se interrumpe, entonces el recurso queda igual, el docente ve
  el aviso y el cupo no cambia.
- **CA-0027-07:** Dado un docente sin cupo, cuando toca un ajuste, entonces ve cuándo vuelve a tener y no
  se llama al AI Engine.
- **CA-0027-08:** Dada una pregunta de un quiz, cuando el docente toca la ficha "Otra pregunta", entonces
  llega una propuesta sin escribir nada y la decide como hoy; ya no aparece la caja de texto.
- **CA-0027-09:** El AI Engine recibe el código del ajuste y el contenido actual, nunca texto del
  docente; `generation_logs` registra el código y la versión del anexo `adjust.v1`.
- **CA-0027-10:** (Acceso cruzado) Un docente de otro espacio o del mismo colegio no puede pedir,
  consultar ni decidir ajustes de un recurso ajeno.
- **CA-0027-11:** En el celular (360 px) la fila de ajustes se desliza, cada botón mide al menos 44 px,
  no tapa la barra de acciones del recurso y la pantalla pasa axe sin errores.
- **CA-0027-12:** Con un ajuste generándose, los botones del recurso quedan deshabilitados y un segundo
  toque no crea otra petición.

## 9. Seguridad y privacidad

- Tenancy: servicios con `ctx: TenantContext`, filtro por `institutionId` y dueño del recurso
  (`membershipId`); FK compuesta `(resourceId, institutionId)`; test de acceso cruzado (CA-0027-10).
- Al modelo va solo el contenido del recurso, el contexto pedagógico ya guardado y el código del
  ajuste. Sin datos de estudiantes; se pasa `redactContactData` al contenido actual por si el docente
  escribió un teléfono o correo al editar.
- Límite: el mismo cupo diario y de "en curso" que la generación; rate limit por minuto en la acción.

## 10. Tareas

- [ ] T1 — ADR-0020: ajustes del recurso completo como propuesta, cupo y contrato aditivo — architect
- [ ] T2 — Anexo `adjust.v1` y campo `adjust` en las rutas de taller, quiz, examen y plan; validadores;
      pytest — ai-engine
- [ ] T3 — Migración `resource_adjustments` (FK compuestas) y cupo que la cuenta — database
- [ ] T4 — `requestAdjustment`, `decideAdjustment`, ejecución en segundo plano, estado, interrupción;
      `regenerateItem` con códigos — backend
- [ ] T5 — Fila "Ajustar", aviso de decisión, fichas por ítem — frontend
- [ ] T6 — Sugerencias de preferencias con los ajustes (RN-09) — backend
- [ ] T7 — Tests unitarios, integración (incl. acceso cruzado) y e2e 360 px + axe; recorrido
      `ux:recorrido` con los clics en el informe — qa
- [ ] T8 — Revisión contra la spec — reviewer

## 11. Preguntas abiertas

1. **¿Juntar con el bloque 2** ("Usar el mismo recurso en mis otros grupos", sin gastar cupo) en esta
   misma spec, o va aparte como la siguiente? Recomendación: aparte, para entregar esto antes.
2. **Cupo:** ¿el ajuste del recurso completo gasta cupo como una generación (lo propuesto), o se dan
   algunos ajustes gratis por recurso (p. ej., 2)? Con el plan gratuito de Groq el cupo existe para
   controlar el gasto, así que la recomendación es cobrarlo.
3. **Texto libre:** ¿se quita del todo la caja de "Regenerar" en los ítems, o queda escondida detrás de
   "Otra indicación…" para quien quiera escribir? Recomendación: dejarla escondida.
