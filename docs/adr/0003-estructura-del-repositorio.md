# ADR-0003 — Estructura del repositorio: monorepo con workspaces

| Campo              | Valor        |
| ------------------ | ------------ |
| Estado             | **Aceptado** |
| Fecha              | 2026-10-01   |
| Specs relacionadas | SPEC-0001    |

## Contexto

El plan maestro (sección 5) describe dos árboles: `educational-ai-platform/` (producto) y `ai-engine/` (servicio IA), sin decir si viven en uno o dos repositorios. El product owner pidió la opción más robusta y escalable en el tiempo.

## Decisión

**Un solo repositorio, organizado como monorepo con npm workspaces:**

```
Profe/
├── apps/
│   ├── web/              ← producto Next.js (= educational-ai-platform del plan)
│   │   ├── app/ components/ modules/ lib/ prisma/ tests/
│   │   └── package.json
│   └── ai-engine/        ← servicio FastAPI (Python, fuera de los workspaces npm)
├── packages/             ← código TS compartido (contratos con el AI Engine, config)
├── docs/  .claude/
├── docker-compose.yml    ← postgres (+ redis, qdrant, ai-engine cuando lleguen sus fases)
├── package.json          ← raíz del workspace: scripts que orquestan las apps
├── AGENTS.md  CLAUDE.md  README.md
```

- Dentro de `apps/web` se respeta la estructura del plan maestro (`app/`, `components/`, `modules/`, `lib/`, `prisma/`, `tests/`).
- Los contratos producto ↔ AI Engine se documentan en `docs/ai/contracts/` y, cuando exista el AI Engine, se publican como paquete TS en `packages/` (generados desde el OpenAPI de FastAPI), versionados en el mismo commit que el cambio.
- Gestor de paquetes: **npm** (workspaces nativos). Cada app tiene su propio `package.json`, dependencias y tests.
- CI con jobs separados por app, que corren solo si cambian sus archivos.

## Alternativas consideradas

- **Next.js en la raíz + `ai-engine/` como carpeta:** más simple hoy, pero mezcla la config de la app con la del repo y obliga a reestructurar cuando aparezcan paquetes compartidos, workers o una segunda app.
- **Dos repositorios:** los cambios de contrato quedan en dos PR desincronizados y las specs, que cruzan ambos, no tienen un hogar único.
- **Turborepo / Nx:** útiles con muchas apps; hoy agregan una herramienta más sin necesidad. Se pueden incorporar después sobre esta misma estructura, con un ADR.

## Consecuencias

- Specs, ADR y contratos viven en un solo lugar; un cambio de contrato es un solo commit.
- Cada app se construye, prueba y despliega por separado; nuevas apps o workers se agregan como carpetas nuevas en `apps/`.
- Los comandos se ejecutan desde la raíz (`npm run <script> -w apps/web`) o con scripts de conveniencia en el `package.json` raíz.
- Prohibido: importar código de una app desde otra; lo compartido va en `packages/`.
