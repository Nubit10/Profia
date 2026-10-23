# ADR-0002 — Stack tecnológico base

| Campo              | Valor                                                |
| ------------------ | ---------------------------------------------------- |
| Estado             | **Aceptado** (stack del plan maestro y complementos) |
| Fecha              | 2026-10-01                                           |
| Specs relacionadas | SPEC-0001                                            |

## Contexto

El plan maestro (sección 3) fija el stack. Este ADR lo registra como decisión formal y declara los complementos de tooling que el stack implica pero no nombra, para que nadie los introduzca sin justificar.

## Decisión — Stack del plan maestro

| Capa         | Tecnología                                                                         |
| ------------ | ---------------------------------------------------------------------------------- |
| Web          | Next.js (App Router) + TypeScript                                                  |
| UI           | Tailwind CSS + shadcn/ui, React Icons, Sileo (toasts)                              |
| Estado de UI | Zustand (nunca fuente de verdad)                                                   |
| Formularios  | React Hook Form                                                                    |
| Auth         | NextAuth (Auth.js)                                                                 |
| Datos        | PostgreSQL + Prisma                                                                |
| Multimedia   | Cloudinary                                                                         |
| Email / Push | Nodemailer / Firebase FCM                                                          |
| AI Engine    | FastAPI + Python; vLLM (prod), Ollama (dev); LLM open-weight elegido por benchmark |
| RAG          | Qdrant, embeddings multilingües open-source, reranker open-source                  |
| Jobs         | Redis + workers                                                                    |
| Documentos   | DOCX + PDF                                                                         |
| Tests        | Vitest (unit/integration) + Playwright (E2E)                                       |
| CI/CD        | GitHub Actions                                                                     |
| Infra        | Docker / Docker Compose                                                            |

## Complementos (Aceptado 2026-10-01)

| Herramienta            | Por qué                                                                                                                                                                                 | Alternativa descartada |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Zod**                | Schemas de validación compartidos entre formularios (React Hook Form vía `@hookform/resolvers`), API y salidas de IA. El plan exige "validar salidas con schemas" y no nombra librería. | Valibot                |
| **ESLint + Prettier**  | Lint y formato que exige la Definition of Done.                                                                                                                                         | Biome                  |
| **npm** (workspaces)   | Gestor de paquetes elegido por el product owner; soporta el monorepo de ADR-0003.                                                                                                       | pnpm                   |
| **Pydantic**           | Schemas en el AI Engine (nativo de FastAPI).                                                                                                                                            | —                      |
| **uv + Ruff + pytest** | Gestión de entorno, lint y tests del AI Engine.                                                                                                                                         | Poetry, flake8         |

## Versiones y dependencias derivadas (fijadas en SPEC-0001)

| Pieza                           | Versión / nota                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js                         | 16.3 (App Router, Turbopack, `proxy.ts` en lugar de `middleware`)                                                                                                          |
| NextAuth                        | `next-auth@5.0.0-beta.32` (Auth.js v5), versión exacta. v5 sigue en beta, pero es la línea pensada para App Router y declara compatibilidad con Next 16.                   |
| Prisma                          | 7.10 con `@prisma/adapter-pg`. El dist-tag `latest` de npm apunta a un RC de Prisma 8: no se usa hasta que sea estable.                                                    |
| Hash de contraseñas             | `argon2` (argon2id).                                                                                                                                                       |
| `server-only`                   | Recomendado por la documentación de Next: impide que código de servidor llegue al navegador.                                                                               |
| Dependencias que trae shadcn/ui | `@base-ui/react` (primitivas), `class-variance-authority`, `cn` (paquete oficial de shadcn que reemplaza a clsx + tailwind-merge), `tw-animate-css`, `shadcn`.             |
| Iconos                          | Solo React Icons. Si un componente de shadcn agrega `lucide-react`, se reemplaza el icono por uno de React Icons.                                                          |
| Vulnerabilidades conocidas      | `npm audit` reporta 4 altas en dependencias del CLI de Prisma (`deepmerge-ts`, `mysql2`). Es una herramienta de desarrollo y no llega al runtime. Revisar al subir Prisma. |

## Uso obligatorio en la web

- **Formularios:** React Hook Form + Zod (`zodResolver`). El mismo schema valida en el servidor.
- **Notificaciones al usuario:** Sileo. No se usan otras librerías de toasts.
- **Estado de UI:** Zustand. Los datos del servidor se leen del servidor; Zustand no los duplica como fuente de verdad.

## Consecuencias

- Cualquier dependencia de runtime fuera de estas tablas requiere un ADR nuevo.
- La elección concreta del LLM, del modelo de embeddings y del reranker se decide en un ADR posterior con base en el benchmark de la Fase 0.
