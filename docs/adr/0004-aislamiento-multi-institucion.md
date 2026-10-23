# ADR-0004 — Aislamiento multi-institución (tenancy)

| Campo              | Valor                |
| ------------------ | -------------------- |
| Estado             | **Aceptado**         |
| Fecha              | 2026-10-01           |
| Specs relacionadas | SPEC-0002, SPEC-0003 |

## Contexto

El criterio global #3 del plan maestro exige que **no exista acceso cruzado entre instituciones**. A partir de la Fase 2 casi todos los datos (grupos, asignaturas, planificación, recursos, evaluaciones) pertenecen a una institución, y un mismo docente puede trabajar en varias (algo común en Colombia). El aislamiento debe resistir errores de programación, no solo usuarios malintencionados.

## Decisión

Aislamiento **en la aplicación, reforzado por la base de datos**, en tres capas:

1. **Contexto de tenant obligatorio.** Toda operación sobre datos de una institución recibe un `TenantContext` (`userId`, `institutionId`, `membershipId`, `roles`) construido en el servidor por `requireTenant()`:
   - la institución activa viene de una cookie, pero **siempre** se valida contra una membresía activa del usuario en la base;
   - las funciones de servicio de cada módulo reciben `ctx` como primer parámetro y filtran siempre por `ctx.institutionId`;
   - el cliente nunca envía `institutionId` como dato de confianza.
2. **Integridad en la base.** Cada tabla de tenant lleva `institutionId` (indexado). Las relaciones entre tablas de tenant usan **claves foráneas compuestas** `(id, institutionId)`. Así, una asignación no puede apuntar a un grupo de otra institución aunque el código tenga un error.
3. **Tests obligatorios.** Toda spec con datos de tenant incluye al menos un test de acceso cruzado negativo: un usuario de la institución A intenta leer o modificar datos de B y recibe "no encontrado".

Respuesta ante acceso a un recurso de otra institución: **404**, no 403, para no revelar que existe.

## Alternativas consideradas

- **Row-Level Security (RLS) de PostgreSQL:** la protección más fuerte, pero exige fijar variables de sesión por request (`SET app.institution_id`) en cada transacción con el adaptador de Prisma, y complica migraciones y tests. Se reevalúa en la Fase 11 (uso institucional), sobre esta misma estructura.
- **Una base o un schema por institución:** aislamiento físico, pero las migraciones, los backups y la biblioteca compartida (Fase 11) se vuelven mucho más costosos. Excesivo para el MVP.
- **Extensión de Prisma que inyecta `institutionId` automáticamente:** cómoda, pero oculta el filtro, y los errores (por ejemplo en `$queryRaw`) pasan desapercibidos. Se prefiere el filtro explícito más las FK compuestas.

## Consecuencias

- Positivas: aislamiento verificable en el código, en el esquema y en los tests; soporta docentes en varias instituciones.
- Negativas: más columnas y FK compuestas en el esquema; cada servicio debe recibir `ctx`.
- Prohibido: consultar tablas de tenant sin `institutionId` en el `where`; aceptar `institutionId` del cliente sin validarlo contra la membresía; `$queryRaw` sobre tablas de tenant sin revisión del agente `auth-security`.
