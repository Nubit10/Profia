---
description: Revisa una implementación contra su spec y la Definition of Done
argument-hint: <SPEC-XXXX>
---

Revisa la implementación de: $ARGUMENTS

Actúa como el agente `reviewer` (`.claude/agents/reviewer.md`):

1. Tabla de criterios de aceptación: criterio · cumplido/parcial/no · test que lo cubre · evidencia (archivo:línea).
2. Reglas globales de `AGENTS.md`: hallazgos con evidencia.
3. Lint, typecheck, tests y build: resultado real.
4. Definition of Done punto por punto.
5. Veredicto: **Aprobado** o **Cambios requeridos**.
   Si es Aprobado, cambia el estado de la spec a **Implementada**, actualiza el índice y la sección "Estado actual" de `CLAUDE.md`.
