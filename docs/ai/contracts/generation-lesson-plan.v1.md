# Contrato `generation-lesson-plan` v1

Plan de aula de un tema: secuencia didáctica por sesiones, evaluación y rúbrica por desempeños
(SPEC-0024, ADR-0019). Usa el mismo contexto del taller (`ResourceContext`, `extra="forbid"`: no
caben datos de estudiantes). **La IA no escribe rangos ni notas**: el producto pone los rangos con la
escala de valoración del espacio al mostrar o descargar el plan.

## `POST /v1/generation/lesson-plan`

Encabezado `Authorization: Bearer <AI_ENGINE_TOKEN>`.

| Campo               | Tipo                                                         |
| ------------------- | ------------------------------------------------------------ |
| `subject`, `grade`  | asignatura y grado, como en el taller                        |
| `topic`             | `{ title, description }`                                     |
| `objectives`        | enunciados de los objetivos (máx. 5)                         |
| `dba`               | `{ code, statement, evidences }[]` (máx. 40); puede ir vacío |
| `difficulty`        | `BASIC` · `INTERMEDIATE` · `ADVANCED`                        |
| `notes`             | indicaciones del docente, sin datos de contacto (máx. 500)   |
| `preferences`       | preferencias del docente (máx. 5)                            |
| `sessions`          | sesiones pedidas (1–6)                                       |
| `minutesPerSession` | minutos de cada sesión (30–120)                              |

Respuesta `200`:

```json
{
  "plan": {
    "title": "…",
    "purpose": "…",
    "sessions": [
      {
        "number": 1,
        "title": "…",
        "start": "…",
        "startMinutes": 10,
        "development": "…",
        "developmentMinutes": 35,
        "closure": "…",
        "closureMinutes": 10,
        "resources": ["…"],
        "dbaCodes": ["MEN-DBA-MAT-V2-G6-01"]
      }
    ],
    "evaluation": { "evidence": "…", "instruments": ["…"] },
    "rubric": [{ "criterion": "…", "superior": "…", "high": "…", "basic": "…", "low": "…" }],
    "diversity": "…"
  },
  "meta": {
    "provider": "…",
    "model": "…",
    "promptVersion": "lesson_plan.v1",
    "attempts": 1,
    "latencyMs": 900,
    "tokens": 2400
  }
}
```

Garantías (validador pedagógico, RN-02 y RN-03):

- exactamente las sesiones pedidas, numeradas de 1 en adelante;
- inicio, desarrollo y cierre de 20 a 1500 caracteres; sus minutos suman los de la sesión (±10 %);
- hasta 6 recursos por sesión; solo códigos de DBA del pedido;
- evidencias de 10 a 800 caracteres y de 1 a 4 instrumentos;
- rúbrica de 2 a 5 criterios, con 4 descriptores distintos de 10 a 300 caracteres;
- en español.

Si algo falla, el validador repara con el error concreto hasta 3 intentos.

## Errores

`401` sin token · `422` pedido inválido · `502` salida inválida tras los intentos · `503` sin proveedor.
