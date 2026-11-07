# Contrato `generation-planning` v1

| Campo   | Valor                                                                |
| ------- | -------------------------------------------------------------------- |
| Spec    | SPEC-0014 (ADR-0013)                                                 |
| Emisor  | `apps/ai-engine` (FastAPI)                                           |
| Cliente | `apps/web` → `modules/generation/engine.ts` (solo desde el servidor) |
| Estado  | Vigente desde 2026-11-06                                             |

Autenticación: `Authorization: Bearer <AI_ENGINE_TOKEN>`.

## `POST /v1/generation/planning`

### Petición

```json
{
  "subject": "Matemáticas",
  "grade": "6°",
  "dba": [{ "code": "MEN-DBA-MAT-V2-G6-01", "statement": "…", "evidences": ["…"] }],
  "periods": [
    {
      "number": 1,
      "name": "Periodo 1",
      "dbaCodes": ["MEN-DBA-MAT-V2-G6-01", "MEN-DBA-MAT-V2-G6-02", "MEN-DBA-MAT-V2-G6-03"],
      "mustCover": ["MEN-DBA-MAT-V2-G6-02", "MEN-DBA-MAT-V2-G6-03"],
      "existing": [{ "title": "Números enteros", "topics": ["La recta numérica"] }]
    }
  ],
  "unit": null,
  "avoid": [],
  "unitsMin": 2,
  "unitsMax": 4,
  "topicsMin": 2,
  "topicsMax": 4
}
```

- `periods`: de 1 a 6, sin repetir número. Para el año completo van todos los periodos del curso.
- `dbaCodes` y `mustCover` de cada periodo deben estar en `dba`, y `mustCover` dentro de
  `dbaCodes` (`422` si no).
- `unit` (opcional): `{ title, description, topics[] }` para proponer temas de una unidad que ya
  existe. Exige un solo periodo; la respuesta trae una unidad con ese mismo título.
- `avoid` (opcional, hasta 120): títulos que el docente ya tiene en la pantalla de revisión, al
  pedir "otra propuesta" para una unidad. Se tratan como ya usados.
- El schema **no admite campos adicionales** (`422`): no hay dónde enviar nombres de personas.

### Respuesta `200`

```json
{
  "periods": [
    {
      "number": 1,
      "units": [
        {
          "title": "Fracciones",
          "topics": [
            {
              "title": "Fracciones equivalentes",
              "description": "Se reconocen y construyen fracciones equivalentes.",
              "dbaCodes": ["MEN-DBA-MAT-V2-G6-02"]
            }
          ]
        }
      ]
    }
  ],
  "meta": {
    "provider": "groq",
    "model": "qwen/qwen3.8-27b",
    "promptVersion": "planning.v1",
    "attempts": 1,
    "latencyMs": 3200,
    "tokens": 2100,
    "droppedCodes": 0
  }
}
```

Toda respuesta `200` ya pasó el schema y el validador pedagógico (ADR-0013 §4). `dbaCodes` de
cada tema son de 0 a 3 códigos del periodo: los ajenos se quitaron y se cuentan en `droppedCodes`.
`attempts`, `latencyMs` y `tokens` suman todas las llamadas (una por periodo).

### Errores

| Código | Cuándo                                                      | Qué hace la web                                              |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| `401`  | Token ausente o inválido                                    | Registra error de configuración; "no disponible"             |
| `422`  | Petición inválida                                           | No debería ocurrir: la web arma la petición                  |
| `502`  | Un periodo no logró salida válida tras 2 reparaciones       | "No pudimos proponer temas ahora. Puedes agregarlos a mano." |
| `503`  | Ningún proveedor de la cadena respondió (caído o en límite) | El mismo mensaje; la planeación manual sigue igual           |

Timeout del cliente: 240 s (año completo con el modelo local).
