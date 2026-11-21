# SPEC-0036 — DBA y Estándares de Ciencias Naturales y Ciencias Sociales

| Campo                    | Valor                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Estado                   | **Implementada** (2026-11-21) — revisión docente del contenido pendiente                |
| Fase del roadmap         | 3 · Curriculum                                                                          |
| Módulo(s) responsable(s) | `modules/curriculum` (catálogo e importación), `apps/ai-engine` (índice y búsqueda)     |
| Agentes                  | product, curriculum, rag, ai-engine, qa, reviewer                                       |
| ADR relacionados         | ADR-0005 (catálogo versionado; no hace falta ADR nuevo, ver § 11), ADR-0007 (AI Engine) |
| Autor / Fecha            | Claude (agente `product`), a pedido del product owner / 2026-11-21                      |

## 1. Objetivo

Hoy ProfIA solo tiene DBA de Matemáticas, Lenguaje y Transición. Un docente de Ciencias Naturales o de
Ciencias Sociales crea material, pero Lucía no puede proponerle temas, sugerirle DBA ni conectar sus
talleres y quices con los referentes oficiales, y la experiencia se cae. Esta spec agrega los
**DBA de Ciencias Naturales y de Ciencias Sociales (1° a 11°)** y los **Estándares Básicos de
Competencias** de esas dos áreas, con el mismo proceso y las mismas garantías del catálogo actual
(SPEC-0004), para que esas asignaturas funcionen igual que Matemáticas y Lenguaje.

## 2. Alcance

**Incluye:**

- Transcribir desde los PDF oficiales del MEN, con el mismo proceso de SPEC-0004:
  - DBA de Ciencias Naturales, 1° a 11°.
  - DBA de Ciencias Sociales, 1° a 11°.
  - Estándares Básicos de Competencias en Ciencias Naturales y en Ciencias Sociales, por rangos de
    grado (1–3, 4–5, 6–7, 8–9, 10–11).
- Un archivo JSON por documento en `apps/web/curriculum/men/` con `source` (incluye `url`,
  `landingUrl` y `sha256` del PDF), `review` en `PENDING` e `items[]`, validado por
  `modules/curriculum/file-schema.ts` sin cambiar el schema.
- Registrar las fuentes en `curriculum/tools/sources.json` para que `curriculum:verify` las compare
  literalmente con los PDF, y documentar cualquier corrección en `curriculum/tools/fixes/`.
- Importarlas con `npm run curriculum:import -w @profia/web` (idempotente) en desarrollo, pruebas y
  producción, y reindexar el AI Engine (`uv run python -m app.cli index`; en producción, volver a
  publicar el Space con `scripts/publish-ai-engine-hf.ps1`).
- Casos nuevos en el benchmark de búsqueda curricular del AI Engine
  (`benchmarks/curriculum-retrieval.jsonl`) para las dos áreas.
- Que todo lo que ya usa DBA funcione en esas asignaturas sin código nuevo:
  - página de referentes del curso;
  - DBA sugeridos al escribir un objetivo;
  - Lucía propone unidades y temas (SPEC-0014);
  - Primeros pasos con temas propuestos (SPEC-0032);
  - ficha de DBA en recursos;
  - talleres, quices, exámenes y planes de aula con su DBA.
- Quitar el aviso "solo Matemáticas, Lenguaje y Transición" donde exista, cuando las fuentes estén
  importadas.

**No incluye (explícitamente):**

- Estándares de Matemáticas, Lenguaje e Inglés, y DBA de Inglés: spec aparte, con el mismo proceso.
- Lineamientos curriculares, orientaciones pedagógicas o mallas de aprendizaje.
- Competencias Saber (ICFES) de Ciencias para el "Estilo Saber" (SPEC-0023): spec aparte.
- Cambios al modelo del catálogo, a sus tablas o al formato de los archivos.
- Áreas sin DBA del MEN (Artística, Educación Física, Ética, Religión, Tecnología, Filosofía…): las
  cubre SPEC-0020, con el material de referencia del docente.

## 3. Actores y permisos

| Actor                          | Puede                                                                      | No puede                   |
| ------------------------------ | -------------------------------------------------------------------------- | -------------------------- |
| Docente de Ciencias o Sociales | Ver los referentes de sus cursos y usarlos en la planeación y los recursos | Editar el catálogo oficial |
| `ADMIN` del colegio            | Vincular asignaturas propias (Biología, Historia…) al área que corresponde | Editar el catálogo oficial |
| Equipo de ProfIA (repo)        | Transcribir, verificar, revisar e importar las fuentes con un PR           | —                          |
| Revisor docente del equipo     | Revisar la muestra y marcar la fuente como revisada                        | —                          |

## 4. Reglas de negocio

- **RN-01:** Aplican sin cambios las reglas de SPEC-0004:
  - código estable por ítem;
  - texto literal del MEN, sin resumir ni reescribir con IA;
  - cita con emisor, documento, versión, año y página, más enlace a la fuente oficial;
  - importación idempotente y todo-o-nada;
  - una versión nueva deja la anterior `SUPERSEDED`.
- **RN-02:** Cada fuente nueva entra con `review.status = PENDING` y se muestra con el aviso «pendiente
  de revisión docente», igual que las actuales, hasta que una persona del equipo revise una muestra
  contra el PDF.
- **RN-03:** `curriculum:verify` debe pasar para cada fuente nueva:
  - el enunciado y las evidencias son literales respecto al PDF;
  - no falta ningún ítem ni ninguna evidencia.

  Una diferencia que no se pueda resolver se documenta en `fixes/` con su razón.

- **RN-04:** Los Estándares aplican a un curso cuando su grado cae en el rango del estándar (RN-06 de
  SPEC-0004). Cómo se reparten en ítems se decide en la pregunta abierta 1.
- **RN-05:** Las asignaturas precargadas ya se vinculan solas (Ciencias Naturales y Educación Ambiental →
  Ciencias Naturales; Ciencias Sociales → Ciencias Sociales). Las asignaturas propias de 10° y 11°
  (Biología, Física, Química, Historia, Geografía…) se vinculan a mano al área que corresponde; ver la
  pregunta abierta 2.
- **RN-06:** Un grado sin DBA de un área en el documento del MEN muestra el mensaje actual: «El MEN no
  publica DBA de esta área para este grado».
- **RN-07:** El índice del AI Engine incluye las fuentes nuevas, y la versión del catálogo cambia, para que
  `generation_logs` registre con qué catálogo se generó cada recurso.

## 5. Entradas

- PDF oficiales del MEN, descargados de Colombia Aprende o de la página del MEN, con su `sha256`.
  Quedan fuera de git, en `apps/web/curriculum/sources/`, como los actuales.
- Archivos `dba-ciencias-naturales-<version>.json`, `dba-ciencias-sociales-<version>.json`,
  `ebc-ciencias-naturales-<version>.json` y `ebc-ciencias-sociales-<version>.json`, con el formato de
  `file-schema.ts`:
  - `area`: `CIENCIAS_NATURALES` o `CIENCIAS_SOCIALES`;
  - `documentType`: `DBA` o `STANDARD`;
  - ítems con `grade` (DBA) o con `gradeFrom`/`gradeTo` (estándares).

## 6. Salidas

- Fuentes e ítems nuevos en `curriculum_sources` y `curriculum_items` (sin migración).
- Índice del AI Engine con las dos áreas y casos de benchmark nuevos.
- Reporte de `curriculum:verify` y de `curriculum:import` para cada fuente.
- Actualización de `docs/curriculum/README.md`: fuentes, versiones, conteos y estado de revisión.

## 7. Errores y casos límite

| Caso                                                                 | Comportamiento esperado                                                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| El PDF oficial cambia o ya no está en la URL                         | `sha256` distinto: `curriculum:verify` falla y nada se importa hasta revisar la fuente  |
| Un DBA con ejemplos, tablas o mapas que no se transcriben bien       | Se guarda el enunciado y las evidencias; el ejemplo se consulta en la página del PDF    |
| Curso de Ciencias Naturales 10° de una asignatura «Física»           | Con la asignatura vinculada al área, ve todos los DBA de Ciencias Naturales de 10°      |
| Curso de Ciencias Sociales en Transición                             | Transición sigue mostrando sus propios DBA (no hay DBA de Sociales para Transición)     |
| Asignatura propia (p. ej. «Cátedra de la Paz») sin vincular          | Mensaje actual con «Vincular a un área curricular» (RN-07 de SPEC-0004)                 |
| Se importa en producción y el AI Engine todavía no se ha republicado | La web muestra los referentes; Lucía no los encuentra hasta reindexar: queda en la guía |

## 8. Criterios de aceptación

- **CA-0036-01:** Dadas las cuatro fuentes nuevas, cuando se corre `curriculum:verify`, entonces pasa
  para cada una: textos literales, sin ítems ni evidencias faltantes, y `sha256` igual al registrado.
- **CA-0036-02:** Dadas las fuentes nuevas, cuando se importan dos veces, entonces la segunda no crea ni
  duplica nada y el reporte lo indica (CA-0004-01 con las fuentes nuevas).
- **CA-0036-03:** Dado un curso de Ciencias Naturales y Educación Ambiental de 6°, cuando el docente abre
  sus referentes, entonces ve los DBA de Ciencias Naturales de 6°, con evidencias y cita completa, y los
  Estándares del rango 6–7.
- **CA-0036-04:** Dado un curso de Ciencias Sociales de 8°, cuando el docente abre sus referentes,
  entonces ve los DBA de Ciencias Sociales de 8° y los Estándares del rango 8–9, con su cita.
- **CA-0036-05:** Dado un curso de Ciencias Naturales de 7° con temas, cuando el docente escribe un
  objetivo, entonces Lucía marca DBA sugeridos de Ciencias Naturales de 7° (CA-0013-05 con la nueva área).
- **CA-0036-06:** Dado un curso de Ciencias Sociales de 6° sin temas, cuando el docente pide la propuesta
  del periodo, entonces Lucía propone unidades y temas, cada uno con un DBA de Ciencias Sociales de 5°
  (SPEC-0014 con la nueva área; contrato y reparto sin cambios).
- **CA-0036-07:** Dado el AI Engine reindexado, cuando se corre el benchmark de búsqueda curricular,
  entonces los casos nuevos de Ciencias Naturales y Sociales alcanzan el mismo umbral de recall@5 que
  Matemáticas y Lenguaje, y el umbral de las áreas actuales no baja.
- **CA-0036-08:** El texto mostrado de cada ítem nuevo es idéntico al del archivo importado
  (CA-0004-08 con las fuentes nuevas).
- **CA-0036-09:** Las fuentes nuevas se muestran con el aviso «pendiente de revisión docente» mientras
  `review.status` sea `PENDING`.
- **CA-0036-10:** Dado un taller generado para un tema de Ciencias Naturales con DBA, cuando se descarga
  en Word, entonces muestra el DBA con su cita, como en Matemáticas.

## 9. Seguridad y privacidad

- El catálogo es público y no tiene datos personales.
- Se reproducen textos oficiales del MEN con cita y enlace, según la decisión del product owner de
  SPEC-0004 § 11. La revisión legal previa al lanzamiento comercial cubre también estas fuentes.
- El AI Engine solo recibe el catálogo, nunca datos del docente ni de estudiantes; no cambia nada de lo
  que se envía al modelo.

## 10. Tareas

- [x] T1 — Ubicar y descargar los cuatro PDF oficiales, registrar URL, página de origen y `sha256` en
      `sources.json` — `curriculum`
- [x] T2 — Transcribir los DBA de Ciencias Naturales y de Ciencias Sociales (extractor y corrección
      manual) hasta que pase `curriculum:verify` — `curriculum`
- [x] T3 — Transcribir los Estándares de las dos áreas con la estructura que se decida en la pregunta 1 —
      `curriculum`
- [x] T4 — Importar y probar: integración (idempotencia, referentes por grado, texto literal) y e2e
      (referentes y DBA sugeridos en un curso de Ciencias) — `qa`
- [x] T5 — Reindexar el AI Engine, casos nuevos en el benchmark y benchmark de propuestas de planeación
      con las dos áreas — `rag` / `ai-engine`
- [ ] T6 — Revisar la muestra contra los PDF y documentar en `docs/curriculum/revision-dba.md` —
      revisor docente del equipo
- [x] T7 — Guía de despliegue: importar en Supabase y republicar el Space — `devops`
- [ ] T8 — Revisión contra la spec y la Definition of Done — `reviewer`

## 11. Decisión de arquitectura

No hace falta un ADR nuevo:

- Las áreas `CIENCIAS_NATURALES` y `CIENCIAS_SOCIALES` ya existen en `curriculum_areas`.
- El formato de los archivos ya admite `STANDARD` con rangos de grado.
- El AI Engine indexa todo lo que haya en el catálogo.

Si la respuesta a la pregunta 1 exige un nivel más (estándar general → acciones de pensamiento) que el
formato actual no puede representar, eso sí cambia ADR-0005 y se propone un ADR antes de implementar.

## 12. Preguntas abiertas

1. **Cómo guardar los Estándares.** En Ciencias, cada rango de grados tiene un estándar general y debajo
   muchas «acciones de pensamiento y producción», agrupadas en columnas (por ejemplo «me aproximo al
   conocimiento como científico natural», «manejo conocimientos propios de las ciencias naturales»,
   «desarrollo compromisos personales y sociales»). Hay dos opciones:
   - **(a) Recomendada:** un ítem por cada acción de pensamiento. El componente es la columna (y la
     subcolumna: entorno vivo, entorno físico…), y el estándar general va como contexto en la cita. Cabe
     en el formato actual y Lucía puede sugerir acciones concretas.
   - **(b)** Un ítem por estándar general, con las acciones como evidencias. Son menos ítems, pero quedan
     muy largos y la sugerencia pierde precisión.
2. **Asignaturas de 10° y 11°.** ¿Precargamos Biología, Física, Química, Historia y Geografía como
   asignaturas sugeridas, ya vinculadas a su área? Recomendación: sí, porque es como se llaman en muchos
   colegios. ¿O dejamos que cada colegio las cree y las vincule a mano?
3. **¿Entra Inglés en esta misma tanda?** El MEN tiene DBA de Inglés de 6° a 11° y el «Currículo
   sugerido de Inglés». Recomendación: dejarlo para la spec siguiente, para no demorar la de Ciencias.
4. **¿Quién revisa la muestra?** Antes, la revisión docente de Matemáticas y Lenguaje quedó pendiente
   (SPEC-0004). Para Ciencias conviene un docente de cada área. ¿Hay alguien en el equipo o en el piloto
   que pueda hacerlo?

## 13. Decisiones del product owner (2026-11-21)

«Hazlo con tus recomendaciones; deja Inglés para después»:

1. Estándares: **un ítem por acción de pensamiento** (opción a). Componente = su columna; en la lista va
   el estándar general al que apunta (la pantalla la titula «Estándar del grupo de grados»).
2. **Biología, Física, Química, Historia y Geografía** quedan precargadas y vinculadas a su área.
3. **Inglés** se deja para una spec siguiente.
4. Revisión de la muestra: un docente de cada área (pendiente; las fuentes entran `PENDING`).

## 14. Implementación (2026-11-21)

| Fuente (clave)                                         | Ítems | Verificación contra el PDF           |
| ------------------------------------------------------ | ----- | ------------------------------------ |
| DBA Ciencias Naturales V.1, 2016 (`MEN-DBA-CNA-V1`)    | 54    | 184 de 184 evidencias; texto literal |
| DBA Ciencias Sociales V.1, 2016 (`MEN-DBA-CSO-V1`)     | 82    | 328 de 328 evidencias; texto literal |
| Estándares Ciencias Naturales, 2006 (`MEN-EBC-CNA-V1`) | 342   | 342 de 342 viñetas; texto literal    |
| Estándares Ciencias Sociales, 2006 (`MEN-EBC-CSO-V1`)  | 250   | 250 de 250 viñetas; texto literal    |

- Herramientas nuevas en `apps/web/curriculum/tools/`: `extract_dba_columns.py` (DBA a dos columnas,
  leídos palabra por palabra con su posición), `extract_ebc.py` (Estándares) y `verify_columns.py`
  (verificación por otro camino: recorta cada columna). `curriculum:verify` las usa según `layout` en
  `sources.json`; `build_sources.py` acepta los nombres de las fuentes a construir.
- Correcciones documentadas en `tools/fixes/`: 3 textos con espacios mal puestos en el propio PDF
  («C o m p a r a…», «Comprendelaimportancia…», «E xplica») y 7 textos que el verificador no puede
  comparar por cómo recorta (encabezados intercalados, guiones de fin de línea), **comparados contra la
  imagen de la página**.
- En 8°-9° y 10°-11° de Ciencias Naturales hay más estándares generales que subcolumnas: esas acciones
  llevan todos los estándares del grupo.
- La planeación, las propuestas de Lucía y los objetivos usan solo DBA; los Estándares se ven en «DBA y
  Estándares» del curso y alimentan la búsqueda del AI Engine (índice: 951 ítems).

| Criterio   | Estado    | Evidencia                                                                                      |
| ---------- | --------- | ---------------------------------------------------------------------------------------------- |
| CA-0036-01 | Cumplido  | `npm run curriculum:verify`: las 4 fuentes nuevas OK                                           |
| CA-0036-02 | Cumplido  | `tests/integration/spec-0036.test.ts`; `curriculum:import` dos veces en dev y test             |
| CA-0036-03 | Cumplido  | Integración: Naturales 6° con 5 DBA y 78 acciones de 6°-7°, con cita                           |
| CA-0036-04 | Cumplido  | Integración y e2e `spec-0036.spec.ts` (Sociales 8°: 8 DBA y 50 acciones)                       |
| CA-0036-05 | Cumplido  | e2e: en Naturales 7°, Lucía sugiere el DBA 1 (energía mecánica)                                |
| CA-0036-06 | Cumplido  | Integración en `spec-0014.test.ts`: al motor solo van DBA de Sociales 6°                       |
| CA-0036-07 | Pendiente | 14 casos nuevos en el benchmark; correrlo necesita el modelo de embeddings, que no estaba aquí |
| CA-0036-08 | Cumplido  | Integración: texto guardado idéntico al archivo                                                |
| CA-0036-09 | Cumplido  | Integración y e2e: fuentes `PENDING` y aviso de revisión docente                               |
| CA-0036-10 | Cumplido  | Integración en `documents.test.ts`: el taller lleva «DBA 4: …» en la guía del docente          |

**Hallazgo aparte:** con `pdftotext` 24.02 (el de este entorno) la verificación de las fuentes de
SPEC-0004 (Matemáticas, Lenguaje, Transición) falla igual que antes de este cambio: la versión de
`pdftotext` parte el texto distinto de la que se usó al crearlas. Las fuentes nuevas no dependen de eso.
