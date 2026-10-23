---
description: Implementa una spec aprobada siguiendo el flujo SDD
argument-hint: <SPEC-XXXX>
---

Implementa la spec: $ARGUMENTS

1. Abre la spec. Si su estado no es **Aprobada**, detente y avisa.
2. Revisa los ADR relacionados y `AGENTS.md`.
3. Cambia el estado a **En implementación**.
4. Recorre la sección "Tareas" en orden. Para cada tarea, usa el agente indicado (o hazla tú siguiendo las instrucciones de `.claude/agents/<agente>.md`). Cada tarea incluye sus tests, con el ID del criterio en el nombre.
5. Marca cada tarea como hecha en la spec al terminarla.
6. Al final corre lint, typecheck, tests y build, y reporta los resultados reales.
7. No marques la spec como Implementada: eso lo hace `/review`.
