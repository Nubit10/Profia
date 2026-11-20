# ADR-0016 — Señales del docente para mejorar la IA

| Campo              | Valor      |
| ------------------ | ---------- |
| Estado             | Aceptado   |
| Fecha              | 2026-11-20 |
| Specs relacionadas | SPEC-0021  |

## Contexto

SPEC-0021 cierra el ciclo entre lo que el docente hace con un recurso y la siguiente generación. Para eso:

- el producto le manda al AI Engine señales del docente (ediciones, 👎 con comentario, indicaciones de
  regeneración) para que proponga preferencias, lo que es un **contrato nuevo**;
- el AI Engine valida la calidad de las preguntas y devuelve avisos, lo que **cambia las respuestas** de
  quiz y examen;
- los casos reales salen de la base hacia el benchmark, que vive en el repositorio.

AGENTS.md pide un ADR para cada cambio de contrato entre el producto y el AI Engine y para cada cambio en el
manejo de datos.

## Decisión

1. **Contrato nuevo `generation-preference-suggestions.v1`**
   (`POST /v1/generation/preference-suggestions`, prompt `preference_suggestions.v1.md`).
   - El producto arma las señales. El AI Engine solo resume y valida:
     - de 1 a 3 preferencias, cada una de 10 a 160 caracteres;
     - sin repetir las activas ni las descartadas;
     - marca el conflicto con una activa usando su índice.
   - El pedido usa `extra="forbid"`: no caben ids, nombres ni datos de estudiantes.
   - El producto quita correos y teléfonos de los comentarios antes de enviarlos.
   - El producto guarda la propuesta en `preference_suggestions` y no crea ninguna preferencia hasta que el
     docente acepta (teacher-in-control).
2. **Calidad de preguntas como cambio aditivo en v1.**
   - Las respuestas de quiz y examen suman `meta.qualityWarnings: string[]` y
     `meta.qualityRulesVersion`; en el examen, también cada `meta.calls[]`.
   - Un cliente que no los conoce sigue funcionando.
   - Las reglas viven en `app/generation/quality.py`, con la versión `QUALITY_RULES_VERSION`. Cambiar un
     umbral es una versión nueva, como con los prompts.
   - El pipeline distingue dos clases de errores:
     - **de estructura**, que siguen fallando después de 3 intentos;
     - **de calidad**, que van a la reparación pero no tumban la generación: si un intento quedó solo con
       errores de calidad, se usa ese intento y los errores se devuelven como avisos.
   - La posición de la correcta se corrige reordenando las opciones de forma determinista, sin llamar al
     modelo.
3. **Casos reales fuera de git hasta su revisión.**
   - `benchmark:cases` escribe en `apps/ai-engine/benchmarks/real/` (ignorada por git), ya anonimizado:
     - sin ids de docente ni de colegio;
     - sin correos ni teléfonos;
     - con un id opaco: el hash del id del recurso con una sal local.
   - Solo pasa a `benchmarks/generation-real-cases.jsonl` lo que una persona revisó.
   - Los PIAR nunca entran.

## Alternativas consideradas

- **Detectar patrones solo con reglas, sin IA.** Las reglas sirven para el disparo (cuántos recursos con
  señales), pero redactar una preferencia útil a partir de ediciones libres necesita al modelo. Se usa la IA
  solo para resumir, con un límite propio de 1 llamada al día.
- **Juez automático con IA para calidad.** Gasta cupo en cada generación. Las reglas deterministas cubren
  los defectos típicos sin costo; el juez queda para después.
- **Reparar la posición de la correcta con el modelo.** Gasta tokens en algo que se resuelve reordenando.
- **`generation-quiz.v2`.** El cambio es compatible; una versión nueva duplicaba el endpoint y el cliente.
- **Guardar los casos reales en la base o en git directamente.** Mezcla datos de producción con el
  repositorio sin revisión humana.

## Consecuencias

- Positivas:
  - la preferencia propuesta reutiliza `TeacherPreference` y sus límites (SPEC-0008 RN-07);
  - las métricas por versión de prompt suman señales implícitas;
  - los cambios de prompt se comparan contra quejas reales.
- Negativas / costos:
  - una llamada más al modelo por docente y semana;
  - una tabla nueva;
  - los avisos de calidad agregan columnas a `generation_logs`.
- Qué queda prohibido o restringido a partir de ahora:
  - enviar al AI Engine señales con datos personales o de un PIAR;
  - crear preferencias sin la acción del docente;
  - versionar en git casos reales sin revisión humana;
  - usar las señales de un docente para otro.
