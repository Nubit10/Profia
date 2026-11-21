# CLAUDE.md

Plataforma de gestión y producción pedagógica asistida por IA para docentes e instituciones (mercado inicial: Colombia). La IA trabaja dentro de una estructura pedagógica persistente (currículo → planificación → tema → recurso → evaluación → refuerzo); el docente conserva el control.

**Lee primero [AGENTS.md](AGENTS.md)** (reglas globales, no negociables). Referencia completa: [docs/plan-maestro.md](docs/plan-maestro.md).

**Bitácora: [docs/ESTADO.md](docs/ESTADO.md).** Léela al empezar (la conversación puede haberse borrado) y actualízala al cerrar cada tarea o cuando el trabajo quede a medias: qué se hizo, qué falta y con qué seguir. Se commitea junto con el cambio.

## Estado actual

- Fase del roadmap: **2 — Identity** completada (SPEC-0002, SPEC-0003). Docentes independientes y colegios con sedes e invitaciones; "Mis cursos".
- Fase 3 — Curriculum: SPEC-0004 implementada (catálogo DBA Matemáticas, Lenguaje y Transición, pendiente de revisión docente); SPEC-0005 implementada (AI Engine con búsqueda híbrida; reranker desactivado por licencias).
- Fase 4 — Planning: SPEC-0006 implementada (planeación por curso con objetivos vinculados a DBA).
- Fase 5 — AI Engine: SPEC-0007 implementada (generación estructurada; "Sugerir objetivos con IA"). Cadena de LLM: Groq gratis → Ollama local (ADR-0007, etapas de costo); clave en `apps/ai-engine/.env`.
- Fase 6 — Generation: SPEC-0008 implementada (talleres y quices con IA en segundo plano, edición con versiones, regeneración de un ítem, evaluación docente y preferencias). Faltan en la fase: planes de aula y otros tipos de recurso.
- SPEC-0011 implementada (revisada el 2026-11-13): exámenes de unidad o de periodo con varios temas, por secciones (incluye emparejamiento y abiertas con criterios), puntaje, tabla de conversión a 1,0–5,0, hoja de respuestas y versiones A–D. El AI Engine genera una sección por llamada (contrato `generation-exam.v1`); un examen gasta 2 del cupo.
- Fase 7 — Documents: SPEC-0009 implementada (Word y PDF de talleres y quices, clave y guía del docente aparte, versiones A–D del quiz).
- SPEC-0010 implementada: el docente sube su formato de taller en Word (y el colegio, uno institucional); Profe detecta encabezado y secciones, el docente los revisa y los talleres se generan y descargan con esa estructura. Logo de la institución en todos los documentos (ADR-0010).
- SPEC-0012 implementada: rediseño visual y de UX con un sistema de diseño propio (`docs/design/sistema-de-diseno.md`); menú lateral al estilo CliqCut y Duali; Inicio con "Siguiente paso"; asistente `/create`; "Mis cursos" y "Mis recursos". Capturas en `docs/design/capturas/spec-0012/`. Queda pendiente el recorrido guiado con el usuario.
- Despliegue del MVP: guía en [docs/deploy/README.md](docs/deploy/README.md) sin costo (Vercel Hobby + Supabase Free + AI Engine en un Space de Hugging Face, publicado con `scripts/publish-ai-engine-hf.ps1`; ADR-0011 propuesto). El área de trabajo declara `maxDuration = 300`; ninguna generación puede pasar de ahí.
- SPEC-0013 implementada: Profe más fácil (cuenta con sesión, "Primeros pasos", asistente más corto, DBA sugeridos, descarga en un .zip), hecho para el celular (Atrás cierra capas, hojas inferiores, 44 px), instalable, con avisos del navegador (módulo `notifications`, Web Push) y recursos sin conexión (ADR-0012). Queda la validación manual en un iPhone real y el recorrido con docentes.
- SPEC-0014 implementada: flujos asistidos por IA. La IA propone unidades y temas de un periodo, del año o de una unidad a partir de los DBA (ADR-0013, contrato `generation-planning.v1`; reparto determinista en `modules/planning/distribution.ts`), objetivos en bloque (`modules/generation/objectives-batch.ts`) y recurso con un toque (`modules/resources/quick.ts`). Ficha de DBA en todas las pantallas (`components/curriculum/dba-chip.tsx`) y recursos agrupados Periodo → Unidad → Tema (`modules/resources/grouping.ts`, `components/plan-resources.tsx`). Límite propio de 20 propuestas al día y 5 por minuto. Capturas en `docs/design/capturas/spec-0014/`. Queda el recorrido con docentes.
- SPEC-0016 implementada: talleres con enfoque DUA a elección del docente (interruptor en los ajustes; se recuerda la última elección). Cada actividad trae formas de presentar, de responder, apoyos y reto; el taller, barreras con su apoyo y autoevaluación. Anexo de prompt `udl.v1` (ADR-0014); Word y PDF incluidos.
- SPEC-0017 implementada: PIAR privado. Contenido cifrado en la aplicación (AES-256-GCM, `lib/crypto`, ADR-0015, clave `PIAR_ENCRYPTION_KEY`); solo el docente que lo creó lo ve; autorización del acudiente al crear; sin diagnósticos; la IA propone ajustes por periodo sin datos personales (`generation-piar.v1`); aviso de privacidad en cada pantalla; Word/PDF con firmas; se borra solo al cierre del año siguiente.
- SPEC-0018 implementada: en el celular, "sin conexión" en "Mis recursos" es un ícono con punto de aviso junto a "Crear con IA" que abre una hoja inferior (`OfflineButton`); en escritorio sigue la tarjeta.
- SPEC-0019 implementada: el asistente de crear va un paso por pantalla (Curso y Tema separados; examen Curso → Temas → Ajustes → Confirmar); lo elegido se ve en los pasos (`Stepper` con `values`; fila deslizable de fichas en el celular) y el enlace para volver al paso anterior va debajo de los pasos. Sin tarjeta "Curso / Tema".
- SPEC-0020 en Borrador: material de referencia del docente (PDF, Word, texto, enlace o libro) para generar, sobre todo en asignaturas sin DBA. Necesita ADR.
- SPEC-0021 implementada (ADR-0016): Profe propone preferencias a partir de lo que hace el docente (`modules/resources/suggestions.ts`, contrato `generation-preference-suggestions.v1`; el docente acepta o descarta), validador de calidad de preguntas `quality.v1` en el AI Engine (no tumba la generación; avisos en `generation_logs.qualityWarnings`) y casos reales anonimizados al benchmark (`npm run benchmark:cases -w @profe/web`, fuera de git) con métricas implícitas.
- SPEC-0022 implementada (ADR-0017): en Matemáticas el AI Engine recalcula cada respuesta numérica con un evaluador propio y seguro (`app/generation/mathcheck.py`, anexo `math_check.v1`; nunca `eval`). Cada pregunta sale verificada, corregida (solo si el cálculo coincide con una única opción) o por revisar (`answerCheck`); el editor lo muestra (`components/answer-check.tsx`) y la marca se quita al editar la pregunta (`carryAnswerChecks`).
- SPEC-0023 implementada (ADR-0018): "Estilo Saber (ICFES)" en quices y exámenes de Matemáticas y Lenguaje. Cada pregunta de selección múltiple trae situación, competencia del catálogo (`app/generation/data/saber_competencias.v1.json`, pendiente de revisión docente) y, en Matemáticas, figuras como datos que el producto dibuja (`lib/figures`: SVG propio mostrado como imagen; PNG con `@resvg/resvg-js` para el Word). Anexo de prompt `saber.v1`.
- SPEC-0024 implementada (ADR-0019): plan de aula como recurso `LESSON_PLAN` (sesiones con inicio, desarrollo y cierre, evaluación y rúbrica de 4 desempeños; contrato `generation-lesson-plan.v1`, cuesta 1 del cupo; editor `lesson-plan-editor.tsx`; Word/PDF `modules/documents/build-lesson-plan.ts`). Escala de valoración del espacio en `institutions.gradingBands` (`modules/institutions/grading-scale.ts`, nacional 1,0–5,0 por defecto; la cambia el administrador o el docente independiente en `/grading-scale`); la rúbrica la lee al verse o descargarse, nunca se copia en el plan. La IA no escribe rangos ni notas.
- Prueba de usabilidad del 2026-11-20: informe en [docs/usabilidad/2026-11-20-recorrido-docente.md](docs/usabilidad/2026-11-20-recorrido-docente.md); recorrido reproducible con `npm run ux:recorrido -w @profe/web`.
- Mejoras de usabilidad (bloques 1–8 de [docs/usabilidad/proximos-pasos.md](docs/usabilidad/proximos-pasos.md)) implementadas el 2026-11-21: SPEC-0027 ajustes rápidos con botones como propuesta (ADR-0020, anexo `adjust.v1`, tabla `resource_adjustments`, cuesta cupo), SPEC-0028 "Usar también en…" mis otros grupos sin cupo, SPEC-0029 el recurso abre como la hoja que se imprime (`previewResource` + `DocPreview`; en e2e, `openEditor(page)` para editar), SPEC-0030 "Para esta semana" en el Inicio, SPEC-0031 compartir e imprimir, SPEC-0032 primer curso con temas propuestos, SPEC-0033 barra de navegación abajo en el celular, SPEC-0034 detalles (avisos abajo, letra más grande, Borrador/Listo).
- Ajustes (`/settings`): mi cuenta, tamaño de la letra, modo de pantalla (solo visual por ahora) y tutorial; la tarjeta del menú solo tiene instalar y cerrar sesión. "Regenerar" de un ítem ahora es "Mejorar".
- **Siguiente:** volver a correr el recorrido de usabilidad, probar "Compartir" en teléfonos reales; después SPEC-0025 resultados → dificultades → refuerzo y SPEC-0026 validación con docentes (bloque 9).
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
modules/     auth · audit · tenancy · institutions · courses · curriculum · planning · generation · resources · formats · documents · notifications · piar. API pública: index.ts (servidor) y client.ts
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
npm run test:e2e:dev            # la misma suite contra next dev: detecta errores de hidratación (CA-0013-19)
npm run format                  # Prettier
npm run db:migrate              # prisma migrate dev (en apps/web)
npm run curriculum:import -w @profe/web   # carga el catálogo oficial (idempotente)
npm run curriculum:verify -w @profe/web   # verifica el catálogo contra los PDF (requiere los PDF en curriculum/sources)
npm run metrics:resources -w @profe/web   # calidad de talleres y quices por versión de prompt (SPEC-0008, SPEC-0021)
npm run benchmark:cases -w @profe/web     # casos reales anonimizados al benchmark (SPEC-0021; fuera de git)
npm run piar:key -w @profe/web           # crea PIAR_ENCRYPTION_KEY en apps/web/.env si falta (nunca la reemplaza)
docker compose up -d qdrant     # Qdrant en localhost:6333 (SPEC-0005)
# AI Engine (apps/ai-engine, Python 3.12 con uv; aquí uv se invoca como `python -m uv`):
#   uv run python -m app.cli index · uv run uvicorn app.main:app --port 8100 · uv run pytest · uv run ruff check .
#   uv run python -m app.cli benchmark-generation · benchmark-resources [--real] · benchmark-exams (Groq real; --mock sin red)
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
