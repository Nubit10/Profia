# Contrato `generation-preference-suggestions` v1

Preferencias propuestas a partir de lo que hace el docente (SPEC-0021 Parte A, ADR-0016). El pedido
trae señales de **un solo docente** y **no admite ids ni datos personales** (`extra="forbid"`): el
producto quita antes los correos y teléfonos de los comentarios y nunca envía nada de un PIAR.

## `POST /v1/generation/preference-suggestions`

Encabezado `Authorization: Bearer <AI_ENGINE_TOKEN>`.

| Campo               | Tipo                                                             |
| ------------------- | ---------------------------------------------------------------- |
| `signals`           | 1 a 30 señales (abajo)                                           |
| `activePreferences` | preferencias activas del docente (máx. 5, 300 c/u)               |
| `declined`          | propuestas descartadas en los últimos 90 días (máx. 10, 300 c/u) |

Cada señal:

| Campo          | Tipo                                                       |
| -------------- | ---------------------------------------------------------- |
| `kind`         | `EDIT` · `ITEM_DOWN` · `REGENERATION` · `RESOURCE_COMMENT` |
| `resourceType` | `QUIZ` · `WORKSHOP` · `EXAM` · `LESSON_PLAN` (SPEC-0024)   |
| `subject`      | asignatura (1–80)                                          |
| `grade`        | grado, p. ej. "6°" (1–20)                                  |
| `before`       | texto que generó la IA (máx. 600; solo `EDIT`)             |
| `after`        | texto que dejó el docente (máx. 600; solo `EDIT`)          |
| `comment`      | comentario o indicación del docente (máx. 300)             |

Cualquier otro campo (`resourceId`, `teacherName`…) responde `422`.

Respuesta `200`:

```json
{
  "suggestions": [
    {
      "text": "Escribe enunciados cortos, de una sola oración.",
      "reason": "Acortaste 7 enunciados en 4 quices.",
      "conflictsWith": null
    }
  ],
  "meta": {
    "provider": "…",
    "model": "…",
    "promptVersion": "preference_suggestions.v1",
    "attempts": 1,
    "latencyMs": 900,
    "tokens": 700,
    "qualityWarnings": [],
    "qualityRulesVersion": null
  }
}
```

Garantías:

- de 0 a 3 propuestas; una lista vacía significa que no hay un patrón claro;
- `text` de 10 a 160 caracteres y `reason` de 10 a 200, en español;
- nada igual o contenido en una preferencia activa o descartada (se quita sin llamar al modelo);
- `conflictsWith` es `null` o el índice de una preferencia activa.

El log lleva solo métricas y la versión del prompt, nunca las señales.

## Errores

`401` sin token · `422` pedido inválido · `502` salida inválida tras los intentos · `503` sin proveedor.
