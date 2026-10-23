# Specs

Una feature por archivo: `SPEC-NNNN-titulo.md`, a partir de [_template.md](_template.md).

**Estados:** Borrador → En revisión → **Aprobada** → En implementación → Implementada (→ Obsoleta).
Solo se implementa lo que está **Aprobada**. Solo el usuario (product owner) aprueba.

## Índice

| Spec                                                 | Título                                                              | Fase           | Estado            |
| ---------------------------------------------------- | ------------------------------------------------------------------- | -------------- | ----------------- |
| [SPEC-0001](SPEC-0001-foundation.md)                 | Foundation: base técnica del producto                               | 1 · Foundation | Implementada      |
| [SPEC-0002](SPEC-0002-espacios-colegios-sedes.md)    | Espacios: docente independiente y colegios con sedes e invitaciones | 2 · Identity   | Implementada      |
| [SPEC-0003](SPEC-0003-mis-cursos.md)                 | Mis cursos y áreas de la Ley 115                                    | 2 · Identity   | Implementada      |
| [SPEC-0004](SPEC-0004-catalogo-curricular.md)        | Catálogo curricular oficial (DBA y Estándares) por curso            | 3 · Curriculum | Implementada      |
| [SPEC-0005](SPEC-0005-primer-rag-curricular.md)      | Primer RAG: búsqueda semántica en el currículo                      | 3 · Curriculum | Implementada      |
| [SPEC-0006](SPEC-0006-planeacion-del-curso.md)       | Planeación del curso: periodos, unidades, temas y objetivos         | 4 · Planning   | Implementada      |
| [SPEC-0007](SPEC-0007-generacion-estructurada.md)    | AI Engine: generación estructurada y primera sugerencia con IA      | 5 · AI Engine  | Implementada      |
| [SPEC-0008](SPEC-0008-talleres-y-quices.md)          | Talleres y quices con IA, revisión y evaluación docente             | 6 · Generation | Implementada      |
| [SPEC-0009](SPEC-0009-exportar-docx-pdf.md)          | Exportar talleres y quices a Word y PDF                             | 7 · Documents  | Implementada      |
| [SPEC-0010](SPEC-0010-formato-propio-del-docente.md) | Formato propio del docente para talleres                            | 7 · Documents  | Implementada      |
| [SPEC-0011](SPEC-0011-examenes.md)                   | Exámenes con IA                                                     | 6 · Generation | En implementación |
| [SPEC-0012](SPEC-0012-rediseno-visual-y-ux.md)       | Rediseño visual y de experiencia de usuario (va antes de SPEC-0011) | Transversal    | Implementada      |

## Mapa del roadmap → specs previstas

Se crean cuando llegue su fase; esta lista orienta y no compromete el alcance.

| Fase                 | Specs previstas                                                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 · Discovery        | Benchmark de modelos (casos reales, métricas, conjunto versionado) · Guion de validación con docentes                                                                                                                         |
| 1 · Foundation       | SPEC-0001                                                                                                                                                                                                                     |
| 2 · Identity         | SPEC-0002, SPEC-0003 (estudiantes se difieren a la fase que los use, por privacidad)                                                                                                                                          |
| 3 · Curriculum       | SPEC-0004, SPEC-0005                                                                                                                                                                                                          |
| 4 · Planning         | SPEC-0006                                                                                                                                                                                                                     |
| 5 · AI Engine        | SPEC-0007 (generación estructurada, sugerencia de objetivos)                                                                                                                                                                  |
| 6 · Generation       | ResourceBlueprint · Generadores (plan de aula, taller, quiz, examen, tema…) · Revisión docente · **Evaluación docente de cada producción (qué está bien, qué mejorar) que alimenta la mejora de las respuestas** · Biblioteca |
| 7 · Documents        | Exportación DOCX/PDF · Plantillas · Claves de respuesta                                                                                                                                                                       |
| 8 · Assessment       | AssessmentBlueprint · Preguntas y rúbricas · Resultados y analítica                                                                                                                                                           |
| 9 · Memory           | Memoria pedagógica · Dificultades · Recomendaciones                                                                                                                                                                           |
| 10 · Differentiation | Perfiles de apoyo pedagógico · Versiones diferenciadas                                                                                                                                                                        |
| 11 · Institutional   | Coordinación · Biblioteca compartida · Analytics institucional                                                                                                                                                                |
| 12 · Scale           | Fine-tuning experimental · Optimización GPU                                                                                                                                                                                   |

**Milestone MVP** (plan maestro §17): un docente crea un grupo, selecciona asignatura y tema, vincula contexto curricular, configura un blueprint, genera un recurso con IA, lo revisa, lo exporta a DOCX/PDF y lo recupera después con toda su trazabilidad. Requiere fases 1–7.
