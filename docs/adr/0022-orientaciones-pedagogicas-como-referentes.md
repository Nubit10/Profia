# ADR-0022 — Orientaciones pedagógicas del MEN como referentes del catálogo

| Campo              | Valor      |
| ------------------ | ---------- |
| Estado             | Propuesto  |
| Fecha              | 2026-11-22 |
| Specs relacionadas | SPEC-0038  |

## Contexto

El catálogo (ADR-0005) solo conoce dos tipos de ítem: `DBA` (por grado, con evidencias) y `STANDARD`
(por grupo de grados). Las áreas obligatorias sin DBA ni Estándares (Tecnología e Informática, Educación
Artística, Educación Física, Filosofía y, en parte, Ética) tienen documentos oficiales del MEN con otra
forma: competencias por área y, según el documento, desempeños por grupo de grados (Guía 30 de
Tecnología, orientaciones de Educación Física), procesos (Artística) o núcleos y competencias de la media
(Filosofía). Sin ellos, Lucía genera en esas asignaturas solo con el tema y los ajustes del docente.

## Decisión (propuesta)

Cargar esas orientaciones en el mismo catálogo, con un tercer tipo `ORIENTATION`:

- Un ítem por desempeño o enunciado que el documento presenta como tal, con `gradeFrom`/`gradeTo` (como
  un estándar), `component` = competencia o eje y la cita con página. Texto literal y verificado contra el
  PDF, con las mismas herramientas.
- Un área curricular por asignatura (`TECNOLOGIA`, `ARTISTICA`, `EDUCACION_FISICA`, `FILOSOFIA`); Ética
  suma sus lineamientos a `CIUDADANAS`.
- Para el docente se ven en «DBA y Estándares» con su nombre («Orientación del MEN»). La búsqueda los
  incluye (`types` acepta `ORIENTATION`, cambio aditivo del contrato `retrieval-curriculum.v1`).
- Planeación y propuestas de Lucía: en un área sin DBA, Lucía puede proponer temas a partir de las
  orientaciones del grupo de grados (nueva versión del contrato `generation-planning`, prompt versionado).
- Cada documento se carga solo después de revisar sus términos de uso; si no permiten uso comercial, no
  se muestra el texto y se usa únicamente como inspiración no citada (decisión aparte por documento).

## Alternativas consideradas

- **Guardarlos como `STANDARD`** — más simple, pero el docente vería «Estándar» en algo que el MEN no
  llama así, y la cobertura o las etiquetas de los estándares no aplican igual.
- **Usarlos solo como contexto del AI Engine (RAG) sin mostrarlos** — Lucía mejora, pero el docente no ve
  de dónde sale lo que propone y se pierde la cita, que es una regla del producto.
- **Esperar a SPEC-0020 (material del docente)** — no resuelve que Lucía sepa por sí misma.

## Consecuencias

- Positivas: ninguna asignatura obligatoria queda sin referente oficial; Lucía puede proponer temas en
  Tecnología, Artística, Educación Física y Filosofía.
- Negativas / costos: migración (enum `CurriculumDocumentType`, áreas nuevas), extractores por documento,
  versión nueva del contrato y del prompt de planeación, revisión de licencias y revisión docente.
- Queda prohibido: mostrar como DBA o Estándar algo que el documento no llama así, y cargar un documento
  sin revisar sus términos de uso.
