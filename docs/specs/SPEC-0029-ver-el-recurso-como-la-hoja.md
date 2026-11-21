# SPEC-0029 — Ver el recurso como la hoja que se imprime

| Campo                    | Valor                                                                         |
| ------------------------ | ----------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                  |
| Fase del roadmap         | Transversal de usabilidad (7 · Documents)                                     |
| Módulo(s) responsable(s) | `modules/documents` · página del recurso                                      |
| Agentes                  | product, documents, frontend, qa                                              |
| ADR relacionados         | ADR-0009 (modelo intermedio de documentos) · ADR-0020 (vista de la propuesta) |
| Autor / Fecha            | product / 2026-11-21 (aprobada por el usuario: "lo demás, tu recomendación")  |

## 1. Objetivo

Al abrir un taller, lo primero era un formulario ("Título", "Propósito", "Materiales" en cajas). El
docente espera ver la hoja como saldrá en papel. Bloque 3 de
[usabilidad/proximos-pasos.md](../usabilidad/proximos-pasos.md).

## 2. Alcance

**Incluye:**

- En la página del recurso, **"Hoja" por defecto**: el documento dibujado desde el mismo modelo
  intermedio del PDF (`previewResource` + `DocPreview`), con encabezado, campos del estudiante,
  preguntas o actividades y figuras.
- Selector **Hoja | Editar** (44 px). En quiz y examen, **"Marcar las respuestas"** (encendido por
  defecto): la opción correcta se ve resaltada solo en pantalla.
- **"Editar" junto a cada pregunta o actividad** de la hoja: abre el editor en esa parte, ya en modo
  edición.
- En el celular, la misma hoja con texto de 15 px y sin scroll horizontal (las tablas se deslizan
  dentro de su caja).

**No incluye:** editar escribiendo directamente sobre la hoja; vista de la guía del docente o de la
clave (siguen en las descargas).

## 3. Reglas de negocio

- **RN-01 — Igual al PDF.** La hoja sale del mismo constructor que el PDF; un cambio en el documento
  se ve igual en pantalla y en papel.
- **RN-02 — Respuestas solo en pantalla.** `showAnswers` es una opción de la vista; las descargas
  nunca marcan la correcta en la hoja del estudiante (RN-02 de SPEC-0009).
- **RN-03 — Sin logo en la vista.** La imagen del logo no viaja al navegador; la vista muestra el
  nombre de la institución.

## 4. Criterios de aceptación

- **CA-0029-01:** Dado un quiz en borrador, al abrirlo se ve la hoja con sus preguntas y la opción
  correcta marcada; al apagar "Marcar las respuestas" deja de verse.
- **CA-0029-02:** "Editar" en la pregunta 2 de la hoja abre el editor con la pregunta 2 en edición.
- **CA-0029-03:** Las descargas no cambian: la hoja del estudiante no marca la respuesta correcta.
- **CA-0029-04:** A 360 px la hoja no tiene scroll horizontal y pasa axe.

## 5. Tareas

- [x] T1 — `itemId` y `showAnswers` en el modelo y los constructores — documents
- [x] T2 — `previewResource` y `DocPreview` con "Editar" por ítem — documents, frontend
- [x] T3 — Selector Hoja | Editar y "Marcar las respuestas" — frontend
- [x] T4 — Tests (unidad del constructor, e2e móvil + axe) — qa
