# SPEC-0020 — Material de referencia del docente para generar (PDF, texto, libro o página web)

| Campo                    | Valor                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Estado                   | **Borrador**                                                                         |
| Fase del roadmap         | 6 · Generation                                                                       |
| Módulo(s) responsable(s) | `modules/resources` · `modules/generation` · `ai-engine/prompts`                     |
| Agentes                  | product, backend, ai-engine, privacy, auth-security, frontend, qa                    |
| ADR relacionados         | ADR nuevo (por redactar): texto de terceros enviado a la IA y lectura de páginas web |
| Autor / Fecha            | product / 2026-11-20                                                                 |

## 1. Objetivo

Hoy, cuando la asignatura no tiene DBA en el catálogo (por ejemplo Educación Religiosa o Filosofía),
Profe avisa: "el recurso se generará con el tema y los objetivos, sin citas a referentes oficiales".
El docente quiere darle a la IA su propio material para que el taller, el quiz o el examen se apoyen en
él: un PDF o Word, un texto pegado, el libro que usa o una página web.

**Respuesta corta: sí se puede.** Lo que la IA puede usar de verdad es el **texto** que le llega. Por eso:

| Fuente              | Qué hace Profe                                                                     | Fiabilidad |
| ------------------- | ---------------------------------------------------------------------------------- | ---------- |
| PDF o Word          | Extrae el texto en el servidor (sin guardar el archivo) y lo usa como base         | Alta       |
| Texto pegado        | Lo usa tal cual                                                                    | Alta       |
| Página web (enlace) | El servidor descarga la página, saca el texto y se lo muestra al docente           | Media      |
| Nombre de un libro  | Solo como referencia en el documento ("Basado en: …"); la IA **no** tiene el libro | Baja       |

Con el nombre de un libro la IA podría inventar contenido que no está en él, así que Profe lo dice
claramente y sugiere pegar o subir las páginas que va a usar.

## 2. Alcance

**Incluye:**

- En los ajustes de taller, quiz y examen, una sección **"Material de apoyo (opcional)"**. Cuando la
  asignatura no tiene DBA, el aviso amarillo invita a usarla ("Puedes darle a la IA tu material: …").
  También está disponible en las asignaturas que sí tienen DBA.
- Cuatro formas: subir un PDF o Word, pegar texto, escribir un enlace, o escribir libro y páginas.
- Vista previa del texto que se usará ("La IA leerá esto"), con su largo, para que el docente lo
  revise o recorte antes de generar.
- El material viaja al AI Engine como un campo nuevo del contrato y un anexo de prompt versionado
  (`reference.v1`): usar el material como fuente principal, no copiar textual largo, no inventar datos
  que contradigan el material.
- El documento generado dice "Material de apoyo: <nombre del archivo / título de la página / libro>".

**No incluye (explícitamente):**

- Guardar los archivos subidos (solo el texto extraído, con límite).
- Leer PDF escaneados (imágenes) con OCR: se avisa "no encontramos texto en este PDF".
- Biblioteca de materiales reutilizable entre recursos (posible mejora después).
- Buscar el libro en internet o en tiendas.

## 3. Actores y permisos

| Actor   | Puede                                                 | No puede                                      |
| ------- | ----------------------------------------------------- | --------------------------------------------- |
| Docente | Adjuntar material a sus recursos y ver el que adjuntó | Ver el material de recursos de otros docentes |

## 4. Reglas de negocio

- **RN-01:** Límite de texto que se envía a la IA: ~12 000 caracteres por recurso (recorte por páginas
  o selección del docente). Archivo de hasta 10 MB y 60 páginas; el tipo se detecta por los bytes.
- **RN-02:** El archivo se procesa en memoria y se descarta; se guarda solo el texto usado, junto al
  contexto del recurso, para poder regenerar un ítem con la misma base.
- **RN-03:** Enlaces: solo `https`, solo direcciones públicas (nada de redes internas), 5 s y 2 MB como
  máximo, sin seguir más de 3 redirecciones; solo HTML o PDF.
- **RN-04:** Antes de generar, el docente marca "Tengo derecho a usar este material en mi clase".
- **RN-05:** Aviso: "No incluyas datos de estudiantes". El material no debe llevar datos personales.
- **RN-06:** El cupo no cambia: adjuntar material no gasta más recursos.
- **RN-07:** El anexo de prompt y el campo del contrato llevan versión; la generación queda en
  `generation_logs` con la versión del anexo.

## 5. Criterios de aceptación (propuestos)

- **CA-0020-01:** En una asignatura sin DBA, el aviso ofrece "Agregar material de apoyo" y abre la sección.
- **CA-0020-02:** Al subir un PDF con texto, se ve la vista previa con el número de caracteres; el taller
  generado usa ese contenido (prueba con el proveedor simulado que recibe el material).
- **CA-0020-03:** Un PDF sin texto muestra "No encontramos texto en este PDF" y no bloquea generar.
- **CA-0020-04:** Un enlace a una dirección interna (`localhost`, `10.x`, `169.254.x`) se rechaza.
- **CA-0020-05:** Con solo el nombre del libro se ve el aviso de que la IA no tiene el libro.
- **CA-0020-06:** Otro docente no puede ver el material (acceso cruzado).
- **CA-0020-07:** El Word y el PDF del recurso dicen "Material de apoyo: …".

## 6. Seguridad y privacidad

Contenido de terceros enviado a un proveedor de IA (Groq): requiere ADR (qué se envía, retención,
derechos de autor y lectura de páginas web con protección contra SSRF). Tenancy por `institutionId`;
auditoría sin copiar el contenido.

## 7. Tareas (cuando se apruebe)

- [ ] T1 — ADR: material de terceros a la IA y lectura de enlaces — architect, privacy, auth-security
- [ ] T2 — Extracción de texto de PDF y Word en el servidor (evaluar licencia de la librería) — backend
- [ ] T3 — Lectura segura de enlaces — auth-security, backend
- [ ] T4 — Contrato y anexo de prompt `reference.v1` en el AI Engine — ai-engine
- [ ] T5 — Sección "Material de apoyo" en los ajustes y vista previa — frontend
- [ ] T6 — Mención en Word/PDF — documents
- [ ] T7 — Pruebas (unidad, integración, e2e, acceso cruzado) — qa

## 8. Preguntas abiertas

1. ¿Ofrecerlo también en asignaturas con DBA? (Propuesta: sí, opcional.)
2. ¿Se incluye leer páginas web en la primera entrega o solo PDF, Word y texto pegado? (Propuesta:
   primero PDF, Word y texto; enlaces en una segunda entrega.)
3. ¿Guardar el material para reusarlo en otros recursos del mismo tema? (Propuesta: después.)
