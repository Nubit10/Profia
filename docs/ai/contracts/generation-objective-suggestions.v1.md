# Contrato `generation-objective-suggestions` v1

| Campo   | Valor                                                                |
| ------- | -------------------------------------------------------------------- |
| Spec    | SPEC-0007                                                            |
| Emisor  | `apps/ai-engine` (FastAPI)                                           |
| Cliente | `apps/web` → `modules/generation/engine.ts` (solo desde el servidor) |
| Estado  | Vigente desde 2026-10-01                                             |

Autenticación: `Authorization: Bearer <AI_ENGINE_TOKEN>` (igual que `retrieval-curriculum.v1`).

## `POST /v1/generation/objective-suggestions`

### Petición

```json
{
  "subject": "Matemáticas",
  "grade": "6°",
  "topic": { "title": "La recta numérica", "description": "Orden de enteros" },
  "existingObjectives": ["Ubica números enteros en la recta numérica."],
  "dba": [{ "code": "MEN-DBA-MAT-V2-G6-01", "statement": "…", "evidences": ["…"] }],
  "count": 3
}
```

El schema **no admite campos adicionales** (`422` si llegan): no hay dónde enviar nombres, correos ni datos de la institución (SPEC-0007 RN-02).

### Respuesta `200`

```json
{
  "suggestions": [
    {
      "statement": "Compara números enteros usando la recta numérica.",
      "dbaCodes": ["MEN-DBA-MAT-V2-G6-01"]
    }
  ],
  "meta": {
    "provider": "groq",
    "model": "qwen/qwen3.8-27b",
    "promptVersion": "objective_suggestions.v1",
    "attempts": 1,
    "latencyMs": 1800
  }
}
```

Toda respuesta `200` ya pasó el schema y el validador pedagógico: cantidad pedida, verbo observable al inicio, español, sin repetir objetivos existentes y **solo códigos de DBA presentes en la petición**.

### Errores

| Código | Cuándo                                                      | Qué hace la web                                  |
| ------ | ----------------------------------------------------------- | ------------------------------------------------ |
| `401`  | Token ausente o inválido                                    | Registra error de configuración; "no disponible" |
| `422`  | Petición inválida (incluye campos de más)                   | No debería ocurrir: la web arma la petición      |
| `502`  | El LLM no produjo una salida válida tras 2 reparaciones     | "No pudimos generar sugerencias válidas"         |
| `503`  | Ningún proveedor de la cadena respondió (caído o en límite) | "La sugerencia con IA no está disponible"        |

Timeout del cliente: 90 s (el modelo local en CPU puede tardar ~1 minuto; Groq, pocos segundos).
