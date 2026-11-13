# Contrato `generation-piar` v1

Ajustes razonables de un periodo del PIAR (SPEC-0017). El pedido **no admite datos personales**
(`extra="forbid"`): el producto quita antes el nombre del estudiante y los datos de contacto de las
barreras, y nunca envía la edad, la valoración ni las fortalezas.

## `POST /v1/generation/piar-adjustments`

Encabezado `Authorization: Bearer <AI_ENGINE_TOKEN>`.

| Campo      | Tipo                                                                 |
| ---------- | -------------------------------------------------------------------- |
| `subject`  | asignatura (1–80)                                                    |
| `grade`    | grado, p. ej. "6°" (1–20)                                            |
| `period`   | nombre del periodo (1–40)                                            |
| `topics`   | temas del periodo (máx. 12, 200 c/u)                                 |
| `barriers` | barreras descritas por el docente (10–1500), ya sin datos personales |

Cualquier otro campo (`studentName`, `age`, `diagnosis`…) responde `422`.

Respuesta `200`:

```json
{
  "adjustments": {
    "curricular": ["…"],
    "didactic": ["…"],
    "evaluative": ["…"],
    "followUp": "…"
  },
  "meta": {
    "provider": "…",
    "model": "…",
    "promptVersion": "piar.v1",
    "attempts": 1,
    "latencyMs": 900,
    "tokens": 700
  }
}
```

Garantías:

- de 1 a 3 ajustes de cada tipo, de 10 a 300 caracteres cada uno, sin repetidos;
- `followUp` de 10 a 400 caracteres;
- en español.

Si falta algo, el validador repara hasta 3 intentos. Nunca se registra el contenido: el log lleva
solo métricas y la versión del prompt.

## Errores

`401` sin token · `422` pedido inválido · `502` salida inválida tras los intentos · `503` sin proveedor.
