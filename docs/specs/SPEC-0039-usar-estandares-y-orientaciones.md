# SPEC-0039 — Usar Estándares y Orientaciones al planear y generar

| Campo                    | Valor                                                                           |
| ------------------------ | ------------------------------------------------------------------------------- |
| Estado                   | **Implementada** (2026-11-22)                                                   |
| Fase del roadmap         | 3 · Curriculum / 5 · AI Engine                                                  |
| Módulo(s) responsable(s) | `modules/planning`, `modules/generation`, `modules/resources`, `apps/ai-engine` |
| Agentes                  | domain, backend, frontend, ai-engine, qa                                        |
| ADR relacionados         | ADR-0022, ADR-0013, ADR-0014 (anexos de prompt)                                 |
| Autor / Fecha            | Claude, a pedido del product owner / 2026-11-22                                 |

Pedido del product owner (2026-11-22): «que el docente los elija en un objetivo y que Lucía los tenga en
cuenta. En Ética y Cátedra de la Paz, que solo tienen Estándares, esto es lo que hace que Lucía les
proponga periodos».

## 1. Objetivo

Que Lucía planee y genere con los referentes oficiales que existan para cada curso, no solo con DBA, y
que el docente pueda vincular Estándares a sus objetivos también en las áreas con DBA.

## 2. Alcance

**Incluye:**

- **Referentes base de un curso:** los DBA del grado; si el área no tiene DBA para ese grado, sus
  Estándares y Orientaciones (`baseReferences`, `lib/curriculum-references.ts`). Con ellos: propuesta de
  periodo, año o unidad; objetivos en bloque; cobertura; «¿puede proponer?» del Inicio y de la
  planeación; recurso con un toque.
- **Objetivo:** la lista principal son los referentes base (con las sugerencias de Lucía); en un área
  con DBA, un bloque plegable «Estándares del grupo de grados (opcional)» deja vincular Estándares.
- **Generación:** a Lucía le llegan los referentes base y, además, los Estándares vinculados a los
  objetivos elegidos. Talleres, quices, exámenes, plan de aula y objetivos.
- **Contratos:** `kind` opcional en los referentes (aditivo) y anexo de prompt `referentes.v1`
  (ADR-0022). Pedidos con solo DBA, sin cambios.
- **Etiquetas:** «DBA n», «Estándar n» u «Orientación n» según el código, en fichas, editor, Word y PDF.

**No incluye:** Estándares de otra área (p. ej. Ciudadanas en un curso de Sociales); medir en el
benchmark la calidad con `referentes.v1` (pendiente).

## 3. Reglas de negocio

- **RN-01:** Si el grado tiene DBA, la planeación y las propuestas usan solo DBA (sin cambios).
- **RN-02:** Sin DBA, se usan los Estándares y Orientaciones del grupo de grados del curso, hasta 60 por
  pedido (límite del contrato).
- **RN-03:** Un Estándar vinculado a un objetivo viaja a Lucía cuando se genera con ese objetivo; no
  cuenta en la cobertura de un área con DBA.
- **RN-04:** Una asignatura sin área ni referentes (Educación Religiosa) sigue sin propuesta de Lucía y
  la pantalla lo explica.
- **RN-05:** Lo generado cita los códigos de los referentes que recibió; los demás se descartan (como
  con los DBA).

## 4. Criterios de aceptación

- **CA-0039-01:** En Ética de 6°, Lucía propone el periodo con los 36 Estándares Ciudadanos de 6°-7°
  (con `kind`) y, al aceptarla, cuentan en la cobertura.
- **CA-0039-02:** En Tecnología de 8°, Lucía usa las 40 Orientaciones de 8°-9°.
- **CA-0039-03:** En Matemáticas siguen yendo solo DBA, sin `kind`; Educación Religiosa no propone.
- **CA-0039-04:** Un Estándar vinculado a un objetivo de Matemáticas viaja con `kind: STANDARD` al crear
  un quiz, junto al DBA.
- **CA-0039-05:** En Educación Física de 10°, los objetivos en bloque se proponen con las Orientaciones
  y quedan vinculados a ellas.
- **CA-0039-06/07/08:** Referentes base, etiquetas por código y `kind` solo cuando no es DBA (unitarias);
  el AI Engine agrega el anexo y registra `…+referentes.v1` solo con `kind`.
- **CA-0039-09:** En la pantalla, el objetivo de Matemáticas deja marcar un Estándar y se ve como
  «Estándar 1».
- **CA-0039-10:** Tecnología de 6° muestra 31 Orientaciones y ofrece «Proponer con IA».

## 5. Implementación (2026-11-22)

- Web: `lib/curriculum-references.ts` (`baseReferences`, `referenceLabel`, `evidencesTitle`,
  `engineReference`); `modules/planning/read.ts` (`generationReferences`), `proposal.ts`,
  `modules/generation/planning.ts` y `objectives-batch.ts`; `planning-forms.tsx` (bloque de Estándares);
  `dba-chip.tsx`, `references-view.tsx` y `modules/documents/build*.ts` (etiquetas).
- AI Engine: `app/generation/references.py`, `prompts/referentes.v1.md`, `kind` en `DbaRef`.
- Pruebas: `tests/integration/spec-0039.test.ts`, `tests/unit/curriculum-references.test.ts`, e2e
  `spec-0039.spec.ts`; AI Engine `tests/test_references.py`.

## 6. Seguridad y privacidad

Los referentes son del catálogo público; `kind` no agrega datos del docente ni de estudiantes.
