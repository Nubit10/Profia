# CLAUDE.md

Plataforma de gestión y producción pedagógica asistida por IA para docentes e instituciones (mercado inicial: Colombia). La IA trabaja dentro de una estructura pedagógica persistente (currículo → planificación → tema → recurso → evaluación → refuerzo); el docente conserva el control.

**Lee primero [AGENTS.md](AGENTS.md)** (reglas globales, no negociables). Referencia completa: [docs/plan-maestro.md](docs/plan-maestro.md).

## Estado actual

- Fase del roadmap: **2 — Identity** completada (SPEC-0002, SPEC-0003). Docentes independientes y colegios con sedes e invitaciones; "Mis cursos".
- Fase 3 — Curriculum: SPEC-0004 implementada (catálogo DBA Matemáticas, Lenguaje y Transición, pendiente de revisión docente); SPEC-0005 implementada (AI Engine con búsqueda híbrida; reranker desactivado por licencias).
- Fase 4 — Planning: SPEC-0006 implementada (planeación por curso con objetivos vinculados a DBA).
- Fase 5 — AI Engine: SPEC-0007 implementada (generación estructurada; "Sugerir objetivos con IA"). Cadena de LLM: Groq gratis → Ollama local (ADR-0007, etapas de costo); clave en `apps/ai-engine/.env`.
- Fase 6 — Generation: SPEC-0008 implementada (talleres y quices con IA en segundo plano, edición con versiones, regeneración de un ítem, evaluación docente y preferencias). Faltan en la fase: planes de aula y otros tipos de recurso.
- SPEC-0011 en implementación (pendiente `/review`): exámenes de unidad o de periodo con varios temas, por secciones (incluye emparejamiento y abiertas con criterios), puntaje, tabla de conversión a 1,0–5,0, hoja de respuestas y versiones A–D. El AI Engine genera una sección por llamada (contrato `generation-exam.v1`); un examen gasta 2 del cupo.
- Fase 7 — Documents: SPEC-0009 implementada (Word y PDF de talleres y quices, clave y guía del docente aparte, versiones A–D del quiz).
- SPEC-0010 implementada: el docente sube su formato de taller en Word (y el colegio, uno institucional); Profe detecta encabezado y secciones, el docente los revisa y los talleres se generan y descargan con esa estructura. Logo de la institución en todos los documentos (ADR-0010).
- SPEC-0012 implementada: rediseño visual y de UX con un sistema de diseño propio (`docs/design/sistema-de-diseno.md`); menú lateral al estilo CliqCut y Duali; Inicio con "Siguiente paso"; asistente `/create`; "Mis cursos" y "Mis recursos". Capturas en `docs/design/capturas/spec-0012/`. Queda pendiente el recorrido guiado con el usuario.
- Despliegue del MVP: guía en [docs/deploy/README.md](docs/deploy/README.md) sin costo (Vercel Hobby + Supabase Free + AI Engine en un Space de Hugging Face, publicado con `scripts/publish-ai-engine-hf.ps1`; ADR-0011 propuesto). El área de trabajo declara `maxDuration = 300`; ninguna generación puede pasar de ahí.
- Siguiente: planes de aula (Fase 6), preguntas tipo Saber/ICFES para exámenes, o formatos propios para quices y exámenes.
- Índice de specs y su estado: [docs/specs/README.md](docs/specs/README.md)
- Decisiones de arquitectura: [docs/adr/README.md](docs/adr/README.md)

## Arquitectura (resumen)

- **Monorepo** con npm workspaces ([ADR-0003](docs/adr/0003-estructura-del-repositorio.md)): `apps/web` (producto), `apps/ai-engine` (servicio IA), `packages/` (compartido).
- **Producto:** monolito modular Next.js 16 (App Router) + TypeScript, PostgreSQL + Prisma 7, NextAuth v5.
- **AI Engine:** servicio separado FastAPI/Python. Inferencia con vLLM (prod) / Ollama (dev), Qdrant para RAG, Redis + workers.
- El producto habla con el AI Engine solo por HTTP con contratos versionados. El dominio no conoce proveedores de IA.
- Ver [ADR-0001](docs/adr/0001-monolito-modular-y-ai-engine-separado.md) y [ADR-0002](docs/adr/0002-stack-tecnologico-base.md).

## Estructura de `apps/web`

```
app/         rutas: (public) landing · (auth) login/register · (app) área autenticada · api/
components/  UI compartida; components/ui = shadcn/ui (generado, no editar a mano sin motivo)
modules/     auth · audit · tenancy · institutions · courses · curriculum · planning · generation · resources · formats · documents. API pública: index.ts (servidor) y client.ts
             (navegador). Mapa de dependencias: docs/architecture/modules.md
lib/         db (Prisma), env, errors, actions (runAction), permissions, text, observability, rate-limit
prisma/      schema y migraciones
tests/       unit/ · integration/ (base profe_test) · e2e/ (Playwright) · support/
proxy.ts     chequeo optimista de cookie para rutas autenticadas (la verificación real es requireUser)
```

## Comandos (desde la raíz)

```bash
docker compose up -d postgres   # PostgreSQL 18 en localhost:5434 (bases profe y profe_test)
npm run dev                     # web en :3000 + AI Engine en :8100 (dev:web / dev:ai por separado)
npm run lint                    # ESLint, incluye límites entre módulos
npm run typecheck               # next typegen + tsc
npm test                        # Vitest unit + integration
npm run test:e2e                # Playwright (build de prod en :3100 contra profe_test)
npm run format                  # Prettier
npm run db:migrate              # prisma migrate dev (en apps/web)
npm run curriculum:import -w @profe/web   # carga el catálogo oficial (idempotente)
npm run curriculum:verify -w @profe/web   # verifica el catálogo contra los PDF (requiere los PDF en curriculum/sources)
npm run metrics:resources -w @profe/web   # calidad de talleres y quices por versión de prompt (SPEC-0008)
docker compose up -d qdrant     # Qdrant en localhost:6333 (SPEC-0005)
# AI Engine (apps/ai-engine, Python 3.12 con uv; aquí uv se invoca como `python -m uv`):
#   uv run python -m app.cli index · uv run uvicorn app.main:app --port 8100 · uv run pytest · uv run ruff check .
#   uv run python -m app.cli benchmark-generation · benchmark-resources · benchmark-exams (Groq real; --mock sin red)
```

Un solo test: `cd apps/web && npx vitest run tests/unit/env.test.ts` · `npx playwright test -g "CA-0001-04"`.

## Workflow con Claude Code

1. `/spec <idea>` → crea `docs/specs/SPEC-XXXX-*.md` en estado **Borrador** (agente `product`).
2. El usuario revisa y aprueba la spec (estado → **Aprobada**).
3. `/adr <decisión>` cuando la spec implique un cambio arquitectónico (agente `architect`).
4. `/implement <SPEC-XXXX>` → desglose en tareas, asignación de agentes, implementación + tests.
5. `/review <SPEC-XXXX>` → el agente `reviewer` valida contra criterios de aceptación y DoD.
6. Actualizar docs y estado de la spec (→ **Implementada**), luego commit.

Agentes disponibles en [.claude/agents/](.claude/agents/). Elegir el agente por módulo responsable, no por conveniencia.

## Convenciones

- Docs/UI en español; código en inglés.
- Next.js 16 tiene cambios grandes: antes de usar una API de Next, leer la guía en `node_modules/next/dist/docs/` (ver `apps/web/AGENTS.md`).
- Módulos: se importan solo como `@/modules/<x>` (servidor) o `@/modules/<x>/client` (navegador). Dentro del módulo, imports relativos. Lo verifica ESLint (RN-06 de SPEC-0001).
- Schemas Zod de cada módulo en `modules/<x>/schemas.ts`, expuestos por `client.ts`; el mismo schema valida el formulario (React Hook Form) y el servidor.
- Toasts con Sileo; estado de UI con Zustand; iconos con React Icons.
- UI (SPEC-0012): colores solo desde tokens de `globals.css`; un botón `variant="brand"` (degradado) por pantalla; encabezados con `PageHeader`, vacíos con `EmptyState`; textos sin jerga técnica (glosario en `docs/design/sistema-de-diseno.md`).
- Toda página protegida llama `requireUser()` (el layout no se re-renderiza en cada navegación).
- Tenancy (ADR-0004): las páginas del área de trabajo llaman `requireTenant()`; los servicios reciben `ctx: TenantContext` y filtran por `ctx.institutionId`; relaciones entre tablas de tenant con FK compuestas `(id, institutionId)`. Cada spec con datos de tenant lleva un test de acceso cruzado.
- Server actions: envolver con `runAction(name, schema, input, handler)` y lanzar `DomainError` (`lib/errors`) para errores esperados.
- Prisma 7 no regenera el cliente al migrar: después de `db:migrate`, `npx prisma generate` (el script raíz ya lo hace).
- `prisma migrate dev` falla en entornos no interactivos si la migración tiene advertencias. Alternativa: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<UTC AAAAMMDDHHMMSS>_<nombre>/migration.sql`, revisar el SQL, `npx prisma migrate deploy` y confirmar con `migrate diff --exit-code` que no queda desfase.
- Los recursos (talleres, quices) se generan en segundo plano con `after()` y estado en PostgreSQL (ADR-0008); en tests se inyecta `schedule`. Nunca se llama al AI Engine para un recurso de forma síncrona.
- Toda generación con IA se valida en el AI Engine (schema + validador pedagógico + reparación) y queda en `generation_logs` con modelo y versión de prompt; nada generado se guarda sin acción del docente. Los prompts viven versionados en `apps/ai-engine/prompts/` (cambiar uno = versión nueva).
- AI Engine: el producto lo llama solo desde el servidor (`modules/curriculum/search.ts`) con `AI_ENGINE_TOKEN`; si falla, la funcionalidad degrada sin romper la página. Contratos en `docs/ai/contracts/`. Antes de adoptar un modelo, verificar su licencia (producto comercial).
- Logs con `lib/observability/logger` (redacta campos sensibles); nunca `console.log` con datos de usuario.
- Cada criterio de aceptación tiene un test con su ID en el nombre (p. ej. `CA-0001-03`).
