---
description: Crea una nueva spec en estado Borrador a partir de una idea
argument-hint: <descripción>
---

Crea una spec nueva para: $ARGUMENTS

1. Lee `AGENTS.md`, `docs/plan-maestro.md` y el índice `docs/specs/README.md`.
2. Asigna el siguiente número libre (SPEC-NNNN) y crea `docs/specs/SPEC-NNNN-<titulo-kebab>.md` desde `docs/specs/_template.md`, actuando como el agente `product`.
3. Identifica el módulo responsable y la fase del roadmap. Si la spec implica una decisión arquitectónica, anótalo y propón el ADR.
4. Escribe criterios de aceptación verificables (CA-NNNN-XX, Dado/Cuando/Entonces) y las preguntas abiertas reales.
5. Deja el estado en **Borrador**, actualiza el índice y presenta al usuario un resumen y las preguntas abiertas. No implementes nada.
