# SPEC-0016 — Talleres con Diseño Universal para el Aprendizaje (DUA), a elección del docente

| Campo                    | Valor                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                                                                                                  |
| Fase del roadmap         | 6 · Generation                                                                                                                                                |
| Módulo(s) responsable(s) | `modules/resources` (blueprint, contenido y editor), `modules/generation` (contrato), `modules/documents` (Word y PDF), `apps/ai-engine` (prompt y validador) |
| Agentes                  | product, ai-engine, backend, frontend, documents, qa, reviewer                                                                                                |
| ADR relacionados         | ADR-0014 (DUA en el contrato del taller: campos opcionales y anexo de prompt versionado). Se apoya en ADR-0007 y ADR-0008                                     |
| Autor / Fecha            | product / 2026-11-13. Aprobada por el usuario el mismo día ("intégralo y que el profesor decida")                                                             |

## 1. Objetivo

Un profesor pidió que los talleres tengan en cuenta el **Diseño Universal para el Aprendizaje (DUA)**.
El Decreto 1421 de 2017 (art. 2.3.3.5.1.4, num. 6) lo incorporó a la educación inclusiva en
Colombia: el aula se planea desde el inicio para que todos los estudiantes aprendan, en vez de
adaptarla después para algunos. Cuando el DUA no basta para un estudiante, se hace su PIAR
(SPEC-0017).

Con esta spec, el docente decide al crear un taller si lo quiere **con enfoque DUA**. Si lo
quiere, cada actividad trae opciones según los tres principios del DUA (CAST, pautas 3.0, 2024):

| Principio                    | En cada actividad                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Implicación (el porqué)      | Conexión con la vida o los intereses del estudiante, con algo para elegir               |
| Representación (el qué)      | Al menos dos formas de presentar el contenido (texto, imagen, material concreto, oral…) |
| Acción y expresión (el cómo) | Al menos dos formas de responder, que el estudiante elige; apoyos graduados y un reto   |

El taller suma una **guía DUA**: las barreras que se pueden presentar en el grupo con su apoyo, y
una autoevaluación corta para el estudiante.

## 2. Alcance

**Incluye:**

- Opción "Con enfoque DUA" en los ajustes del taller (asistente `/create`), apagada por defecto.
- "Crear taller" con un toque (SPEC-0014) usa la última elección del docente.
- Generación con IA de los campos DUA, validados y reparados en el AI Engine.
- Editor: ver y editar los campos DUA de cada actividad y la guía DUA; regenerar una actividad
  conserva el enfoque.
- Word y PDF: en la hoja del estudiante, "Elige cómo responder", "Si necesitas ayuda", "Reto" y
  "Mi autoevaluación"; en la guía del docente, formas de presentar y barreras con su apoyo.
- Etiqueta "Con DUA" en el recurso.

**No incluye (explícitamente):**

- Quices y exámenes con DUA (pueden venir después con el mismo patrón).
- Datos de estudiantes concretos: el DUA es para todo el grupo. Lo individual es el PIAR (SPEC-0017).
- Cambiar los talleres ya generados: solo los nuevos llevan DUA si el docente lo elige.

## 3. Actores y permisos

| Actor   | Puede                                                        | No puede                        |
| ------- | ------------------------------------------------------------ | ------------------------------- |
| Docente | Elegir DUA al crear un taller, editar y descargar sus campos | Ver ni editar talleres de otros |

## 4. Reglas de negocio

- **RN-01 — Elección del docente.** El blueprint del taller lleva `udl: boolean` (ausente =
  `false`). El asistente lo muestra como un interruptor con una línea de explicación, marcado como
  el último taller que creó el docente en el espacio (la primera vez, apagado). El toque rápido usa
  esa misma elección.
- **RN-02 — Campos por actividad.** Con DUA, cada actividad trae `udl`:
  - `representation`: 2 o 3 formas de presentar el contenido;
  - `expression`: 2 o 3 formas de responder, entre las que el estudiante elige;
  - `engagement`: una frase que conecta con la vida o los intereses del estudiante;
  - `supports`: 1 a 3 apoyos graduados (pista, ejemplo resuelto, organizador);
  - `challenge`: un reto para quien termina antes (opcional).
- **RN-03 — Guía DUA.** Con DUA, el taller trae `udlGuide`:
  - `barriers`: 2 a 5 pares "barrera posible → apoyo" del grupo (nunca de un estudiante nombrado);
  - `selfAssessment`: 2 a 4 frases para el estudiante ("Puedo…").
- **RN-04 — Validación.** El AI Engine rechaza y repara un taller DUA al que le falten campos de
  RN-02 o RN-03. Sin DUA, los campos no se piden y, si llegan, se descartan.
- **RN-05 — Trazabilidad.** El prompt de DUA es un anexo versionado (`udl.v1`) que se suma al del
  taller. En `generation_logs` la versión queda como `workshop.v1+udl.v1` (o `workshop.v2+udl.v1`).
- **RN-06 — Sin datos personales.** Ni el pedido ni el resultado traen nombres ni diagnósticos.
  Las barreras se describen para el grupo ("leer textos largos", "atención sostenida").
- **RN-07 — Regenerar.** Al regenerar una actividad de un taller DUA, la nueva trae sus campos DUA.
- **RN-08 — UI.** Sin jerga: la UI dice "Con enfoque DUA" y explica el DUA en una línea. Celular
  primero (360 px), WCAG 2.1 AA.

## 5. Entradas

- Blueprint del taller: `udl?: boolean` (opcional; ausente = `false`).
- `POST /v1/generation/workshop`: `udl: boolean` (opcional, por defecto `false`).
- `POST /v1/generation/item`: la actividad `current` puede traer `udl`.

## 6. Salidas

- Contenido del taller (versión): `activities[].udl` y `udlGuide`, opcionales.
- Documentos: secciones DUA en la hoja del estudiante y en la guía del docente.

## 7. Criterios de aceptación

- **CA-0016-01:** Dado el asistente de un taller, cuando el docente activa "Con enfoque DUA" y
  genera, entonces cada actividad muestra al menos dos formas de presentar, dos formas de responder,
  la conexión y un apoyo, y el taller muestra la guía DUA y la etiqueta "Con DUA".
- **CA-0016-02:** Dado un taller sin DUA, cuando se genera, entonces no trae campos DUA (igual que
  antes de esta spec).
- **CA-0016-03:** Dada una salida de la IA con DUA incompleto, cuando el AI Engine la valida,
  entonces la repara o responde inválida; nunca se guarda un taller DUA sin sus campos.
- **CA-0016-04:** Dado un taller DUA, cuando el docente edita un campo DUA y guarda, entonces queda
  en una versión nueva; cuando regenera una actividad, la nueva conserva el DUA.
- **CA-0016-05:** Dado un taller DUA, cuando se descarga en Word o PDF, entonces la hoja del
  estudiante trae "Elige cómo responder" y "Mi autoevaluación", y la guía del docente trae las
  barreras con su apoyo.
- **CA-0016-06:** Dado un docente cuyo último taller fue con DUA, cuando usa "Crear taller" con un
  toque, entonces el nuevo también es con DUA.
- **CA-0016-07:** Dada la generación, cuando queda en `generation_logs`, entonces la versión del
  prompt dice `+udl.v1`.
- **CA-0016-08:** Dadas las pantallas con DUA (ajustes y recurso), cuando se analizan con axe a
  360 px, entonces no hay violaciones WCAG 2.1 AA ni scroll horizontal.

## 8. Tareas

- [x] T1 — ADR-0014 y contrato (campos opcionales `udl` y `udlGuide`) — architect + ai-engine
- [x] T2 — AI Engine: anexo `udl.v1`, modelos, validador, reparación, mock y pruebas — ai-engine
- [x] T3 — Web: blueprint, esquemas de contenido, llamada al motor, toque rápido — backend
- [x] T4 — UI: interruptor en el asistente, editor, etiqueta — frontend
- [x] T5 — Word y PDF — documents
- [x] T6 — Pruebas por CA y revisión — qa + reviewer

## 9. Fuentes

- CAST (2024). _Universal Design for Learning Guidelines version 3.0_. udlguidelines.cast.org.
- Decreto 1421 de 2017, Ministerio de Educación Nacional, art. 2.3.3.5.1.4, num. 6.
- Fundación Saldarriaga Concha, _Narrativa DUA_ (2022).

Las fuentes primarias no se pudieron abrir desde el entorno de trabajo; los textos de la UI no las
citan literalmente. Antes de publicar material de formación, contrastar con el texto oficial.

## 10. Implementación (2026-11-13)

- AI Engine: anexo `prompts/udl.v1.md`; `ActivityUdl` y `UdlGuide` en `app/generation/resources.py`
  con `udl_errors` y `udl_guide_errors`; el mock devuelve DUA cuando se pide;
  `tests/test_udl.py` (13).
- Web:
  - blueprint `udl`; `activityUdlSchema`, `udlGuideSchema` y `UDL_LABELS` en
    `modules/resources/schemas.ts`; `lastWorkshopUdl` en `service.ts` y `quick.ts`;
  - interruptor `UdlSwitch` en `create/settings-step.tsx`; vista y edición en `workshop-editor.tsx`;
    etiqueta "Con DUA" en el recurso;
  - Word y PDF: `extras` en el bloque de actividad y `udlGuideBlocks` en
    `modules/documents/build.ts`.
- Pruebas: `tests/integration/spec-0016.test.ts` (5), `tests/unit/documents.test.ts` (2 nuevas) y
  `tests/e2e/spec-0016.spec.ts` (2, con axe a 360 px). Capturas en
  `docs/design/capturas/spec-0016/`.
- Revisión (reviewer): todos los CA tienen prueba con su ID. El DUA llega a quices y exámenes en
  otra spec si se pide.
