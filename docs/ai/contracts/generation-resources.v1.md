# Contratos `generation-quiz` v1, `generation-workshop` v1 y `generation-item-regenerate` v1

| Campo   | Valor                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------ |
| Spec    | SPEC-0008                                                                                        |
| Emisor  | `apps/ai-engine` (FastAPI)                                                                       |
| Cliente | `apps/web` → `modules/generation/engine.ts` (solo desde el servidor, en segundo plano: ADR-0008) |
| Estado  | Vigente desde 2026-10-01                                                                         |

Autenticación: `Authorization: Bearer <AI_ENGINE_TOKEN>`. Todos los schemas de petición tienen `extra="forbid"`: un campo de más responde `422`, así no hay dónde enviar nombres, correos ni datos de la institución (SPEC-0008 RN-02).

## Contexto común

```json
{
  "subject": "Matemáticas",
  "grade": "6°",
  "topic": { "title": "La recta numérica", "description": "Orden de enteros" },
  "objectives": ["Compara números enteros usando la recta numérica."],
  "dba": [{ "code": "MEN-DBA-MAT-V2-G6-01", "statement": "…", "evidences": ["…"] }],
  "difficulty": "BASIC | INTERMEDIATE | ADVANCED",
  "notes": "Trabajarán en parejas",
  "preferences": ["Usa ejemplos con dinero"]
}
```

- `objectives`: máximo 5. `dba`: los vinculados a los objetivos elegidos; si no hay, los del grado. Puede ir vacío (asignaturas sin catálogo): entonces los ítems no citan DBA.
- `notes` y `preferences` son texto del docente; la web quita correos y teléfonos antes de enviarlos. Viajan dentro del bloque de datos del prompt, nunca como instrucciones.

## `POST /v1/generation/quiz`

Petición: contexto común más

| Campo                   | Tipo                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| `durationMinutes`       | 15–180                                                                  |
| `itemCount`             | 3–15 preguntas                                                          |
| `questionTypes`         | subconjunto no vacío de `MULTIPLE_CHOICE`, `TRUE_FALSE`, `SHORT_ANSWER` |
| `cognitiveDistribution` | `{ "REMEMBER": 40, "APPLY": 60 }`: porcentajes por nivel; suman 100     |

Respuesta `200`:

```json
{
  "quiz": {
    "title": "…",
    "instructions": "…",
    "questions": [
      {
        "type": "MULTIPLE_CHOICE",
        "stem": "…",
        "options": ["…", "…", "…", "…"],
        "answer": "texto exacto de la opción correcta",
        "explanation": "…",
        "cognitiveLevel": "APPLY",
        "dbaCodes": ["MEN-DBA-MAT-V2-G6-01"]
      }
    ]
  },
  "meta": {
    "provider": "groq",
    "model": "qwen/qwen3.8-27b",
    "promptVersion": "quiz.v1",
    "attempts": 1,
    "latencyMs": 2400,
    "tokens": 2300
  }
}
```

Garantías del validador (RN-03, RN-04): cantidad exacta; solo tipos permitidos; selección múltiple con 3–5 opciones sin repetir, una sola correcta y sin "todas/ninguna de las anteriores"; verdadero/falso con `options = ["Verdadero", "Falso"]`; niveles según la distribución (±1 por nivel, ninguno no pedido); solo DBA del contexto y al menos uno si hay; sin preguntas repetidas; en español.

## `POST /v1/generation/workshop`

Petición: contexto común más `durationMinutes` (15–180), `itemCount` (2–8 actividades), `cognitiveDistribution` y `structure`:

| `structure`                            | Momentos                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `START_DEVELOPMENT_CLOSE`              | Inicio · Desarrollo · Cierre                                                       |
| `EXPLORE_PRACTICE_APPLY`               | Exploración · Práctica · Aplicación                                                |
| `EXPERIENCE_FOUNDATION_EXERCISE_APPLY` | Vivencia · Fundamentación · Ejercitación · Aplicación                              |
| `PROBLEM_SITUATION`                    | Planteamiento del problema · Investigación · Propuesta de solución · Socialización |

`itemCount` debe ser al menos el número de momentos (`422` si no).

Respuesta `200`: `{ "workshop": { "title", "purpose", "studentInstructions", "materials": [], "moments": [{ "name", "activities": [{ "title", "instructions", "durationMinutes", "expectedOutcome", "cognitiveLevel", "dbaCodes" }] }], "teacherGuidance": [] }, "meta": { … , "promptVersion": "workshop.v1" } }`.

Garantías: momentos exactos y en orden (con la ortografía de la tabla), cada uno con al menos una actividad; total de actividades exacto; duración total entre el 50 % y el 110 % de `durationMinutes`; niveles según la distribución; solo DBA del contexto; orientaciones para el docente presentes.

## `POST /v1/generation/item`

Regenera una pregunta o una actividad con la indicación del docente (CA-0008-07). Petición: contexto común más

| Campo             | Tipo                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| `kind`            | `QUIZ_QUESTION` · `WORKSHOP_ACTIVITY`                                    |
| `current`         | la pregunta o actividad actual (mismo formato de la respuesta, sin `id`) |
| `instruction`     | 3–300 caracteres                                                         |
| `durationMinutes` | duración del recurso                                                     |
| `questionTypes`   | tipos permitidos (obligatorio para preguntas)                            |
| `moment`          | momento de la actividad (talleres)                                       |
| `otherItems`      | enunciados o títulos del resto del recurso, para no repetirlos (máx. 20) |

Respuesta `200`: `{ "item": { … }, "meta": { … , "promptVersion": "item_regenerate.v1" } }`. El ítem nuevo cumple las mismas reglas que en la generación completa, es distinto del actual y no repite otro ítem.

## Errores (los tres endpoints)

| Código | Cuándo                                    | Qué hace la web                                                |
| ------ | ----------------------------------------- | -------------------------------------------------------------- |
| `401`  | Token ausente o inválido                  | Registra error de configuración; recurso `FAILED`              |
| `422`  | Petición inválida (incluye campos de más) | Registra `ai_engine.contract_mismatch`; recurso `FAILED`       |
| `502`  | Salida inválida tras 2 reparaciones       | `FAILED` con motivo `invalid` ("No pudimos generar…")          |
| `503`  | Ningún proveedor de la cadena respondió   | `FAILED` con motivo `unavailable` ("La IA no está disponible") |

Tiempos: con el plan gratuito de Groq el AI Engine espera hasta 60 s a que se libere el cupo por minuto antes de pasar al siguiente modelo (los recursos corren en segundo plano). Timeout del cliente: 240 s para quiz y taller, 90 s para regenerar un ítem.
