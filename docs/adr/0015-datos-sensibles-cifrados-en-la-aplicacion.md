# ADR-0015 — Datos sensibles de estudiantes cifrados en la aplicación

| Campo  | Valor      |
| ------ | ---------- |
| Estado | Aceptado   |
| Fecha  | 2026-11-13 |
| Spec   | SPEC-0017  |

## Contexto

El PIAR (SPEC-0017) es el primer dato de Profe sobre un estudiante concreto, menor de edad, con
información sensible: barreras para aprender y apoyos (Ley 1581 de 2012, arts. 5 y 7). Hasta ahora
la base solo tenía datos de docentes y de su material. El despliegue del MVP usa una base
administrada (ADR-0011), y un respaldo o un acceso de lectura a la base no debe exponer esos datos.

## Decisión

1. **Cifrado en la aplicación, por registro.**
   - Todo el contenido del PIAR se serializa como JSON y se cifra con AES-256-GCM (`node:crypto`,
     sin dependencias nuevas) antes de guardarlo.
   - Se usa un IV aleatorio de 12 bytes por escritura, y el id del PIAR y el `institutionId` van
     como datos asociados (AAD).
   - Así, un contenido copiado a otro registro o a otro espacio no se descifra.
2. **Clave en el servidor.**
   - `PIAR_ENCRYPTION_KEY`: 32 bytes en base64, solo en las variables de entorno.
   - `keyVersion` en cada fila permite rotar la clave más adelante (v1 hoy).
   - Sin la clave, la funcionalidad no se ofrece.
3. **Metadatos mínimos en claro.**
   - Quedan sin cifrar: el curso, el año lectivo, las fechas, el vencimiento y la fecha de la
     autorización.
   - El nombre del estudiante va cifrado. La lista se arma descifrando los PIAR del docente, que son
     pocos.
4. **Acceso solo del creador.**
   - Filtro por `institutionId` y `membershipId` en cada consulta.
   - FK compuestas al curso y a la membresía (ADR-0004).
5. **Vencimiento y borrado físico.**
   - `expiresAt` es el 31 de diciembre del año siguiente al año lectivo.
   - Los vencidos se borran al listar (barrido perezoso, por espacio).
   - Borrar es `DELETE` real, no un archivado.

## Consecuencias

- No se puede buscar ni filtrar por el contenido en SQL. Para el volumen de un docente es aceptable.
- Perder la clave hace ilegibles los PIAR. La guía de despliegue explica generarla una vez y
  respaldarla aparte de la base.
- Las pruebas generan una clave por corrida, como las claves VAPID (ADR-0012).
- Si otros datos de estudiantes llegan a Profe, usan este mismo mecanismo (`lib/crypto`).

## Alternativas descartadas

- **Cifrado de columna en PostgreSQL (pgcrypto):** la clave viajaría en las consultas y quedaría en
  los logs de la base.
- **Confiar solo en el cifrado en reposo del proveedor:** no protege de un acceso de lectura a la
  base ni de los respaldos exportados.
- **No guardar nada (solo descargar):** el usuario prefirió guardarlo para actualizarlo cada periodo
  (decisión 1 de SPEC-0017).
