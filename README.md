# Profe — Plataforma educativa con IA

Plataforma de gestión y producción pedagógica asistida por IA para docentes e instituciones (mercado inicial: Colombia). La IA propone; el docente decide.

- Visión, arquitectura y roadmap: [docs/plan-maestro.md](docs/plan-maestro.md)
- Reglas para trabajar en el repo: [AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md)
- Specs: [docs/specs/](docs/specs/README.md) · Decisiones: [docs/adr/](docs/adr/README.md)

## Estructura

```
apps/web/        producto Next.js (monolito modular)
apps/ai-engine/  servicio FastAPI (Fase 5, aún vacío)
packages/        código TS compartido
docs/            plan maestro, specs, ADR
```

## Requisitos

- Node.js 24+ y npm 11+
- Docker (para PostgreSQL)

## Levantar el proyecto en local

```bash
# 1. Base de datos (PostgreSQL 18 en localhost:5434, con las bases profe y profe_test)
docker compose up -d postgres

# 2. Dependencias
npm install

# 3. Variables de entorno
cp apps/web/.env.example apps/web/.env
#    Completa DATABASE_URL / TEST_DATABASE_URL (usuario y clave "profe")
#    y genera AUTH_SECRET con:  npx auth secret

# 4. Migraciones
npm run db:migrate

# 5. App en http://localhost:3000 + AI Engine en http://localhost:8100
npm run dev
```

Comprobación: `http://localhost:3000/api/health` responde `{"status":"ok","db":"ok"}`.

## Comandos (desde la raíz)

| Comando                | Qué hace                                               |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Web (:3000) y AI Engine (:8100) juntos                 |
| `npm run dev:web`      | Solo la web (la IA se mostrará "no disponible")        |
| `npm run dev:ai`       | Solo el AI Engine                                      |
| `npm run build`        | Build de producción                                    |
| `npm run lint`         | ESLint (incluye la regla de límites entre módulos)     |
| `npm run typecheck`    | Tipos de rutas + TypeScript                            |
| `npm test`             | Tests unit + integration (Vitest, base `profe_test`)   |
| `npm run test:e2e`     | E2E con Playwright (build de producción, `profe_test`) |
| `npm run format`       | Formatear con Prettier                                 |
| `npm run format:check` | Verificar formato                                      |
| `npm run db:migrate`   | Crear/aplicar migraciones en desarrollo                |
| `npm run db:up`        | Levantar PostgreSQL                                    |
| `npm run db:seed`      | Crear/restablecer el usuario de prueba (solo dev)      |

**Usuario de prueba (solo desarrollo local):** `docente@profe.test` / `Profe2026!`. Se crea con `npm run db:seed`.

La primera vez que corras E2E: `npx playwright install chromium` dentro de `apps/web`.
