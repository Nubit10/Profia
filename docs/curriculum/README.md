# Catálogo curricular

Fuentes oficiales del MEN cargadas en ProfIA (ADR-0005, SPEC-0004).

| Fuente                                                          | Ítems               | Estado de revisión            |
| --------------------------------------------------------------- | ------------------- | ----------------------------- |
| DBA Matemáticas V.2 (2016)                                      | 119                 | Pendiente de revisión docente |
| DBA Lenguaje V.2 (2016)                                         | 88                  | Pendiente de revisión docente |
| DBA Transición V.1 (2016)                                       | 16                  | Pendiente de revisión docente |
| DBA Ciencias Naturales V.1 (2016)                               | 54                  | Pendiente de revisión docente |
| DBA Ciencias Sociales V.1 (2016)                                | 82                  | Pendiente de revisión docente |
| Estándares Básicos de Competencias en Ciencias Naturales (2006) | 342 acciones        | Pendiente de revisión docente |
| Estándares Básicos de Competencias en Ciencias Sociales (2006)  | 250 acciones        | Pendiente de revisión docente |
| Estándares Básicos de Competencias en Matemáticas (2006)        | 172                 | Pendiente de revisión docente |
| Estándares Básicos de Competencias del Lenguaje (2006)          | 177 subprocesos     | Pendiente de revisión docente |
| Estándares de Inglés, Guía 22 (2006), 1.° a 5.°                 | 91                  | Pendiente de revisión docente |
| Estándares de Inglés, Guía 22 (2006), 6.° a 11.°                | 127                 | Pendiente de revisión docente |
| Estándares Básicos de Competencias Ciudadanas (2006)            | 156                 | Pendiente de revisión docente |
| DBA de Inglés 6.° a 11.°, Esquema Curricular Sugerido (2016)    | 46 (sin evidencias) | Pendiente de revisión docente |
| Orientaciones: Guía 30 de Tecnología (2008)                     | 169 desempeños      | Pendiente de revisión docente |
| Orientaciones: Educación Física, Documento 15 (2010)            | 150 desempeños      | Pendiente de revisión docente |
| Orientaciones: Educación Artística, Documento 16 (2010)         | 45 evidencias       | Pendiente de revisión docente |
| Orientaciones: Filosofía en la Media, Documento 14 (2010)       | 15 desempeños       | Pendiente de revisión docente |

DBA de Inglés de 6.° a 11.° (SPEC-0038): versión corta del _Esquema Curricular Sugerido de Inglés_
(PDF oficial en eco.colombiaaprende.edu.co), con el nivel del grado y sin evidencias (la fuente lleva
`dbaWithoutEvidences`). Seis tramos con una fuente ilegible para la extracción se transcribieron de la
imagen de la página (`tools/fixes/dba-ingles-esquema-v1.json`). Competencias Ciudadanas es el área
`CIUDADANAS`: la ven Ética y Valores Humanos y Cátedra de la Paz.

Orientaciones (SPEC-0038 etapa 2, ADR-0022): tipo `ORIENTATION`, áreas `TECNOLOGIA`, `EDUCACION_FISICA`,
`ARTISTICA` y `FILOSOFIA`. Se usan las ediciones de 2010 porque las Orientaciones curriculares de 2019 y
2022 no permiten reproducir su texto sin permiso escrito del MEN. Las tablas giradas se extraen con
`pdfplumber` y `pypdf` (`pip install pdfplumber pypdf`); la verificación usa solo `pdftotext`. Cuando un
área no tiene DBA, Lucía planea y genera con sus Estándares u Orientaciones (SPEC-0039).

Los Estándares (SPEC-0036) se guardan como una acción de pensamiento por ítem: el componente es su
columna y la lista que lo acompaña es el estándar general del grupo de grados al que apunta.

- Archivos de datos: `apps/web/curriculum/men/*.json` (fuente de verdad, versionados en git).
- Herramientas: `apps/web/curriculum/tools/` (extracción desde el PDF, correcciones documentadas, verificación).
- Guía para la revisión docente: [revision-dba.md](revision-dba.md).

## Flujo para agregar o actualizar una fuente

1. Descargar el PDF oficial en `apps/web/curriculum/sources/` (ignorado por git) y extraer el texto: `pdftotext -enc UTF-8 <pdf> <archivo>.raw.txt`.
2. Extraer el borrador (`tools/extract_dba.py`; para PDF a dos columnas, `tools/extract_dba_columns.py`;
   para Estándares, `tools/extract_ebc.py`; Inglés Guía 22, `extract_guia22.py`; Ciudadanas,
   `extract_ciudadanas.py`; DBA de Inglés 6.°-11.°, `extract_esquema_ingles.py`; orientaciones,
   `extract_orientaciones.py`). Las fuentes con `"layout": "columns"`, `"ebc"`, `"esquema"` u
   `"orientacion"` en
   `sources.json` se verifican con `tools/verify_columns.py` y no necesitan el `.raw.txt`.
3. Registrar la fuente en `tools/sources.json` y las correcciones con su motivo en `tools/fixes/`.
4. `python curriculum/tools/build_sources.py` y `npm run curriculum:verify`: debe salir todo OK.
5. Revisión docente de una muestra, y luego `review.status: "APPROVED"`.
6. `npm run curriculum:import` en cada entorno (idempotente).

Una versión nueva de un documento usa una clave nueva (`…-V3`): la anterior queda reemplazada, sin borrar sus ítems.
