# Contrato `format-analysis` v1 y `generation-workshop` v2

| Campo   | Valor                                                                |
| ------- | -------------------------------------------------------------------- |
| Spec    | SPEC-0010                                                            |
| Emisor  | `apps/ai-engine` (FastAPI)                                           |
| Cliente | `apps/web` → `modules/generation/engine.ts` (solo desde el servidor) |
| Estado  | Vigente desde 2026-10-01                                             |

Autenticación: `Authorization: Bearer <AI_ENGINE_TOKEN>`. Los schemas de petición tienen `extra="forbid"`.

## `POST /v1/formats/analyze`

Propone el origen de cada campo del encabezado y el tipo de cada sección de un formato de taller. **Solo recibe etiquetas y títulos**: ni los valores escritos en el formato, ni el texto de las secciones, ni nombres del docente o de la institución (SPEC-0010 RN-02; la web además los quita de las etiquetas antes de enviarlas).

Petición:

```json
{
  "headerLabels": ["ÁREA", "DOCENTE", "NOMBRE DEL ESTUDIANTE"],
  "sections": [
    { "title": "Saberes previos", "hasBody": false },
    { "title": "Autoevaluación", "hasBody": true }
  ]
}
```

`headerLabels`: máximo 16. `sections`: 1–10. `hasBody` indica si la sección trae texto en el formato (sin enviarlo): solo así puede ser fija.

Respuesta `200`:

```json
{
  "header": [{ "label": "ÁREA", "source": "SUBJECT" }],
  "sections": [
    { "title": "Saberes previos", "kind": "ACTIVITIES", "purpose": "Activar lo que ya saben" }
  ],
  "meta": {
    "provider": "groq",
    "model": "qwen/qwen3.8-27b",
    "promptVersion": "format_analysis.v1",
    "attempts": 1,
    "latencyMs": 1400,
    "tokens": 1167
  }
}
```

- `source`: `INSTITUTION`, `CAMPUS`, `TEACHER`, `SUBJECT`, `GRADE`, `GROUP`, `GRADE_GROUP`, `PERIOD`, `TOPIC`, `YEAR`, `DATE`, `TITLE`, `BLANK`.
- `kind`: `ACTIVITIES`, `TEXT`, `FIXED`.
- Garantías del validador: mismas etiquetas y títulos, en el mismo orden (la respuesta usa la ortografía de la petición); al menos una sección `ACTIVITIES`; `FIXED` solo si `hasBody`; `purpose` de 5 a 200 caracteres en español para las secciones no fijas.

## `POST /v1/generation/workshop` con `structure: "CUSTOM"` (prompt `workshop.v2`)

Igual que `generation-workshop.v1` ([generation-resources.v1](generation-resources.v1.md)), con:

- `structure: "CUSTOM"` y `customSections: [{ "title", "kind": "ACTIVITIES" | "TEXT", "purpose" }]` (máximo 10; al menos una de actividades; las fijas no se envían).
- `itemCount` al menos igual al número de secciones de actividades.
- La respuesta agrega `sectionTexts: [{ "title", "content" }]`, uno por cada sección `TEXT`, en orden y de 30 a 3000 caracteres. Las secciones `ACTIVITIES` llegan en `moments` con su título como `name`.
- `meta.promptVersion` es `workshop.v2` (con estructuras estándar sigue siendo `workshop.v1`).

## Errores

Iguales a los de `generation-resources.v1`: `401` sin token, `422` petición inválida o con campos de más, `502` salida inválida tras 2 reparaciones, `503` ningún proveedor respondió. Si el análisis falla, la web muestra la propuesta heurística y le pide al docente revisarla.
