# SPEC-0002 — Espacios de trabajo: docente independiente y colegios con sedes e invitaciones

| Campo                    | Valor                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Estado                   | **Implementada** (2026-10-01)                                                            |
| Fase del roadmap         | 2 · Identity                                                                             |
| Módulo(s) responsable(s) | `modules/institutions`, `modules/audit`, `lib/permissions`, `modules/auth` (integración) |
| Agentes                  | product, domain, database, auth-security, backend, frontend, privacy, qa, reviewer       |
| ADR relacionados         | ADR-0001, ADR-0004                                                                       |
| Autor / Fecha            | Claude, aprobada por el product owner / 2026-10-01                                       |

## 1. Objetivo

Que **cualquier profesor** pueda usar Profe por su cuenta sin trámites, y que **un colegio** pueda registrarse, organizarse en sedes e invitar a sus profesores. En ambos casos, los datos de un espacio son invisibles para los demás.

## 2. Alcance

**Incluye:**

- **Onboarding** tras el primer inicio de sesión, con dos caminos:
  - **"Uso Profe por mi cuenta"**: se crea al instante un espacio **independiente** ("Espacio de {nombre}"). No pide datos de institución.
  - **"Registrar mi colegio"**: formulario con los datos institucionales (sección 5). Se crea el colegio con una sede "Sede principal". Quien lo registra queda como **administrador** y puede marcar "también doy clases".
- **Sedes** (solo colegios): crear, renombrar, archivar y desarchivar.
- **Invitar profesores** (solo colegios): el administrador genera un enlace de un solo uso para un correo y lo comparte (WhatsApp, correo propio, etc.).
- **Aceptar invitación** con una cuenta del mismo correo; si no tiene cuenta, se registra y vuelve al enlace.
- **Miembros** (administradores de colegio): ver la lista, cambiar roles, desactivar y reactivar.
- **Varios espacios por usuario** (por ejemplo, su espacio independiente y uno o dos colegios), con selector en el encabezado.
- **Editar datos del colegio** (administradores).
- Roles: `ADMIN` y `TEACHER`; una membresía puede tener ambos. En un espacio independiente, el dueño tiene los dos.
- Tenancy según ADR-0004 y registro de auditoría de los eventos de identidad.

**No incluye (explícitamente):**

- Envío de invitaciones por correo (spec aparte, con Nodemailer).
- Invitaciones o sedes en espacios independientes, y convertir un espacio independiente en colegio.
- Rol de coordinador (Fase 11).
- Estudiantes (fase posterior, con revisión de privacidad).
- Pantalla de consulta de la auditoría; eliminar espacios o cuentas.

## 3. Actores y permisos

| Actor                          | Puede                                                                                    | No puede                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Usuario sin espacio            | Crear su espacio independiente, registrar un colegio, aceptar una invitación a su correo | Entrar al área de trabajo                                |
| Dueño de espacio independiente | Trabajar en su espacio (es `ADMIN` + `TEACHER`)                                          | Invitar ni crear sedes                                   |
| `TEACHER` de colegio           | Trabajar en el colegio, cambiar de espacio activo                                        | Invitar, gestionar miembros o sedes, editar el colegio   |
| `ADMIN` de colegio             | Todo lo anterior, más sedes, invitaciones, miembros y datos del colegio                  | Quitarse el rol o desactivarse si es el **último** ADMIN |
| Miembro de otro espacio        | —                                                                                        | Ver o modificar nada de este espacio (404)               |

## 4. Reglas de negocio

- **RN-01:** Todo espacio tiene siempre al menos un `ADMIN` activo.
- **RN-02:** Una membresía tiene al menos un rol. Una membresía inactiva no da acceso ni cuenta como ADMIN.
- **RN-03:** Un usuario tiene como máximo una membresía por espacio y como máximo **un** espacio independiente.
- **RN-04:** El espacio activo sale de una cookie solo si el usuario tiene membresía activa en él. Si no, se usa la primera membresía activa; si no tiene ninguna, va al onboarding.
- **RN-05:** Token de invitación de 32 bytes aleatorios; en la base solo su hash SHA-256. Vence a los 7 días, sirve una sola vez y el enlace se muestra solo al crearlo.
- **RN-06:** Solo acepta la invitación un usuario con sesión cuyo correo normalizado coincida con el invitado.
- **RN-07:** Una invitación pendiente por correo y colegio; crear otra revoca la anterior.
- **RN-08:** Datos de tenant filtrados por el `institutionId` del contexto del servidor (ADR-0004); un recurso de otro espacio responde 404.
- **RN-09:** Los permisos se leen de la base en cada request: un cambio de rol o una desactivación aplica en la siguiente request.
- **RN-10:** Auditoría de solo inserción, en la misma transacción que la acción, sin tokens, contraseñas ni contenido de formularios.
- **RN-11:** Cada sede tiene un nombre único por colegio; el colegio conserva al menos una sede activa.

## 5. Entradas

- **Espacio independiente:** ninguna (se usa el nombre del usuario).
- **Registrar colegio:**
  - Obligatorios: `name` (3–150), `sector` (`OFICIAL` · `PRIVADO`), `department`, `municipality` (texto, 2–80).
  - `daneCode`: 12 dígitos; obligatorio si el sector es `OFICIAL`, opcional si es `PRIVADO`.
  - Opcionales: `calendar` (`A` · `B`, por defecto `A`), `nit` (texto, hasta 20).
  - `alsoTeaches` (casilla).
- **Sede:** `name` (2–80).
- **Invitar:** `email`, `roles` (al menos uno de `ADMIN`, `TEACHER`; por defecto `TEACHER`).
- **Miembros:** `membershipId` + `roles`, o `membershipId` para desactivar o reactivar.
- **Cambiar espacio activo:** `institutionId`.

## 6. Salidas

- Tablas `institutions` (`type`: `INDEPENDENT` · `SCHOOL`), `campuses`, `memberships`, `invitations`, `audit_logs`.
- Auditoría: `institution.created`, `institution.updated`, `campus.created`, `campus.updated`, `campus.archived`, `campus.unarchived`, `invitation.created`, `invitation.revoked`, `invitation.accepted`, `membership.roles_changed`, `membership.deactivated`, `membership.reactivated`, `auth.login`, `auth.logout`.
- Pantallas: onboarding, aceptar invitación, Configuración del colegio (datos, sedes, miembros e invitaciones) y selector de espacio en el encabezado.

## 7. Errores y casos límite

| Caso                                                | Comportamiento esperado                                      |
| --------------------------------------------------- | ------------------------------------------------------------ |
| Invitación vencida, revocada o usada                | "Esta invitación ya no es válida"; no se crea membresía      |
| Invitación abierta con otra cuenta                  | Indica con qué correo hay que entrar; no revela nada más     |
| El invitado ya es miembro activo                    | La invitación se marca aceptada y no se duplica la membresía |
| El invitado tenía la membresía desactivada          | Se reactiva con los roles de la invitación                   |
| Visitante sin sesión abre el enlace                 | Va al login o registro y vuelve al enlace                    |
| Último ADMIN intenta quitarse el rol o desactivarse | "El colegio necesita al menos un administrador"              |
| Dos admins se desactivan a la vez                   | Bloqueo de filas en la transacción: queda al menos un ADMIN  |
| Segundo espacio independiente                       | Se reutiliza el existente                                    |
| Archivar la única sede activa                       | "El colegio necesita al menos una sede activa"               |
| Cookie hacia un espacio sin membresía               | Se ignora (RN-04)                                            |
| `TEACHER` llama a una acción de ADMIN               | "No tienes permiso para esta acción"; no se ejecuta nada     |
| Invitar o crear sedes en espacio independiente      | Se rechaza en el servidor                                    |
| ID de otro espacio                                  | 404 / "No encontrado"                                        |

## 8. Criterios de aceptación

- **CA-0002-01:** Dado un usuario sin espacio, cuando inicia sesión, entonces llega al onboarding y no puede entrar al área de trabajo.
- **CA-0002-02:** Dado el onboarding, cuando elige "por mi cuenta", entonces se crea un espacio independiente sin pedir datos, queda como `ADMIN` + `TEACHER` y entra al inicio.
- **CA-0002-03:** Dado el onboarding, cuando registra un colegio con datos válidos, entonces se crea con "Sede principal" y el usuario queda `ADMIN` (más `TEACHER` si marcó la casilla). Sin los datos obligatorios, o sin DANE siendo oficial, se rechaza.
- **CA-0002-04:** Dado un ADMIN de colegio, cuando crea una invitación, entonces ve el enlace una sola vez y en la base solo queda el hash.
- **CA-0002-05:** Dado un enlace válido y una sesión con el mismo correo, cuando acepta, entonces se crea la membresía con los roles invitados y el enlace deja de servir.
- **CA-0002-06:** Dado un enlace vencido, revocado o usado, o una sesión con otro correo, entonces no se crea membresía.
- **CA-0002-07:** Dado un usuario con varios espacios, cuando cambia el activo, entonces ve los datos del nuevo; una cookie manipulada hacia un espacio ajeno se ignora.
- **CA-0002-08:** Dado un usuario del espacio A, cuando usa IDs de B (miembro, invitación, sede, institución), entonces recibe 404 y nada cambia.
- **CA-0002-09:** Dado un `TEACHER`, o el dueño de un espacio independiente en el caso de invitaciones y sedes, cuando intenta acciones de ADMIN de colegio, entonces el servidor lo rechaza.
- **CA-0002-10:** El último ADMIN activo no puede quitarse el rol ni desactivarse, ni siquiera con desactivaciones simultáneas.
- **CA-0002-11:** Un cambio de rol o una desactivación aplica en la siguiente request, sin cerrar sesión.
- **CA-0002-12:** Los eventos de la sección 6 quedan auditados con actor, espacio, acción y entidad, sin tokens ni contraseñas. Si la acción falla, no queda registro.
- **CA-0002-13:** Sedes: crear, renombrar, archivar y desarchivar; nombres únicos y nunca cero sedes activas.

## 9. Seguridad y privacidad

- `requireTenant()` en cada página y acción del área de trabajo; FK compuestas `(id, institutionId)` (ADR-0004).
- El token de invitación se busca por su hash SHA-256 (índice único); el token en claro nunca se guarda ni se registra.
- El JWT solo identifica al usuario; roles y membresías se leen de la base.
- Rate limiting para crear invitaciones (por ADMIN) y para aceptarlas (por usuario).
- El correo del invitado solo lo ven los ADMIN de ese colegio.
- El código DANE y el NIT son datos públicos de la institución, no datos personales.

## 10. Tareas

- [x] T1 — Migración: `Institution`, `Campus`, `Membership`, `Invitation`, `AuditLog` con FK compuestas — `database`
- [x] T2 — `modules/audit` — `backend`
- [x] T3 — `lib/permissions` (comprobación de roles) y `requireTenant` / espacio activo en `modules/institutions` — `auth-security`
- [x] T4 — `modules/institutions`: onboarding, colegio, sedes, invitaciones, miembros — `backend`
- [x] T5 — Auditoría de login/logout y redirección al onboarding — `auth-security`
- [x] T6 — Pantallas: onboarding, invitación, configuración del colegio, selector de espacio — `frontend`
- [x] T7 — Tests de integración (acceso cruzado, último ADMIN concurrente, invitaciones) y E2E — `qa`
- [x] T8 — Revisión contra spec y DoD — `reviewer`

## 11. Decisiones del product owner (2026-10-01)

- Cualquier profesor puede usar Profe solo; los colegios se registran con datos institucionales, sedes e invitaciones.
- Los datos institucionales no se piden al profesor independiente.
- Sedes desde esta spec.

## 12. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado   | Evidencia                                                                                                 |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------- |
| CA-0002-01 | Cumplido | `tests/integration/institutions.test.ts` (sin contexto); E2E: login sin espacio → `/onboarding`           |
| CA-0002-02 | Cumplido | Integración (roles, idempotente, concurrente); E2E `workspaces.spec.ts`                                   |
| CA-0002-03 | Cumplido | Integración (Sede principal, roles); E2E (oficial sin DANE rechazado, registro completo)                  |
| CA-0002-04 | Cumplido | Integración (solo hash en base y auditoría); E2E (enlace mostrado una vez)                                |
| CA-0002-05 | Cumplido | Integración (incluye dos aceptaciones en paralelo); E2E (registro desde el enlace y aceptación)           |
| CA-0002-06 | Cumplido | Integración (vencida, revocada, otro correo, reutilizada); E2E (enlace usado)                             |
| CA-0002-07 | Cumplido | Integración (cookie manipulada se ignora); E2E (selector de espacio)                                      |
| CA-0002-08 | Cumplido | Integración: sedes, invitaciones y miembros de otro colegio → `NOT_FOUND`, sin cambios                    |
| CA-0002-09 | Cumplido | Integración (TEACHER y espacio independiente → `FORBIDDEN`); E2E (`/school/members` → 404 para docente)   |
| CA-0002-10 | Cumplido | Integración: último ADMIN; dos admins desactivándose a la vez → queda uno (bloqueo `FOR UPDATE`)          |
| CA-0002-11 | Cumplido | Integración (rol y desactivación en la siguiente request); E2E (docente desactivado vuelve al onboarding) |
| CA-0002-12 | Cumplido | Integración (secuencia de eventos, actor y entidad; acción fallida sin registro)                          |
| CA-0002-13 | Cumplido | Integración (únicos sin mayúsculas ni acentos, nunca cero activas); E2E (agregar sede)                    |

**Hallazgos corregidos durante la implementación:** una función que fijaba la cookie quedó expuesta como server action (se movió a un archivo interno); las casillas de Base UI no quedaban asociadas a su etiqueta para lectores de pantalla (se usa `aria-labelledby`); los E2E compartían IP y chocaban con el límite de registros (cada contexto simula su propio dispositivo).

**Pendientes conocidos (no bloqueantes):** envío de invitaciones por correo (spec aparte); convertir un espacio independiente en colegio; consulta de la auditoría.

**Veredicto:** Aprobado.
