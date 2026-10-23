# Contratos `generation-exam` v1 y `generation-item-regenerate` v2 (pregunta de examen)

| Campo   | Valor                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------ |
| Spec    | SPEC-0011                                                                                        |
| Emisor  | `apps/ai-engine` (FastAPI), `app/generation/exams.py`                                            |
| Cliente | `apps/web` → `modules/generation/engine.ts` (solo desde el servidor, en segundo plano: ADR-0008) |
| Estado  | Vigente desde 2026-10-10                                                                         |

Autenticación: `Authorization: Bearer <AI_ENGINE_TOKEN>`. Los schemas de petición tienen `extra="forbid"` en todos sus niveles (también en cada tema y en cada sección): un campo de más responde `422`. Así no hay dónde enviar nombres, correos ni datos de la institución (SPEC-0011 RN-08, CA-0011-10).

## `POST /v1/generation/exam`

```json
{
  "subject": "Matemáticas",
  "grade": "6°",
  "topics": [
    { "key": "T1", "title": "La recta numérica", "description": "Orden de enteros" },
    { "key": "T2", "title": "Suma de enteros", "description": null }
  ],
  "objectives": ["Compara números enteros usando la recta numérica."],
  "dba": [{ "code": "MEN-DBA-MAT-V2-G6-01", "statement": "…", "evidences": ["…"] }],
  "difficulty": "BASIC | INTERMEDIATE | ADVANCED",
  "notes": "Sin calculadora",
  "preferences": ["Usa ejemplos con dinero"],
  "durationMinutes": 90,
  "sections": [
    {
      "questionType": "MULTIPLE_CHOICE",
      "questionCount": 10,
      "pointsPerQuestion": 5,
      "instructions": null
    },
    { "questionType": "MATCHING", "questionCount": 1, "pointsPerQuestion": 20 },
    { "questionType": "OPEN", "questionCount": 2, "pointsPerQuestion": 15 }
  ],
  "cognitiveDistribution": { "REMEMBER": 30, "APPLY": 40, "ANALYZE": 30 }
}
```

| Campo                   | Regla                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `topics`                | 1–12. `key` es `T1`…`T12`: el modelo cita esa clave, nunca un id de la base                                                |
| `objectives`            | máximo 15                                                                                                                  |
| `sections`              | 2–5, en el orden del examen                                                                                                |
| `questionType`          | `MULTIPLE_CHOICE` · `TRUE_FALSE` · `SHORT_ANSWER` · `MATCHING` · `OPEN`                                                    |
| `questionCount`         | por sección: hasta 20 (selección múltiple, V/F, respuesta corta), 2 bloques de emparejamiento, 5 abiertas; en total, 10–40 |
| `pointsPerQuestion`     | positivo, máximo un decimal                                                                                                |
| `durationMinutes`       | 30–240                                                                                                                     |
| `cognitiveDistribution` | porcentajes que suman 100; no más niveles que preguntas                                                                    |
| —                       | no puede haber más temas que preguntas                                                                                     |

**Generación por secciones (RN-10).** El motor hace una llamada al modelo por sección. Antes de llamar, reparte:

- **los niveles cognitivos** del examen completo (método del mayor residuo) en orden de exigencia, de la primera sección a la última;
- **los temas** en rueda sobre las posiciones de las preguntas. Así cada tema queda obligatorio en alguna sección.

Cada sección se valida y se repara por su cuenta (hasta 3 intentos). También recibe los enunciados de las secciones anteriores, para no repetirlos. La distribución cognitiva se controla acumulada, de modo que el examen completo queda con ±1 pregunta por nivel.

**Validación de cada pregunta:**

- tipo de la sección;
- `topic` dentro de las claves enviadas (RN-07);
- solo DBA del contexto, y al menos uno si hay DBA;
- selección múltiple, V/F y respuesta corta: reglas del quiz;
- emparejamiento: 4–8 pares, sin textos repetidos en ninguna columna y como máximo 2 distractores (RN-04);
- abierta: respuesta esperada y 1–4 criterios cuyos puntos suman `pointsPerQuestion` (RN-05).

Respuesta `200`:

```json
{
  "exam": {
    "sections": [
      {
        "questionType": "OPEN",
        "pointsPerQuestion": 15,
        "questions": [
          {
            "type": "OPEN",
            "stem": "…",
            "options": [],
            "answer": "Respuesta esperada",
            "explanation": "…",
            "pairs": [],
            "distractors": [],
            "criteria": [
              { "description": "…", "points": 10 },
              { "description": "…", "points": 5 }
            ],
            "topic": "T2",
            "cognitiveLevel": "ANALYZE",
            "dbaCodes": ["MEN-DBA-MAT-V2-G6-01"]
          }
        ]
      }
    ]
  },
  "meta": {
    "provider": "groq",
    "model": "…",
    "promptVersion": "exam.v1",
    "attempts": 5,
    "latencyMs": 21000,
    "tokens": 9000,
    "calls": [
      {
        "section": 1,
        "provider": "groq",
        "model": "…",
        "attempts": 1,
        "latencyMs": 6000,
        "tokens": 3000
      }
    ]
  }
}
```

Los totales de `meta` suman los de `calls`. La web registra una fila de `generation_logs` por cada elemento de `calls`. El título, las instrucciones generales y el título de cada sección los arma la web: no gastan tokens.

## `POST /v1/generation/exam/item`

Regenerar una pregunta del examen con la indicación del docente (CA-0011-06). Es la versión 2 de `generation-item-regenerate`, solo para exámenes. El endpoint de talleres y quices (`/v1/generation/item`, v1) no cambia.

| Campo                                                                                   | Regla                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `subject`, `grade`, `topics`, `objectives`, `dba`, `difficulty`, `notes`, `preferences` | como en el examen                                                  |
| `current`                                                                               | la pregunta actual, con la forma de la respuesta del examen        |
| `points`                                                                                | puntos de la pregunta: los criterios de una abierta deben sumarlos |
| `instruction`                                                                           | 3–300 caracteres                                                   |
| `otherItems`                                                                            | enunciados del resto del examen (máx. 40)                          |

Respuesta `200`: `{ "item": { … }, "meta": { …, "promptVersion": "exam_item.v1" } }`. La pregunta nueva:

- es del mismo tipo que la actual y cumple las reglas de su tipo;
- es distinta de la actual y no repite otra pregunta del examen.

## Errores

Los mismos de [generation-resources.v1](generation-resources.v1.md#errores-los-tres-endpoints):

- `401`: falta el token o no es válido;
- `422`: la petición es inválida o trae campos de más;
- `502`: alguna sección no logró una salida válida tras 3 intentos. El examen completo queda en `FAILED` con motivo `invalid`;
- `503`: ningún proveedor respondió.

Timeout del cliente: 280 s para el examen (por debajo del límite de 300 s de Vercel, ADR-0011), porque son varias llamadas seguidas y cada una puede esperar el cupo por minuto de Groq; 90 s para regenerar una pregunta.
