# ADR-0022 — Orientaciones pedagógicas del MEN como referentes del catálogo

| Campo              | Valor                                                            |
| ------------------ | ---------------------------------------------------------------- |
| Estado             | **Aceptado** (2026-11-22, por el product owner)                  |
| Fecha              | 2026-11-22                                                       |
| Specs relacionadas | SPEC-0038 (etapa 2), SPEC-0039 (usar Estándares y Orientaciones) |

## Contexto

El catálogo (ADR-0005) solo conocía dos tipos de ítem: `DBA` (por grado, con evidencias) y `STANDARD`
(por grupo de grados). Las áreas obligatorias sin DBA ni Estándares (Tecnología e Informática, Educación
Artística, Educación Física, Filosofía) tienen documentos oficiales del MEN con otra forma: competencias
y desempeños por grupo de grados. Sin ellos, Lucía generaba en esas asignaturas solo con el tema y lo
que pedía el docente, y no podía proponer la planeación.

## Decisión

Cargar las orientaciones en el mismo catálogo como un tercer tipo, `ORIENTATION`, y que la planeación y
la generación usen, en cada curso, sus **referentes base**: los DBA del grado; si el área no tiene DBA,
sus Estándares y Orientaciones.

- **Datos.** Un ítem por desempeño, con `gradeFrom`/`gradeTo`, `component` = competencia o componente,
  la cita con página y, cuando el documento la trae, la competencia o el indicador al que apunta como
  lista. Texto literal, verificado contra el PDF (`extract_orientaciones.py`, `verify_orientacion`).
  Claves `MEN-ORI-<ÁREA>-V1`. Áreas nuevas `TECNOLOGIA`, `EDUCACION_FISICA`, `ARTISTICA`, `FILOSOFIA`
  (migración `curriculum_orientations`, con vínculo automático de las asignaturas precargadas).
- **Licencias.** Antes de cargar cada documento se revisan sus términos. Las _Orientaciones
  curriculares_ de 2019 (Artística y Cultural) y de 2022 (Educación Física) dicen que no pueden
  reproducirse sin permiso escrito del MEN: no se cargan. Se usan las ediciones de 2010 (Documentos 14,
  15 y 16) y la Guía 30 de 2008, con © MEN, como los DBA y los Estándares. La versión 2022 de
  Tecnología no trae esa restricción, pero la Guía 30 trae la lista de desempeños por grado y es la
  que se carga.
- **Ética.** Los Lineamientos de 1998 son texto continuo, sin desempeños enumerados: no se cargan. Ética
  y Cátedra de la Paz usan los Estándares de Competencias Ciudadanas (SPEC-0038 etapa 1).
- **Para el docente.** Se ven en «DBA y Estándares» como «Orientación n», con «Competencia a la que
  apunta». Las etiquetas salen del código (`lib/curriculum-references.ts`), así un recurso viejo sigue
  diciendo «DBA».
- **Búsqueda.** `types` acepta `ORIENTATION` (cambio aditivo de `retrieval-curriculum.v1`).
- **Generación.** Cada referente que no es DBA viaja con `kind` (`STANDARD` u `ORIENTATION`), campo
  opcional en todos los contratos de generación. Solo entonces el AI Engine agrega el anexo de prompt
  `referentes.v1` y la versión registrada lo dice (`planning.v1+referentes.v1`); un pedido con solo DBA
  es idéntico al de antes.

## Alternativas consideradas

- **Guardarlos como `STANDARD`.** Más simple, pero el docente vería «Estándar» en algo que el MEN no
  llama así.
- **Usarlos solo como contexto del AI Engine (RAG) sin mostrarlos.** Lucía mejora, pero el docente no
  ve de dónde sale lo que propone y se pierde la cita, que es una regla del producto.
- **Prompts nuevos (`planning.v2`, `quiz.v2`…).** Obligaría a cambiar la versión de todos los pedidos,
  también los que solo llevan DBA; el anexo se agrega solo cuando hace falta, como `udl.v1` y `saber.v1`.
- **Esperar a SPEC-0020 (material del docente).** No resuelve que Lucía sepa por sí misma.

## Consecuencias

- Positivas: toda asignatura obligatoria, salvo Educación Religiosa, tiene un referente oficial; Lucía
  propone temas y objetivos en Ética, Cátedra de la Paz, Tecnología, Artística, Educación Física,
  Filosofía e Inglés de 1° a 5°.
- Negativas / costos: herramientas de extracción con `pdfplumber` y `pypdf` (solo en el equipo de quien
  actualiza el catálogo), revisión docente de cuatro documentos más, y un anexo de prompt que se debe
  medir en el benchmark.
- Queda prohibido: mostrar como DBA o Estándar algo que el documento no llama así, y cargar un documento
  sin revisar sus términos de uso.
