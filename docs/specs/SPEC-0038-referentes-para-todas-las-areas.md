# SPEC-0038 — Referentes oficiales para todas las áreas obligatorias

| Campo                    | Valor                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Estado                   | **Implementada** (etapa 1 y etapa 2, 2026-11-22) — revisión docente del contenido pendiente    |
| Fase del roadmap         | 3 · Curriculum                                                                                 |
| Módulo(s) responsable(s) | `modules/curriculum`, `modules/courses`, `apps/ai-engine` (índice)                             |
| Agentes                  | curriculum, database, rag, qa                                                                  |
| ADR relacionados         | ADR-0005 (catálogo versionado), ADR-0022 (aceptado: orientaciones pedagógicas como referentes) |
| Autor / Fecha            | Claude, a pedido del product owner / 2026-11-22                                                |

Pedido del product owner (2026-11-21): que Lucía pueda hacer los recursos «por sí misma», no solo con lo
que suba el docente. Se aprobó el orden propuesto: Competencias Ciudadanas, DBA de Inglés 6°-11° y
después las áreas sin DBA (Tecnología, Artística, Educación Física, Filosofía, Ética). Mismo proceso y
garantías de SPEC-0004, SPEC-0036 y SPEC-0037.

## 1. Objetivo

Que toda asignatura obligatoria de la Ley 115 (art. 23 y 31) y la Cátedra de la Paz (Ley 1732 de 2014)
tenga un referente oficial del MEN en ProfIA, para que Lucía planee y genere con base en él y el docente
lo vea con su cita.

## 2. Alcance

### Etapa 1 (implementada)

- **Estándares Básicos de Competencias Ciudadanas** (MEN 2006, págs. 170-179 del mismo PDF de los
  Estándares que ya se usa): 156 estándares específicos de 1° a 11°, uno por viñeta, con su grupo
  (Convivencia y paz; Participación y responsabilidad democrática; Pluralidad, identidad y valoración de
  las diferencias) y el estándar general del grupo como lista.
- **Área nueva `CIUDADANAS`** («Competencias Ciudadanas»). Se vinculan solas: «Ética y Valores Humanos» y
  la nueva asignatura precargada «Cátedra de la Paz» (también en los espacios que ya existen).
- **DBA de Inglés 6° a 11°** del _Esquema Curricular Sugerido de Inglés_ (MEN; PDF oficial en
  eco.colombiaaprende.edu.co, revisión 2021): 46 DBA en su versión corta, con el nivel de inglés del grado
  (A1, A2.1, A2.2, B1.1, B1.2, B1.3) y **sin evidencias** (el documento no las trae).
- Formato: una fuente puede marcarse `dbaWithoutEvidences` (versión corta). Solo en ella un DBA puede ir
  sin evidencias.

### Etapa 2 (implementada con ADR-0022)

Áreas obligatorias sin DBA ni Estándares, con sus documentos oficiales del MEN:

| Asignatura               | Documento                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Tecnología e Informática | Orientaciones generales para la educación en tecnología (Guía 30)                                                        |
| Educación Artística      | Orientaciones pedagógicas para la Educación Artística (Documento 16)                                                     |
| Educación Física         | Orientaciones pedagógicas para la Educación Física, Recreación y Deporte (Documento 15)                                  |
| Filosofía (10°-11°)      | Orientaciones pedagógicas para la Filosofía en la Educación Media (Documento 14)                                         |
| Ética y Valores Humanos  | No se carga: los Lineamientos de 1998 son texto continuo, sin desempeños enumerados; Ética usa los Estándares Ciudadanos |

Antes de cargar cada uno se confirmó que es el PDF oficial del MEN y se revisaron los términos de uso.
Las _Orientaciones curriculares_ de 2019 (Artística) y 2022 (Educación Física) no permiten reproducir su
texto sin permiso escrito del MEN, así que se usan las ediciones de 2010 (ADR-0022).

**No incluye (ni en la etapa 2):**

- Educación Religiosa: sus estándares no son del MEN (los publica la Conferencia Episcopal); requiere
  permiso aparte.
- Que un curso de Ciencias Sociales vea también los Estándares Ciudadanos (una asignatura tiene una sola
  área; se decide aparte si hace falta).
- Matrices de referencia del ICFES, mallas de aprendizaje y textos del MEN (_Way to Go!_, _English,
  please!_, Secundaria Activa): specs siguientes, con revisión de licencias.
- El material propio del docente (SPEC-0020).

## 3. Reglas de negocio

- **RN-01:** Las de SPEC-0004/0036/0037: texto literal del MEN, cita con página, verificación contra el
  PDF, importación idempotente, `review.status = PENDING` hasta la revisión docente.
- **RN-02:** Las asignaturas precargadas que siguen sin área se vinculan a `CIUDADANAS` («Ética y Valores
  Humanos», «Cátedra de la Paz»); si el docente ya eligió otra área, se respeta.
- **RN-03:** Un tramo que el PDF trae con una fuente ilegible para la extracción se marca `[ilegible]` y se
  transcribe de la imagen de la página como corrección documentada (`tools/fixes`); la verificación exige
  que el resto del enunciado sea literal.
- **RN-04:** Los DBA de Inglés se usan como los demás DBA: planeación, cobertura, propuestas de Lucía y
  generación. Sin evidencias, la tarjeta no muestra lista.
- **RN-05:** Ética y Cátedra de la Paz tienen Estándares pero no DBA: Lucía no propone periodos (eso pide
  DBA) y la pantalla lo explica, como en cualquier asignatura sin DBA.

## 4. Criterios de aceptación (etapa 1)

- **CA-0038-01:** Importar dos veces las fuentes nuevas no crea ni duplica nada (156 + 46).
- **CA-0038-02:** Inglés de 6° muestra sus 8 DBA (nivel A1, sin lista) y los Estándares de 6°-7°.
- **CA-0038-03:** Los DBA que el PDF trae con fuente ilegible quedan con el texto de la página; ningún DBA
  guarda «[ilegible]».
- **CA-0038-04:** Ética de 8° muestra los 32 Estándares Ciudadanos de 8°-9° con el estándar de su grupo;
  Cátedra de la Paz de 10° muestra los 27 de 10°-11°.
- **CA-0038-05:** El texto guardado es idéntico al del archivo y las fuentes quedan pendientes de revisión.
- **CA-0038-06:** En Inglés de 9°, Lucía propone el periodo solo con los DBA de Inglés de 9°.
- **CA-0038-07:** Un DBA sin evidencias solo se acepta en una fuente marcada como versión corta.
- **CA-0038-08:** Importar dos veces las orientaciones no crea ni duplica nada (169 + 150 + 45 + 15).
- **CA-0038-09:** Tecnología 6° ve 31 orientaciones con su competencia y cita; Educación Física 10°, 30;
  Artística 4°, 9; Filosofía 11°, 15; Filosofía 9°, ninguna.
- **CA-0038-10:** El texto de las orientaciones guardado es idéntico al del archivo.

## 5. Implementación (2026-11-22)

| Fuente (clave)                                               | Ítems | Verificación contra el PDF                                        |
| ------------------------------------------------------------ | ----- | ----------------------------------------------------------------- |
| Estándares Ciudadanos, 2006 (`MEN-EBC-CIU-V1`)               | 156   | 156 de 156 viñetas, literal                                       |
| DBA Inglés 6°-11°, Esquema Curricular (`MEN-DBA-ING-ESQ-V1`) | 46    | 46 de 46 viñetas; 40 literales, 6 tramos transcritos de la imagen |

- Herramientas: `extract_ciudadanas.py`, `extract_esquema_ingles.py` y `verify_columns.verify_esquema`
  (recorta solo la franja «Derechos Básicos Inglés» de cada página, sin metas ni objetivos).
- Base de datos: migración `20261121200000_curriculum_area_ciudadanas` (área, vínculo de Ética y Cátedra de
  la Paz precargada en los espacios existentes). Sin cambios en `schema.prisma`.
- AI Engine: sin cambios de código; índice de 1.720 ítems.
- Pruebas: `tests/integration/spec-0038.test.ts`, CA-0038-06 en `spec-0014.test.ts`, e2e
  `spec-0038.spec.ts`. CA-0014-07 ahora usa Educación Religiosa (sin área ni referentes).

### Etapa 2 (2026-11-22)

| Fuente (clave)                                             | Ítems | Verificación contra el PDF                              |
| ---------------------------------------------------------- | ----- | ------------------------------------------------------- |
| Guía 30, Tecnología, 2008 (`MEN-ORI-TEC-V1`)               | 169   | 169 de 169 viñetas, literal                             |
| Documento 15, Educación Física, 2010 (`MEN-ORI-EFI-V1`)    | 150   | 5 tablas de 30 celdas, literal (1 guion corregido)      |
| Documento 16, Educación Artística, 2010 (`MEN-ORI-ART-V1`) | 45    | 45 de 45 siglas «C. B.», literal (erratas del original) |
| Documento 14, Filosofía, 2010 (`MEN-ORI-FIL-V1`)           | 15    | 3 tablas de 5 desempeños, literal                       |

- Herramientas: `extract_orientaciones.py` (Tecnología con `pdftotext`; tablas giradas con `pdfplumber` y
  `pypdf`) y `verify_columns.verify_orientacion` (lee el PDF con `pdftotext -raw`, otro camino).
- Base de datos: migración `20261122120000_curriculum_orientations` (tipo `ORIENTATION`, áreas
  `TECNOLOGIA`, `EDUCACION_FISICA`, `ARTISTICA`, `FILOSOFIA` y vínculo de las precargadas).
- AI Engine: `types` admite `ORIENTATION`; índice de 2.099 ítems. Uso al planear y generar: SPEC-0039.

## 6. Seguridad y privacidad

El catálogo es público y global; no hay datos de docentes ni estudiantes.

## 7. Preguntas abiertas

1. **Revisión docente:** pedir a un docente de Inglés y uno de Ética que comparen una muestra con el PDF.
   También uno de Tecnología, Educación Física, Artística y Filosofía para las orientaciones.
2. **Versiones nuevas:** pedir al MEN permiso para usar las Orientaciones curriculares de 2019 y 2022.
