# ADR-0019 — Plan de aula como tipo de recurso y escala de valoración del espacio

| Campo              | Valor      |
| ------------------ | ---------- |
| Estado             | Aceptado   |
| Fecha              | 2026-11-20 |
| Specs relacionadas | SPEC-0024  |

## Contexto

SPEC-0024 agrega el plan de aula (secuencia didáctica de un tema con rúbrica) y la escala de valoración
del colegio (SIEE, Decreto 1290). Hay que decidir:

- si el plan es un recurso más o un módulo nuevo;
- cómo es el contrato con el AI Engine;
- dónde vive la escala.

## Decisión

1. **El plan de aula es un tipo de recurso (`ResourceType.LESSON_PLAN`)**, no un módulo nuevo. Reutiliza
   todo lo que ya resuelve `modules/resources`:
   - generación en segundo plano (ADR-0008);
   - cupo, versiones, evaluación, preferencias y biblioteca;
   - documentos (ADR-0009).

   Es otro constructor del modelo de documento. Regenerar una sesión queda fuera.

2. **Contrato nuevo `generation-lesson-plan.v1`** (`POST /v1/generation/lesson-plan`, prompt
   `lesson_plan.v1`), con el mismo contexto del taller (`ResourceContext`, `extra="forbid"`) más `sessions`
   y `minutesPerSession`.
   - El validador pedagógico revisa sesiones, minutos, rúbrica y DBA, y repara (pipeline de SPEC-0007).
   - La IA no escribe rangos ni notas.
3. **Escala en el espacio (`institutions.gradingBands`, JSON validado con Zod)**, con la nacional por
   defecto.
   - Es del espacio, no de la sede ni del docente: así lo pide el SIEE del colegio. En un espacio
     independiente, el docente es el dueño.
   - Los planes no copian la escala: la muestran al verlos o descargarlos, para que un cambio del SIEE
     llegue a todo.
   - Lo escribe `modules/institutions` (dueño del espacio). Lo leen `resources` y `documents` por su API
     pública.

## Alternativas consideradas

- **Módulo `lesson-plans` aparte:** duplicaba versiones, cupo, segundo plano y biblioteca.
- **Tabla de escalas con historial:** más compleja de lo necesario; si un colegio necesita conservar la
  escala con la que se hizo cada plan, se agrega después copiándola al marcarlo listo.
- **Que la IA escriba los rangos de la rúbrica:** puede inventar una escala que no es la del colegio.

## Consecuencias

- Positivas:
  - el plan entra a "Mis recursos", al cupo y a las métricas sin código nuevo;
  - la escala sirve para la rúbrica hoy y para las notas de SPEC-0025.
- Negativas / costos:
  - cada `switch` por tipo de recurso suma un caso;
  - un cambio de escala cambia cómo se ven los planes viejos.
- Qué queda prohibido o restringido a partir de ahora:
  - pedirle a la IA rangos o notas;
  - guardar la escala en otro lugar que no sea el espacio.
