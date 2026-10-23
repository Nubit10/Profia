# SPEC-0010 — Formato propio del docente para talleres

| Campo                    | Valor                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Estado                   | **Implementada** (2026-10-01)                                                                   |
| Fase del roadmap         | 7 · Documents (plantillas) · con apoyo de 6 · Generation                                        |
| Módulo(s) responsable(s) | `modules/formats` (formatos y logo), `modules/documents`, `modules/resources`, `apps/ai-engine` |
| Agentes                  | product, documents, ai-engine, backend, frontend, privacy, qa, reviewer                         |
| ADR relacionados         | ADR-0009 (documentos), ADR-0010 (imágenes en la base), ADR-0007 (IA), ADR-0004 (tenancy)        |
| Autor / Fecha            | product / 2026-10-01                                                                            |

## 1. Objetivo

Muchos docentes y colegios ya tienen **su formato de guía o taller**: un encabezado con sus campos (institución, área, grado, docente, fecha, nombre del estudiante, número de guía…) y unas secciones en un orden fijo (por ejemplo: saberes previos, conceptualización, actividades, evaluación, autoevaluación). Esta spec permite que el docente **suba ese formato una vez**, que Profe lo entienda y que **los talleres se generen y se descarguen con esa misma estructura**.

## 2. Alcance

**Incluye:**

- **Subir un formato** de taller en Word (DOCX). Profe extrae su estructura:
  - **Encabezado:** los campos en su orden y con sus etiquetas ("ÁREA:", "DOCENTE:", "NOMBRE DEL ESTUDIANTE:", "FECHA:"…), y para cada uno de dónde sale el dato: institución, sede, docente, asignatura, grado, grupo, periodo, tema, año, fecha, o **en blanco** para que lo llene el estudiante.
  - **Secciones:** sus títulos en orden y de qué tipo es cada una:
    - **Actividades:** la IA genera actividades ahí.
    - **Texto:** la IA escribe un contenido para esa sección (por ejemplo, la conceptualización o los criterios de evaluación).
    - **Fijo:** se copia tal cual del formato (por ejemplo, una tabla de autoevaluación que el colegio siempre usa).
- **Revisión por el docente** antes de guardar: ve el encabezado y las secciones detectadas, y puede corregir etiquetas, origen de cada dato, títulos, tipos y orden. Nada se usa sin que el docente lo confirme.
- **Guardar** el formato con un nombre ("Guía de aprendizaje I. E. San José"). El docente puede tener varios y marcar uno como predeterminado.
- **Generar con el formato:** en el formulario del taller aparece junto a las estructuras de SPEC-0008 ("Mi formato: Guía de aprendizaje"). La IA organiza el taller en las secciones del formato, con la intención de cada una.
- **Formato institucional:** el administrador de un colegio sube formatos que ven y usan todos sus docentes (sin poder editarlos) y puede marcar uno como predeterminado del colegio.
- **Logo o escudo** de la institución: lo sube un administrador (del colegio, o el docente independiente en su espacio) y aparece en el encabezado de **todos** los documentos descargados (también los de SPEC-0009).
- **Descargar con el formato:** el Word y el PDF del taller salen con el encabezado del docente (sus etiquetas, en su orden y con los datos llenados automáticamente) y sus secciones, incluidos los textos fijos.

**No incluye (explícitamente):**

- Copiar el diseño visual exacto (colores, fuentes, bordes, posición de cada celda). Se replica la **estructura y el contenido**, con el diseño limpio de SPEC-0009 y el logo de la institución.
- Formatos en PDF, escaneados o en foto: solo Word.
- Formatos para quices o exámenes (después).

## 3. Actores y permisos

| Actor                    | Puede                                                                                                | No puede                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Docente                  | Subir, revisar, editar, renombrar, borrar y usar sus formatos                                        | Ver o usar formatos de otros docentes      |
| Administrador de colegio | Subir, editar y borrar formatos institucionales; elegir el predeterminado del colegio; subir el logo | Editar formatos personales de sus docentes |
| Docente de un colegio    | Ver y usar los formatos institucionales                                                              | Editarlos o borrarlos                      |
| Otra institución         | —                                                                                                    | Ver ni usar por ID (`NOT_FOUND`)           |

## 4. Reglas de negocio

- **RN-01:** El formato solo se usa después de que el docente revisa y confirma la estructura detectada.
- **RN-02:** **Al modelo de IA solo viajan las etiquetas y los títulos**, nunca los valores escritos en el formato: antes de enviarlo se borran los valores de los campos del encabezado, los nombres del docente y de la institución, correos y teléfonos. Las secciones de tipo "fijo" no se envían a la IA.
- **RN-03:** El archivo subido no se guarda: se procesa en memoria y solo queda la estructura confirmada (ver pregunta 2).
- **RN-04:** Un formato tiene entre 1 y 10 secciones; al menos una es de actividades. El encabezado tiene como máximo 16 campos.
- **RN-05:** Un taller generado con un formato guarda una copia de la estructura usada (como el contexto de SPEC-0008 RN-09): si el docente cambia o borra el formato después, el taller y sus descargas no cambian.
- **RN-06:** Las actividades se reparten en las secciones de actividades del formato; cada una tiene al menos una. Las de texto llevan un contenido generado; las fijas, su texto original.
- **RN-08:** Orden de preferencia en el formulario del taller: el formato predeterminado del docente; si no tiene, el predeterminado del colegio; si no hay, la estructura "Inicio, desarrollo y cierre".
- **RN-09:** Logo: PNG o JPEG (validado por su contenido), máximo 500 KB y 2.000 px por lado; se guarda en la base de datos (ADR-0010) y se muestra con una altura fija en el encabezado. SVG y otros formatos se rechazan.
- **RN-07:** Archivos: solo `.docx`, máximo 5 MB, sin macros (`.docm` se rechaza). Se valida el contenido, no solo la extensión.

## 5. Entradas

- Subida: `multipart/form-data` con el archivo y un nombre opcional.
- Estructura del formato (la detectada y la que confirma el docente), validada con Zod:

```json
{
  "name": "Guía de aprendizaje",
  "header": [
    { "label": "ÁREA", "source": "SUBJECT" },
    { "label": "DOCENTE", "source": "TEACHER" },
    { "label": "NOMBRE DEL ESTUDIANTE", "source": "BLANK" }
  ],
  "sections": [
    {
      "title": "Saberes previos",
      "kind": "ACTIVITIES",
      "purpose": "Activar lo que el estudiante ya sabe"
    },
    {
      "title": "Conceptualización",
      "kind": "TEXT",
      "purpose": "Explicar el concepto con ejemplos"
    },
    { "title": "Autoevaluación", "kind": "FIXED", "text": "Marca con X: …" }
  ]
}
```

`source`: `INSTITUTION`, `CAMPUS`, `TEACHER`, `SUBJECT`, `GRADE`, `GROUP`, `GRADE_GROUP`, `PERIOD`, `TOPIC`, `YEAR`, `DATE`, `TITLE`, `BLANK`.

## 6. Salidas

- Tabla `TeacherFormat` (tenant): docente, nombre, estructura (JSON), predeterminado, fechas.
- Contrato nuevo del AI Engine `format-analysis.v1`: recibe etiquetas y títulos (sin valores) y propone el origen de cada campo y el tipo y la intención de cada sección. Versión nueva del contrato del taller (`generation-workshop.v2`) con secciones personalizadas.
- Talleres con `formatSnapshot` y descargas que usan ese encabezado y esas secciones.

## 7. Errores y casos límite

| Caso                                                                              | Comportamiento esperado                                                       |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Archivo que no es DOCX, con macros o de más de 5 MB                               | Rechazo con mensaje claro, sin procesarlo                                     |
| DOCX sin tablas ni títulos reconocibles                                           | Se propone una estructura mínima y el docente la completa a mano              |
| Campos que la IA no sabe a qué dato corresponden                                  | Quedan como "en blanco" y marcados para que el docente revise                 |
| La IA no está disponible                                                          | Se muestra la estructura extraída sin las sugerencias; el docente la completa |
| El formato tiene más secciones de actividades que el número de actividades pedido | El formulario sube el número mínimo y lo explica                              |
| El docente borra un formato usado en talleres                                     | Los talleres conservan su copia (RN-05)                                       |
| Texto del formato con instrucciones para la IA ("ignora…")                        | Va como datos delimitados; el validador aplica igual                          |

## 8. Criterios de aceptación

- **CA-0010-01:** Dado un DOCX con un encabezado en tabla ("ÁREA: Matemáticas", "DOCENTE: Ana Pérez", "NOMBRE: ____") y títulos de sección, cuando el docente lo sube, entonces ve los campos en orden con su origen propuesto y las secciones con su tipo.
- **CA-0010-02:** La petición al AI Engine contiene las etiquetas y los títulos, pero **no** "Matemáticas", "Ana Pérez", el nombre de la institución, correos ni teléfonos, ni el texto de las secciones fijas.
- **CA-0010-03:** Dado un formato revisado y guardado, cuando el docente genera un taller con él, entonces el taller tiene exactamente las secciones del formato en su orden, con actividades en las de actividades, contenido en las de texto y el texto original en las fijas.
- **CA-0010-04:** Cuando descarga ese taller en Word o PDF, el encabezado tiene las etiquetas del formato en su orden, con los datos del curso llenados y en blanco los campos del estudiante.
- **CA-0010-05:** Si el docente cambia o borra el formato, un taller ya generado conserva su estructura y sus descargas no cambian.
- **CA-0010-06:** Un archivo que no es DOCX, un `.docm` o uno de más de 5 MB se rechaza sin procesarse.
- **CA-0010-07:** Un formato de otro docente o de otra institución responde `NOT_FOUND` al verlo, editarlo o usarlo.
- **CA-0010-08:** El formato marcado como predeterminado aparece preseleccionado en el formulario del taller (RN-08).
- **CA-0010-09:** Dado un formato institucional subido por el administrador de un colegio, cuando un docente de ese colegio crea un taller, entonces puede elegirlo pero no editarlo ni borrarlo; un docente de otro colegio no lo ve.
- **CA-0010-10:** Dado un logo subido, cuando se descarga cualquier documento (taller con o sin formato, quiz, clave), entonces el encabezado del Word y del PDF incluye el logo. Un SVG, un GIF o una imagen de más de 500 KB se rechazan, y un docente sin rol de administrador no puede subirlo.

## 9. Seguridad y privacidad

- **Datos a la IA:** solo etiquetas y títulos (RN-02); el texto de las secciones fijas y los valores del encabezado nunca salen del servidor.
- **Archivos subidos:** solo DOCX validado por su contenido (ZIP con `word/document.xml`, sin `vbaProject.bin`), tamaño máximo, procesado en memoria y descartado (RN-03, RN-07). El XML se lee sin resolver entidades externas.
- **Tenancy:** `TeacherFormat` con FK compuesta y test de acceso cruzado (CA-0010-07).
- **Prompt injection:** el contenido del formato va delimitado como datos.

## 10. Tareas

- [x] T1 — Extractor de estructura de DOCX (tablas, títulos, negritas, numeración) en el servidor — documents
- [x] T2 — Contrato y endpoint `format-analysis.v1` con validador; `generation-workshop.v2` con secciones personalizadas; prompts nuevos y benchmark — ai-engine
- [x] T3 — Modelo `TeacherFormat`, servicio, acciones y copia en el recurso — database, backend
- [x] T4 — UI: subir, revisar y editar el formato; elegirlo en el formulario del taller — frontend
- [x] T5 — Renderizado del encabezado y las secciones del formato en DOCX y PDF — documents
- [x] T6 — Filtro de valores y datos personales antes de la IA; validación del archivo — privacy, auth-security
- [x] T7 — Tests (unitarios del extractor con formatos reales, integración, E2E) — qa

## 11. Decisiones del product owner (2026-10-01)

1. Solo formatos en Word (DOCX).
2. No se guarda el archivo original, solo la estructura confirmada.
3. El administrador del colegio puede subir formatos institucionales para todos sus docentes.
4. Solo talleres por ahora; quices y exámenes después.
5. Se incluye el logo o escudo de la institución en los documentos.
6. Formatos reales: el product owner los pedirá a un cliente. Mientras tanto se prueba con formatos de ejemplo con la estructura típica de las guías colombianas, y se ajusta el extractor cuando lleguen los reales.

## 12. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado   | Evidencia                                                                                                                                                                                                |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA-0010-01 | Cumplido | Unit (detección en dos estilos de formato: encabezado de página, tabla con dos puntos, tabla etiqueta-valor, campos en un párrafo, secciones numeradas y con estilo); integración; E2E (subir y revisar) |
| CA-0010-02 | Cumplido | Integración: la petición a la IA no contiene asignatura, docente, institución, grado, periodo ni el texto de la sección fija; motor rechaza campos de valores (`422`)                                    |
| CA-0010-03 | Cumplido | Motor (`workshop.v2`: secciones en orden, textos exigidos); integración (sin secciones fijas hacia la IA); E2E                                                                                           |
| CA-0010-04 | Cumplido | Integración (DOCX con etiquetas y secciones en el orden del formato, datos del curso y texto fijo); E2E (descarga)                                                                                       |
| CA-0010-05 | Cumplido | Integración: tras borrar el formato, el taller conserva su copia y el DOCX es idéntico                                                                                                                   |
| CA-0010-06 | Cumplido | Unit: no-DOCX, `.docm` (macros), entidades XML (`<!DOCTYPE`) y más de 5 MB se rechazan sin procesarse                                                                                                    |
| CA-0010-07 | Cumplido | Integración: formatos de otro docente u otro espacio no se ven ni se usan (`NOT_FOUND`)                                                                                                                  |
| CA-0010-08 | Cumplido | Integración (el predeterminado del docente gana sobre el del colegio); E2E (preseleccionado en el formulario)                                                                                            |
| CA-0010-09 | Cumplido | Integración: el docente del colegio usa el institucional pero no lo edita ni lo borra; un docente independiente no crea institucionales                                                                  |
| CA-0010-10 | Cumplido | Integración: logo en DOCX (`word/media`) y PDF (`/Image`); SVG y GIF rechazados; un docente sin rol de administrador no lo sube. E2E (subida y vista previa)                                             |

**Prueba con Groq (`qwen/qwen3.8-27b`):** el análisis de un formato típico (7 campos, 4 secciones) salió válido al primer intento en 1,4 s y 1.167 tokens, con todos los orígenes y tipos correctos ("Fecha de entrega" y "Guía N°" en blanco, "Autoevaluación" fija). Un taller con 3 secciones del formato (2 de actividades y 1 de texto) salió válido al primer intento en 2,6 s y 2.060 tokens.

**Decisiones de implementación:**

- El módulo nuevo es `modules/formats` (formatos y logo), no `modules/documents`: `resources` necesita los formatos para generar y `documents` necesita `resources` para exportar; así no hay ciclos.
- La detección es heurística y funciona sin IA; la IA solo afina el origen de los campos y el tipo y propósito de las secciones. Si los títulos van numerados, solo los numerados son secciones (los demás son el nombre de la guía o subtítulos).
- El nombre del colegio va arriba, junto al logo, cuando el formato no tiene un campo de institución.
- En el PDF, una actividad no se parte entre páginas.
- Los prompts nuevos son `format_analysis.v1` y `workshop.v2` (este último solo para formatos propios; las estructuras estándar siguen en `workshop.v1`).

**Pendiente:** probar el extractor con los formatos reales que el product owner pedirá a un cliente, y ajustar la heurística con ellos (los de prueba están en `apps/web/tests/support/docx-formats.ts`).
