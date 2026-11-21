# SPEC-0037 — Estándares de Matemáticas, Lenguaje e Inglés

| Campo                    | Valor                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| Estado                   | **Implementada** (2026-11-21) — revisión docente del contenido pendiente |
| Fase del roadmap         | 3 · Curriculum                                                           |
| Módulo(s) responsable(s) | `modules/curriculum`, `apps/ai-engine` (índice y búsqueda)               |
| Agentes                  | curriculum, rag, ai-engine, qa                                           |
| ADR relacionados         | ADR-0005 (catálogo versionado), ADR-0007                                 |
| Autor / Fecha            | Claude, a pedido del product owner / 2026-11-21                          |

Pedido del product owner (2026-11-21): «carga los estándares que faltan, carga el inglés, con DBA y
Estándares… empieza por eso». Mismo proceso y garantías de SPEC-0004 y SPEC-0036.

## 1. Objetivo

Completar los Estándares Básicos de Competencias de las áreas con DBA: Matemáticas y Lenguaje (del
documento de 2006 que ya se usó para Ciencias) e Inglés (Guía 22), para que esas asignaturas tengan sus
referentes oficiales de 1° a 11° en «DBA y Estándares» y en la búsqueda de Lucía.

## 2. Alcance

**Incluye:**

- Estándares de Matemáticas (172, uno por viñeta, agrupados por pensamiento) y de Lenguaje (177
  subprocesos, cada uno con el estándar de su columna), de 1° a 11°.
- Estándares de Inglés de la Guía 22 en sus dos PDF oficiales: 1°-5° (91) y 6°-11° (127), por habilidad
  (Escucha, Lectura, Escritura, Monólogos, Conversación), con las competencias que desarrolla cada uno.
- Formato: un estándar puede ir sin lista (Matemáticas; estándares de actitud de Inglés); un DBA sigue
  exigiendo evidencias.
- Búsqueda: filtro opcional por tipo en `retrieval-curriculum.v1` (aditivo); las sugerencias de DBA de un
  objetivo piden solo DBA, para que los Estándares no las desplacen.

**No incluye:**

- **DBA de Inglés 6°-11°:** el PDF oficial no está publicado en Colombia Aprende ni en mineducacion.gov.co
  (solo el de Transición y Primaria). No se transcribe de copias no oficiales. Ver § 7.
- Usar los Estándares para planear o generar (elegirlos en un objetivo y que Lucía los tenga en cuenta):
  spec siguiente, a decidir con el product owner.

## 3. Reglas de negocio

- **RN-01:** Las de SPEC-0004/0036: texto literal del MEN, cita, verificación contra el PDF, importación
  idempotente, `review.status = PENDING` hasta la revisión docente.
- **RN-02:** Matemáticas: `component` = pensamiento; sin lista. Lenguaje: `component` = factor (Producción
  textual, Comprensión e interpretación textual, Literatura, Medios de comunicación y otros sistemas
  simbólicos, Ética de la comunicación); lista = el estándar de su columna. Inglés: `component` =
  habilidad; lista = competencias («Competencia lingüística», «pragmática», «sociolingüística»).
- **RN-03:** Planeación, propuestas de Lucía y objetivos siguen usando solo DBA.

## 4. Criterios de aceptación

- **CA-0037-01:** Importar dos veces las fuentes nuevas no crea ni duplica nada.
- **CA-0037-02:** Matemáticas 6° muestra los 38 estándares de 6°-7° por pensamiento, sin lista.
- **CA-0037-03:** Lenguaje 8° muestra los 37 subprocesos de 8°-9°, cada uno con el estándar de su columna.
- **CA-0037-04:** Inglés 10° muestra los 44 estándares de 10°-11° por habilidad, con sus competencias.
- **CA-0037-05:** El texto guardado es idéntico al del archivo.
- **CA-0037-06:** Al sugerir DBA para un objetivo, el producto pide solo DBA al AI Engine.

## 5. Implementación (2026-11-21)

| Fuente (clave)                                     | Ítems | Verificación contra el PDF  |
| -------------------------------------------------- | ----- | --------------------------- |
| Estándares de Matemáticas, 2006 (`MEN-EBC-MAT-V1`) | 172   | 172 de 172 viñetas, literal |
| Estándares del Lenguaje, 2006 (`MEN-EBC-LEN-V1`)   | 177   | 177 de 177 viñetas, literal |
| Guía 22 Inglés 1°-5° (`MEN-EBC-ING1-V1`)           | 91    | 91 de 91 viñetas, literal   |
| Guía 22 Inglés 6°-11° (`MEN-EBC-ING2-V1`)          | 127   | 127 de 127 viñetas, literal |

- Herramientas: `extract_ebc.py` ahora tiene un perfil por área (ciencias, matemáticas, lenguaje; los
  resultados de Ciencias no cambian) y `extract_guia22.py` para Inglés. Una errata del original («1, 2. 3»)
  se lee como las tres competencias.
- AI Engine: el índice guarda el tipo y la búsqueda acepta `types`; índice de 1.518 ítems.
- Pruebas: `tests/integration/spec-0037.test.ts`, CA-0037-06 en `curriculum-search.test.ts`, e2e
  `spec-0037.spec.ts`; AI Engine 197 (filtro de tipo incluido).

## 6. Seguridad y privacidad

El catálogo es público; el filtro de tipo no envía datos del docente.

## 7. Preguntas abiertas

1. **DBA de Inglés 6°-11°:** ¿tiene el product owner el PDF oficial (o el enlace del MEN)? Con él se carga
   con el mismo proceso.
2. **Usar los Estándares:** ¿cómo quiere el docente elegirlos y que Lucía los use? (propuesta en el chat).
