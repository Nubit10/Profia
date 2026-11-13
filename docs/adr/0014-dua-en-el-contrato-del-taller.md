# ADR-0014 — DUA en el contrato del taller: campos opcionales y anexo de prompt versionado

| Campo  | Valor      |
| ------ | ---------- |
| Estado | Aceptado   |
| Fecha  | 2026-11-13 |
| Spec   | SPEC-0016  |

## Contexto

SPEC-0016 deja al docente pedir talleres con enfoque DUA. Eso cambia el contrato
`generation-workshop` v1 (pedido y respuesta) y el de regeneración de un ítem, y necesita
instrucciones nuevas para el modelo. AGENTS.md pide un ADR para todo cambio de contrato entre el
producto y el AI Engine, y que cambiar un prompt sea una versión nueva.

## Decisión

1. **Campos opcionales en v1, sin versión nueva del contrato.**
   - El pedido suma `udl: boolean`, con `false` por defecto.
   - La respuesta suma `activities[].udl` y `udlGuide`, opcionales.
   - Un cliente o un motor que no los conoce sigue funcionando: sin `udl`, el resultado es el de
     siempre.
2. **Anexo de prompt, no prompt nuevo.**
   - Las instrucciones de DUA viven en `prompts/udl.v1.md` y se suman al prompt del taller
     (`workshop.v1` o `workshop.v2`) o al de regenerar un ítem (`item_regenerate.v1`) solo cuando
     se pide DUA.
   - La versión registrada es la combinación, por ejemplo `workshop.v1+udl.v1`.
   - Así cada cambio del anexo es una versión nueva sin duplicar los prompts base.
3. **El validador pedagógico exige los campos de DUA** cuando se pidieron (SPEC-0016 RN-02 y
   RN-03) y los descarta cuando no se pidieron.

## Consecuencias

- Los talleres guardados antes de esta decisión siguen siendo válidos: los campos son opcionales
  también en el esquema de contenido del producto.
- La métrica de calidad por versión de prompt (`metrics:resources`) distingue los talleres con DUA.
- Si el DUA llega a quices y exámenes, se reutiliza el mismo anexo con su propia versión.

## Alternativas descartadas

- **`generation-workshop` v2:** duplicaba el endpoint y el cliente para un cambio compatible.
- **Prompts `workshop.v3` y `workshop.v4` con DUA:** duplicaban el texto de los prompts base; cada
  cambio del DUA tocaba dos archivos.
