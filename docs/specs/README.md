# Specs

Una feature por archivo: `SPEC-NNNN-titulo.md`, a partir de [_template.md](_template.md).

**Estados:** Borrador → En revisión → **Aprobada** → En implementación → Implementada (→ Obsoleta).
Solo se implementa lo que está **Aprobada**. Solo el usuario (product owner) aprueba.

## Índice

| Spec                                                          | Título                                                                          | Fase                        | Estado       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------- | ------------ |
| [SPEC-0001](SPEC-0001-foundation.md)                          | Foundation: base técnica del producto                                           | 1 · Foundation              | Implementada |
| [SPEC-0002](SPEC-0002-espacios-colegios-sedes.md)             | Espacios: docente independiente y colegios con sedes e invitaciones             | 2 · Identity                | Implementada |
| [SPEC-0003](SPEC-0003-mis-cursos.md)                          | Mis cursos y áreas de la Ley 115                                                | 2 · Identity                | Implementada |
| [SPEC-0004](SPEC-0004-catalogo-curricular.md)                 | Catálogo curricular oficial (DBA y Estándares) por curso                        | 3 · Curriculum              | Implementada |
| [SPEC-0005](SPEC-0005-primer-rag-curricular.md)               | Primer RAG: búsqueda semántica en el currículo                                  | 3 · Curriculum              | Implementada |
| [SPEC-0006](SPEC-0006-planeacion-del-curso.md)                | Planeación del curso: periodos, unidades, temas y objetivos                     | 4 · Planning                | Implementada |
| [SPEC-0007](SPEC-0007-generacion-estructurada.md)             | AI Engine: generación estructurada y primera sugerencia con IA                  | 5 · AI Engine               | Implementada |
| [SPEC-0008](SPEC-0008-talleres-y-quices.md)                   | Talleres y quices con IA, revisión y evaluación docente                         | 6 · Generation              | Implementada |
| [SPEC-0009](SPEC-0009-exportar-docx-pdf.md)                   | Exportar talleres y quices a Word y PDF                                         | 7 · Documents               | Implementada |
| [SPEC-0010](SPEC-0010-formato-propio-del-docente.md)          | Formato propio del docente para talleres                                        | 7 · Documents               | Implementada |
| [SPEC-0011](SPEC-0011-examenes.md)                            | Exámenes con IA                                                                 | 6 · Generation              | Implementada |
| [SPEC-0012](SPEC-0012-rediseno-visual-y-ux.md)                | Rediseño visual y de experiencia de usuario (va antes de SPEC-0011)             | Transversal                 | Implementada |
| [SPEC-0013](SPEC-0013-ux-mas-facil.md)                        | ProfIA más fácil: menos pasos, hecho para el celular e instalable               | Transversal                 | Implementada |
| [SPEC-0014](SPEC-0014-flujos-asistidos-por-ia.md)             | Flujos asistidos por IA de punta a punta: el docente hace lo mínimo             | 4/6 · Planning y Generation | Implementada |
| [SPEC-0016](SPEC-0016-talleres-con-dua.md)                    | Talleres con Diseño Universal para el Aprendizaje (DUA), a elección del docente | 6 · Generation              | Implementada |
| [SPEC-0017](SPEC-0017-piar.md)                                | PIAR: Plan Individual de Ajustes Razonables, privado y cifrado                  | 6 · Generation (privacidad) | Implementada |
| [SPEC-0018](SPEC-0018-sin-conexion-compacto-en-celular.md)    | "Sin conexión" compacto en el celular: ícono con aviso y ventana                | Transversal                 | Implementada |
| [SPEC-0019](SPEC-0019-asistente-un-paso-por-pantalla.md)      | Asistente de crear: un paso por pantalla, lo elegido en los pasos y «Atrás»     | Transversal                 | Implementada |
| [SPEC-0020](SPEC-0020-material-de-referencia.md)              | Material de referencia del docente para generar (PDF, texto, libro o web)       | 6 · Generation              | Borrador     |
| [SPEC-0021](SPEC-0021-mejora-continua-con-el-docente.md)      | Mejora continua de la IA con lo que hace el docente                             | 6 · Generation              | Implementada |
| [SPEC-0022](SPEC-0022-verificar-respuestas-de-matematicas.md) | Verificar las respuestas de Matemáticas                                         | 6 · Generation              | Implementada |
| [SPEC-0023](SPEC-0023-preguntas-tipo-saber-con-figuras.md)    | Preguntas tipo Saber (ICFES) con situación, figura y competencia                | 6 · Generation              | Implementada |
| [SPEC-0024](SPEC-0024-plan-de-aula-y-escala-de-valoracion.md) | Plan de aula (secuencia didáctica) y rúbrica en la escala del colegio           | 6 · Generation              | Implementada |
| [SPEC-0027](SPEC-0027-ajustes-rapidos-con-botones.md)         | Ajustes rápidos con botones («Más fácil», «Más corto»…) sin escribir            | 6 · Generation              | Implementada |
| [SPEC-0028](SPEC-0028-usar-en-mis-otros-grupos.md)            | Usar el mismo recurso en mis otros grupos, sin gastar cupo                      | 6 · Generation              | Implementada |
| [SPEC-0029](SPEC-0029-ver-el-recurso-como-la-hoja.md)         | Ver el recurso como la hoja que se imprime                                      | Transversal                 | Implementada |
| [SPEC-0030](SPEC-0030-para-esta-semana.md)                    | "Para esta semana" en el Inicio                                                 | Transversal                 | Implementada |
| [SPEC-0031](SPEC-0031-compartir-e-imprimir.md)                | Compartir por WhatsApp e imprimir directo                                       | Transversal                 | Implementada |
| [SPEC-0032](SPEC-0032-primer-curso-con-temas-propuestos.md)   | Primer curso sin escribir temas                                                 | Transversal                 | Implementada |
| [SPEC-0033](SPEC-0033-barra-de-navegacion-abajo.md)           | Barra de navegación abajo en el celular                                         | Transversal                 | Implementada |
| [SPEC-0034](SPEC-0034-detalles-de-usabilidad.md)              | Detalles: avisos abajo, letra más grande y "Borrador / Listo"                   | Transversal                 | Implementada |
| [SPEC-0035](SPEC-0035-recuperar-contrasena.md)                | Recuperar la contraseña por correo y ver la contraseña al escribirla            | 2 · Identity                | Implementada |
| [SPEC-0036](SPEC-0036-dba-y-estandares-de-ciencias.md)        | DBA y Estándares de Ciencias Naturales y Ciencias Sociales                      | 3 · Curriculum              | Borrador     |

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
