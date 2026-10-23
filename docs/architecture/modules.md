# Módulos de `apps/web` y sus dependencias

Cada módulo expone su API en `modules/<x>/index.ts` (servidor) y, si hace falta, en `modules/<x>/client.ts` (seguro para el navegador). ESLint impide importar archivos internos de otro módulo (SPEC-0001 RN-06). Las dependencias van en un solo sentido; no hay ciclos.

```
                 ┌──────────────┐
                 │ institutions │  onboarding, colegio, sedes, invitaciones, miembros
                 └──┬────┬───┬──┘
                    │    │   │
          ┌─────────┘    │   └──────────────┐
          ▼              ▼                  ▼
     ┌─────────┐   ┌──────────┐       ┌─────────┐
     │ courses │──▶│ tenancy  │──┐    │  audit  │
     └────┬────┘   └────┬─────┘  │    └─────────┘
          │             ▼        │         ▲
          │        ┌────────┐    │         │
          └───────▶│  auth  │────┼─────────┘
                   └────────┘    │
        (todos) ──▶ lib/ (db, errors, actions, permissions, text, rate-limit, observability)
```

| Módulo         | Responsabilidad                                                                                                                        | Depende de                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `auth`         | Registro, login con credenciales, sesiones revocables                                                                                  | `audit`                                                            |
| `audit`        | Registro de auditoría de solo inserción                                                                                                | —                                                                  |
| `tenancy`      | Contexto del espacio activo (`requireTenant`), comprobación de roles, cookie                                                           | `auth`                                                             |
| `courses`      | Asignaturas (precarga Ley 115) y "Mis cursos"                                                                                          | `tenancy`, `audit`                                                 |
| `institutions` | Espacios independientes, colegios, sedes, invitaciones, miembros                                                                       | `tenancy`, `audit`, `courses`                                      |
| `curriculum`   | Catálogo oficial global (importación, referentes por curso)                                                                            | `courses`, `tenancy`                                               |
| `generation`   | Cliente del AI Engine, sugerencias de objetivos y registro de generaciones                                                             | `planning`, `tenancy`, `audit`                                     |
| `planning`     | Periodos, unidades, temas y objetivos del curso; vínculo con DBA; copia                                                                | `curriculum`, `tenancy`, `audit`                                   |
| `formats`      | Formato propio del docente y del colegio (extracción del DOCX, detección, análisis con IA) y logo (ADR-0010)                           | `generation`, `tenancy`, `audit`                                   |
| `documents`    | Exportar recursos a DOCX y PDF: modelo intermedio, versiones A–D, renderizadores (ADR-0009); examen con hoja de respuestas (SPEC-0011) | `resources`, `formats`, `courses`, `planning`, `tenancy`, `audit`  |
| `resources`    | Talleres, quices y exámenes: blueprint, generación en segundo plano, versiones, evaluación, preferencias, biblioteca, escala de notas  | `generation`, `planning`, `courses`, `formats`, `tenancy`, `audit` |

**Por qué `tenancy` es un módulo aparte:** `courses` necesita el contexto de tenant, e `institutions` necesita a `courses` para precargar las asignaturas al crear un espacio. Si el contexto viviera en `institutions`, habría un ciclo.

**Reglas de tenancy (ADR-0004):** toda función de servicio sobre datos de un espacio recibe `ctx: TenantContext` y filtra por `ctx.institutionId`. Las relaciones entre tablas de tenant usan FK compuestas `(id, institutionId)`. Un ID de otro espacio responde "no encontrado".

## AI Engine (`apps/ai-engine`)

Servicio aparte (ADR-0001). La web lo llama solo desde el servidor (`modules/curriculum/search.ts` y `modules/generation/engine.ts`), con los contratos de `docs/ai/contracts/`. El AI Engine lee el catálogo desde los archivos del repositorio, indexa en Qdrant y devuelve **códigos**; la web completa texto y cita desde PostgreSQL. El AI Engine no escribe en la base del producto.
