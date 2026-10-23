# SPEC-0001 — Foundation: base técnica del producto

| Campo                    | Valor                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Estado                   | **Implementada** (2026-10-01) — CA-0001-08 se confirma en la primera corrida de CI                               |
| Fase del roadmap         | 1 · Foundation                                                                                                   |
| Módulo(s) responsable(s) | raíz del monorepo, `apps/web` (`lib/db`, `lib/auth`, `lib/env`, `modules/auth`, `prisma/`, `tests/`), `.github/` |
| Agentes                  | architect, devops, database, auth-security, frontend, backend, qa, reviewer                                      |
| ADR relacionados         | ADR-0001, ADR-0002, ADR-0003                                                                                     |
| Autor / Fecha            | Claude, aprobada por el product owner / 2026-10-01                                                               |

## 1. Objetivo

Dejar una base técnica sobre la que se construyen las fases 2–7 sin rehacer nada: monorepo con la app Next.js en TypeScript estricto, PostgreSQL + Prisma, login con credenciales (NextAuth), estructura modular, testing y CI funcionando de punta a punta.

## 2. Alcance

**Incluye:**

- Monorepo con npm workspaces según ADR-0003; app en `apps/web`.
- Next.js (App Router) + TypeScript `strict`.
- Tailwind + shadcn/ui, React Icons, Sileo (toasts), React Hook Form + Zod (formularios), Zustand (estado de UI) instalados y usados en las pantallas de esta spec.
- PostgreSQL en Docker Compose para desarrollo; Prisma con migración inicial.
- Autenticación con **credenciales (correo + contraseña)** vía NextAuth: página de **inicio de sesión**, página de registro, cierre de sesión, sesión verificada en servidor, rutas protegidas.
- Esqueleto de carpetas `app/`, `components/`, `modules/`, `lib/`, `tests/` con API pública en `modules/auth/index.ts`.
- Validación de variables de entorno al arrancar.
- Endpoint de salud `GET /api/health` (app + conexión a DB).
- Vitest (unit/integration) y Playwright (E2E) con tests reales de este alcance.
- ESLint + Prettier + typecheck.
- GitHub Actions: lint, typecheck, unit/integration (con Postgres de servicio), build y E2E. Queda listo para cuando se conecte el repositorio remoto.
- `README.md` con cómo levantar el proyecto y la sección "Comandos" de `CLAUDE.md` completa.

**No incluye (explícitamente):**

- Instituciones, membresías, roles o tenancy (Fase 2). El usuario existe, pero aún no pertenece a ninguna institución.
- Recuperación de contraseña y verificación de correo (requieren Nodemailer; spec aparte).
- OAuth / enlace mágico.
- AI Engine, Redis, Qdrant (Fases 3 y 5). `apps/ai-engine/` queda solo como carpeta con README.
- Cloudinary, Nodemailer, FCM.
- Despliegue a producción (ADR de infraestructura aparte).
- Conexión al repositorio remoto (la hace el product owner).

## 3. Actores y permisos

| Actor               | Puede                                                      | No puede                                            |
| ------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| Visitante           | Ver la página pública, registrarse, iniciar sesión         | Entrar a `/dashboard` ni a ninguna ruta autenticada |
| Usuario autenticado | Entrar a `/dashboard`, ver su nombre/correo, cerrar sesión | Ver datos de otros usuarios                         |

## 4. Reglas de negocio

- **RN-01:** Toda ruta del área autenticada (`/dashboard/**`) exige sesión válida, verificada **en el servidor**.
- **RN-02:** Los secretos (`DATABASE_URL`, `AUTH_SECRET`) solo se leen de variables de entorno; existe `.env.example` sin valores reales y `.env*` está en `.gitignore`.
- **RN-03:** La app no arranca si falta una variable de entorno obligatoria; el error dice cuál falta, sin imprimir valores.
- **RN-04:** Las contraseñas se guardan solo como hash **argon2id**. Mínimo 8 caracteres (máximo 128).
- **RN-05:** Ningún log incluye contraseñas, tokens ni cookies de sesión.
- **RN-06:** Un módulo de `modules/` no importa archivos internos de otro módulo; se verifica con una regla de lint.
- **RN-07:** El correo se normaliza (minúsculas, sin espacios) antes de guardarse o compararse; es único.
- **RN-08:** Cerrar sesión revoca la sesión en la base de datos; un token revocado o vencido deja de ser válido aunque el navegador lo conserve.
- **RN-09:** Inicio de sesión y registro tienen límite de intentos. Login: 5 / 15 min por IP + correo, 50 / 15 min por IP y 20 / 15 min por correo (este último no depende de la IP, que el cliente puede falsear). Registro: 10 / 15 min por IP.

## 5. Entradas

- **Registro:** `name` (2–100), `email` (formato válido), `password` (8–128), `confirmPassword` (igual a `password`).
- **Inicio de sesión:** `email`, `password`.
- Validación con un único schema Zod por formulario, compartido entre cliente (React Hook Form) y servidor.
- Variables de entorno definidas en `.env.example`.

## 6. Salidas

- Tablas `User` (con `passwordHash`) y `UserSession` (sesiones revocables) creadas por la migración inicial.
- `GET /api/health` → `200 {"status":"ok","db":"ok"}`; si la DB no responde → `503 {"status":"degraded","db":"error"}`.
- Toasts con Sileo para éxito/error de registro, login y logout.

## 7. Errores y casos límite

| Caso                                        | Comportamiento esperado                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Credenciales inválidas                      | Mensaje genérico ("Correo o contraseña incorrectos"), sin revelar cuál falló        |
| Sesión vencida o revocada en ruta protegida | Redirección a inicio de sesión, conservando la URL de retorno (solo rutas internas) |
| DB caída                                    | `/api/health` responde 503; las páginas muestran un error genérico, sin stack trace |
| Falta variable de entorno                   | El proceso termina al arrancar con un mensaje que nombra la variable                |
| Registro con correo ya existente            | Error de validación claro, sin crear duplicados                                     |
| Demasiados intentos                         | Mensaje "Demasiados intentos, intenta más tarde"; no se evalúan credenciales        |
| `callbackUrl` externo                       | Se ignora y se redirige a `/dashboard` (evita open redirect)                        |

## 8. Criterios de aceptación

- **CA-0001-01:** Dado un clon limpio, cuando se siguen los pasos del README (`docker compose up -d`, instalar, migrar, `dev`), entonces la app arranca en local y `/api/health` responde 200.
- **CA-0001-02:** Dado un visitante sin sesión, cuando abre `/dashboard`, entonces es redirigido a inicio de sesión.
- **CA-0001-03:** Dado un usuario registrado, cuando inicia sesión con datos correctos, entonces llega a `/dashboard` y ve su nombre o correo.
- **CA-0001-04:** Dado un usuario autenticado, cuando cierra sesión, entonces la sesión queda revocada en el servidor y `/dashboard` vuelve a redirigir.
- **CA-0001-05:** Dado un intento con credenciales inválidas, entonces se muestra un mensaje genérico y no se crea sesión.
- **CA-0001-06:** Dado que falta `DATABASE_URL` o `AUTH_SECRET`, cuando se arranca la app, entonces falla con un mensaje que nombra la variable.
- **CA-0001-07:** Dado que la DB no está disponible, `GET /api/health` responde 503.
- **CA-0001-08:** Dado un PR, CI ejecuta lint, typecheck, tests unit/integration, build y E2E, y falla si cualquiera falla.
- **CA-0001-09:** Dado un import desde `modules/a/` a un archivo interno de `modules/b/`, entonces el lint falla.
- **CA-0001-10:** El repositorio no contiene secretos reales; existe `.env.example` y `.env*` está ignorado.
- **CA-0001-11:** Dado un visitante, cuando se registra con datos válidos, entonces el usuario queda creado con la contraseña hasheada (argon2id) y puede iniciar sesión.
- **CA-0001-12:** Dado un correo ya registrado (con cualquier combinación de mayúsculas), cuando se intenta registrar de nuevo, entonces se rechaza sin crear duplicado.
- **CA-0001-13:** Dado que se superó el límite de intentos de login, entonces se rechaza el intento sin verificar la contraseña.

## 9. Seguridad y privacidad

- Cookies de sesión `httpOnly`, `secure` en producción, `sameSite=lax` (valores por defecto de NextAuth, verificados).
- Hash argon2id; verificación con la librería (tiempo constante). Si el correo no existe se verifica contra un hash ficticio, para no revelar por tiempo de respuesta qué correos están registrados.
- Rate limiting en login y registro. En Foundation es en memoria (una instancia); detrás de una interfaz para pasar a Redis cuando llegue (Fase 5).
- La IP se toma de `x-forwarded-for`. En producción la app debe estar detrás de un proxy que sobrescriba ese encabezado; se define en el ADR de despliegue.
- Datos personales mínimos: nombre, correo.
- Sin auditoría todavía (Fase 2); los eventos de login/logout quedan centralizados en `modules/auth` para registrarlos entonces.

## 10. Notas técnicas

- NextAuth v5 (Auth.js), versión fijada exacta. El proveedor de credenciales exige estrategia JWT; para cumplir RN-08 cada JWT lleva un `sid` que referencia una fila de `UserSession`, validada en cada lectura de sesión (runtime Node).
- La protección de rutas se hace en el layout del servidor del área autenticada (`auth()`), no solo en middleware.
- Prisma 7.10 (estable) con adaptador `@prisma/adapter-pg`.

## 11. Tareas

- [x] T1 — Monorepo npm workspaces; Next.js + TS strict en `apps/web`, ESLint, Prettier, estructura de carpetas — `devops` / `frontend`
- [x] T2 — Docker Compose con PostgreSQL; `.env.example`; validación de env — `devops`
- [x] T3 — Prisma + migración inicial (`User`, `UserSession`); `lib/db` — `database`
- [x] T4 — NextAuth con credenciales, sesiones revocables, protección de rutas, rate limiting — `auth-security`
- [x] T5 — Tailwind + shadcn/ui + Sileo + RHF + Zustand; layouts público/autenticado; login, registro, dashboard mínimo — `frontend`
- [x] T6 — `/api/health` — `backend`
- [x] T7 — Regla de lint de límites entre módulos — `architect`
- [x] T8 — Vitest + Playwright con tests para CA-0001-01…13 — `qa`
- [x] T9 — GitHub Actions — `devops`
- [x] T10 — README + sección "Comandos" de CLAUDE.md — `devops`
- [x] T11 — Revisión contra spec y DoD — `reviewer`

## 12. Preguntas abiertas

_Ninguna. Resueltas el 2026-10-01: login con credenciales; monorepo (ADR-0003); Zod, ESLint + Prettier, npm; el repo remoto lo conecta el product owner._

## 13. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado                     | Evidencia                                                                                                                   |
| ---------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| CA-0001-01 | Cumplido                   | `tests/e2e/health.spec.ts`, `tests/unit/health.test.ts`; README probado en local                                            |
| CA-0001-02 | Cumplido                   | `tests/e2e/auth.spec.ts` (redirige con `callbackUrl`)                                                                       |
| CA-0001-03 | Cumplido                   | `tests/e2e/auth.spec.ts`, `tests/integration/auth-service.test.ts`                                                          |
| CA-0001-04 | Cumplido                   | E2E reutiliza la cookie previa al logout y el servidor la rechaza; integración de `revokeSession`                           |
| CA-0001-05 | Cumplido                   | E2E (mensaje genérico, sin sesión) e integración (mismo resultado para correo inexistente y clave errónea)                  |
| CA-0001-06 | Cumplido                   | `tests/unit/env.test.ts`, `tests/unit/instrumentation.test.ts`; `next start` sin `AUTH_SECRET` termina con código 1 en ~3 s |
| CA-0001-07 | Cumplido                   | `tests/unit/health.test.ts`                                                                                                 |
| CA-0001-08 | **Pendiente de verificar** | `.github/workflows/ci.yml` escrito; los mismos pasos pasan en local. Se confirma cuando el repo remoto corra el primer PR.  |
| CA-0001-09 | Cumplido                   | `tests/unit/module-boundaries.test.ts` (alias, ruta relativa, desde `app/`; y casos permitidos)                             |
| CA-0001-10 | Cumplido                   | `tests/unit/repository-secrets.test.ts`                                                                                     |
| CA-0001-11 | Cumplido                   | Integración (hash `$argon2id$`) y E2E (registro + login)                                                                    |
| CA-0001-12 | Cumplido                   | Integración (mayúsculas y registros simultáneos) y E2E                                                                      |
| CA-0001-13 | Cumplido                   | Integración: bloquea sin llamar a `verifyPassword`; rotar la IP no evita el límite por correo                               |

**Hallazgos corregidos durante la revisión:** el servidor no terminaba al faltar una variable (Next solo registraba el error); el límite por IP + correo podía evadirse rotando `x-forwarded-for`; Auth.js imprimía un stack trace en cada login fallido; los toasts tapaban el botón de cerrar sesión y capitalizaban cada palabra.

**Pendientes conocidos (no bloqueantes):** rate limiting en memoria (una instancia) hasta tener Redis; `npm audit` reporta 4 altas en el CLI de Prisma (solo desarrollo); el `matcher` de `proxy.ts` cubre `/dashboard/**` y debe ampliarse cuando haya nuevas rutas autenticadas (la protección real ya está en el layout).

**Veredicto:** Aprobado, condicionado a CA-0001-08 en la primera corrida de CI.
