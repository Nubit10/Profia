# SPEC-0009 — Exportar talleres y quices a Word y PDF

| Campo                    | Valor                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Estado                   | **Implementada** (2026-10-01)                                |
| Fase del roadmap         | 7 · Documents                                                |
| Módulo(s) responsable(s) | `modules/documents` (nuevo), `modules/resources` (uso)       |
| Agentes                  | product, documents, backend, frontend, privacy, qa, reviewer |
| ADR relacionados         | ADR-0009 (librerías de documentos), ADR-0004 (tenancy)       |
| Autor / Fecha            | product / 2026-10-01                                         |

## 1. Objetivo

Que el docente descargue cada taller o quiz como **Word (DOCX)**, para seguir editándolo, o como **PDF**, para imprimir, con un formato limpio y listo para el aula, y con la **clave de respuestas en un documento aparte**. Cierra el milestone MVP del plan maestro (§17): generar → revisar → **exportar** → recuperar con su trazabilidad.

## 2. Alcance

**Incluye:**

- Descargar desde la página del recurso:
  - **Quiz:** hoja del estudiante y **clave de respuestas** (respuesta correcta y justificación), en DOCX y PDF.
  - **Taller:** guía del estudiante y **guía del docente** (propósito, orientaciones, producto esperado de cada actividad, DBA), en DOCX y PDF.
- **Encabezado con contexto** (plan maestro, criterio #8): institución (y sede, si es un colegio), nombre del docente, asignatura, grado y grupo, periodo y tema. Espacios en blanco para el estudiante: nombre, curso y fecha.
- **Versiones del quiz para evitar la copia (A, B, C, D):** el docente elige cuántas (1–4). La versión A conserva el orden del docente; las demás cambian el orden de las preguntas **y** el de las opciones de selección múltiple. Cada versión tiene su propia clave de respuestas y lleva la letra en el encabezado.
- Formato imprimible: tamaño carta, márgenes de 2 cm, tipografía legible (11–12 pt), numeración de páginas, preguntas que no se parten entre páginas cuando es posible y espacio para responder según el tipo de pregunta.
- **Trazabilidad:** el pie de página indica la versión del recurso y la fecha. Cada descarga queda en el log de auditoría con el recurso, la versión y el formato.
- Se puede exportar un recurso en borrador; el documento lo indica con la marca "Borrador" para no imprimir por error algo sin revisar.

**No incluye (explícitamente):**

- Logo o escudo de la institución (necesita almacenamiento de archivos; se puede agregar después).
- Plantillas personalizables por institución (fase posterior).
- El formato propio del docente (subir su plantilla para que los talleres salgan con su encabezado y organización): es la SPEC-0010.
- Exportar exámenes, planes de aula u otros tipos (aún no existen).
- Imágenes, fórmulas matemáticas con editor de ecuaciones, o enviar por correo.

## 3. Actores y permisos

| Actor                   | Puede                                         | No puede                                      |
| ----------------------- | --------------------------------------------- | --------------------------------------------- |
| Docente dueño del curso | Descargar cualquier documento de sus recursos | Descargar recursos de otros docentes          |
| Otra institución        | —                                             | Descargar ni inferir por ID (respuesta `404`) |

## 4. Reglas de negocio

- **RN-01:** El documento se genera desde una **versión concreta** del recurso (por defecto, la actual). La misma versión produce siempre el mismo contenido.
- **RN-02:** La clave de respuestas y la guía del docente **nunca** van en el documento del estudiante.
- **RN-03:** DOCX y PDF tienen el mismo contenido y orden: salen del mismo modelo de documento intermedio.
- **RN-04:** Los documentos se generan en el servidor web, sin servicios externos ni IA. No se envía nada fuera de la plataforma.
- **RN-05:** Un recurso que no está en borrador ni listo (generando, fallido o archivado) no se puede exportar; un borrador lleva la marca "Borrador".
- **RN-07:** Las versiones B, C y D se barajan de forma **determinista** (semilla = recurso + versión del contenido + letra): descargar dos veces la versión B da el mismo orden, y su clave coincide con su hoja. Verdadero/falso conserva el orden "Verdadero, Falso". Si el quiz tiene una sola pregunta o una pregunta tiene una sola opción posible, se baraja lo que se pueda.
- **RN-06:** El nombre del archivo es legible y seguro: `Quiz - La recta numérica - 6°601.pdf`, `Quiz - La recta numérica - 6°601 - Versión B.pdf`, `Clave - Quiz - La recta numérica - 6°601 - Versión B.docx`. Sin caracteres que rompan Windows.

## 5. Entradas

`GET /courses/[courseId]/resources/[resourceId]/export?doc=student|key&format=docx|pdf[&version=N][&variant=A|B|C|D]` (route handler, sesión obligatoria). `doc=key` es la clave del quiz o la guía del docente del taller. `variant` solo aplica al quiz (por defecto `A`).

## 6. Salidas

- Archivo descargable con `Content-Type` correcto y `Content-Disposition: attachment` con el nombre de RN-06.
- Evento de auditoría `resource.exported` con `{ resourceId, version, doc, format, variant }`.

## 7. Errores y casos límite

| Caso                                                      | Comportamiento esperado                                         |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| Recurso ajeno o inexistente                               | `404`                                                           |
| Recurso generando, fallido o archivado                    | `409` con mensaje; los botones de descarga no aparecen          |
| Versión pedida que no existe                              | `404`                                                           |
| Texto muy largo, caracteres especiales (−, °, ñ, ¿, ¡, ≤) | Se muestran bien en ambos formatos (fuente con esos caracteres) |
| Espacio independiente (sin colegio)                       | El encabezado muestra "Docente independiente" en vez de sede    |
| Taller con un momento sin actividades                     | El momento se omite en la guía del estudiante                   |

## 8. Criterios de aceptación

- **CA-0009-01:** Dado un quiz, cuando el docente descarga la hoja del estudiante en PDF y en DOCX, entonces ambas tienen el encabezado del curso, los espacios para el estudiante y todas las preguntas en orden, **sin respuestas ni justificaciones**.
- **CA-0009-02:** Dado un quiz, cuando descarga la clave, entonces incluye cada pregunta con su respuesta correcta y su justificación.
- **CA-0009-03:** Dado un taller, cuando descarga la guía del estudiante, entonces tiene propósito, indicaciones, materiales y las actividades por momento, **sin orientaciones docentes ni productos esperados**; la guía del docente sí los incluye, con los DBA citados.
- **CA-0009-04:** El pie de página muestra la versión del recurso; descargar la versión 1 después de editar devuelve el contenido original.
- **CA-0009-05:** Un recurso en borrador sale con la marca "Borrador"; uno listo, sin marca.
- **CA-0009-06:** Un recurso de otro docente o institución responde `404`; uno que se está generando, `409`.
- **CA-0009-07:** Cada descarga queda en auditoría con recurso, versión, documento y formato.
- **CA-0009-08:** El PDF abre sin errores, en tamaño carta, con texto seleccionable y con los caracteres especiales del español y de matemáticas (−, °, ñ, ¿).
- **CA-0009-09:** El DOCX abre en Word y en LibreOffice y se puede editar (texto real, no imágenes).
- **CA-0009-10:** Dado un quiz, cuando el docente descarga la versión B, entonces tiene las mismas preguntas que la A en otro orden, las opciones de selección múltiple también en otro orden, "Versión B" en el encabezado, y descargarla de nuevo da exactamente el mismo orden.
- **CA-0009-11:** La clave de la versión B marca, para cada pregunta de la hoja B, la respuesta correcta con la letra que tiene en esa hoja.

## 9. Seguridad y privacidad

- **Tenancy:** el route handler usa `requireTenant()` y el servicio busca el recurso por `institutionId` y dueño; test de acceso cruzado (CA-0009-06).
- **Datos personales:** el documento lleva el nombre del docente y de la institución (es material de su propio uso); no lleva datos de estudiantes (los espacios van en blanco). Nada sale del servidor: no hay IA ni servicios externos en esta spec.
- **Inyección en documentos:** el texto del recurso se trata como texto plano (sin HTML ni campos de Word), así que no puede ejecutar nada al abrirse.
- **Auditoría:** RN de §6.

## 10. Tareas

- [x] T1 — ADR-0009: librerías `docx` y `pdfmake`, fuente embebida (ver pregunta 1) — architect
- [x] T2 — `modules/documents`: modelo de documento intermedio y su construcción desde quiz y taller (estudiante y clave/guía) — documents
- [x] T3 — Renderizadores DOCX y PDF del modelo intermedio, con encabezado, pie y marca de borrador — documents
- [x] T4 — Route handler de descarga, nombres de archivo, auditoría y errores — backend
- [x] T5 — Botones de descarga en la página del recurso (y en la biblioteca) — frontend
- [x] T6 — Tests unitarios (modelo: qué va y qué no va en cada documento), integración (acceso cruzado, versión, auditoría) y E2E (descarga) — qa
- [x] T7 — Revisión con documentos reales abiertos en Word, LibreOffice y un lector PDF — reviewer

## 11. Decisiones del product owner (2026-10-01)

1. Librerías `docx` y `pdfmake` (ADR-0009 aceptado).
2. Los documentos se generan al descargar, desde la versión pedida; la trazabilidad queda en la auditoría.
3. Versiones del quiz desde ya: cambian el orden de las preguntas y de las respuestas (RN-07).
4. Tamaño carta.
5. Encabezado con el nombre del docente, la institución, la asignatura, el grado y el grupo, el periodo y el tema.
6. El docente podrá subir su propio formato de taller y la IA lo seguirá: SPEC-0010.

## 12. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado   | Evidencia                                                                                                                        |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| CA-0009-01 | Cumplido | Unit (hoja sin respuestas, campos del estudiante, espacio para respuesta corta); integración (encabezado completo en el DOCX)    |
| CA-0009-02 | Cumplido | Unit (clave con respuesta y justificación de cada tipo de pregunta)                                                              |
| CA-0009-03 | Cumplido | Unit (guía del estudiante sin orientaciones ni productos esperados; guía del docente con ellos y con los DBA)                    |
| CA-0009-04 | Cumplido | Integración (la versión 1 sale sin la edición; pie con la versión; versión inexistente → `NOT_FOUND`)                            |
| CA-0009-05 | Cumplido | Unit (marca de agua solo en borrador); integración (DOCX con y sin "BORRADOR")                                                   |
| CA-0009-06 | Cumplido | Integración (recurso ajeno → `NOT_FOUND`, generándose → `CONFLICT`, sin auditoría); el route handler responde 404/409            |
| CA-0009-07 | Cumplido | Integración (evento `resource.exported` con versión, documento, formato y versión del quiz)                                      |
| CA-0009-08 | Cumplido | Unit (PDF carta con Roboto embebida); revisión manual con `pypdf`: texto extraíble con −, °, ñ, ¿, ≤, ≥, √, π, ½, ²              |
| CA-0009-09 | Cumplido | Unit (DOCX con texto real, carta y márgenes de 2 cm). La apertura en Word y LibreOffice queda para la prueba con los docentes    |
| CA-0009-10 | Cumplido | Unit (mismas preguntas en otro orden, opciones barajadas, verdadero/falso intacto, determinista); E2E (descarga de la versión B) |
| CA-0009-11 | Cumplido | Unit (la clave B usa las letras de la hoja B); revisión manual del PDF de la clave B                                             |

**Hallazgos corregidos durante la implementación:**

- El build de producción fallaba al ubicar las fuentes de `pdfmake` con `require.resolve` (el empaquetador lo convierte en un id numérico). Las fuentes se cargan ahora desde el sistema de archivos virtual de `pdfmake` (`build/vfs_fonts.js`), sin leer el disco; el acceso a URLs y a archivos locales queda bloqueado.
- El pie del PDF se partía en dos líneas; el número de página ocupa solo su ancho.

**Decisiones de implementación:**

- La auditoría de la descarga usa `recordAuditSafely`: si falla, se registra en el log y la descarga continúa (el docente no se queda sin su material por un error de auditoría).
- El modelo intermedio y el barajado son funciones puras (`modules/documents/build.ts`, `shuffle.ts`), probadas sin base de datos.

**Pendiente:** abrir los documentos con docentes reales en Word, LibreOffice y Google Docs para validar el formato (T7 en el piloto).
