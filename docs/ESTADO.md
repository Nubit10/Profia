# Estado del trabajo (2026-11-20)

Bitácora para retomar el trabajo después de borrar la conversación. **Se actualiza al cerrar cada tarea**
(qué se hizo, qué quedó a medias y con qué seguir). Lo más reciente va arriba de cada sección.

## En curso

- **SPEC-0018** — "Sin conexión" compacto en el celular
  ([spec](specs/SPEC-0018-sin-conexion-compacto-en-celular.md)). Estado: **Borrador**, esperando aprobación.
  - Pedido: en el celular, en "Mis recursos", la tarjeta "¿Guardar tus recursos en este dispositivo…?" pasa a
    ser un ícono con punto de aviso junto a "Crear con IA"; al tocarlo, una ventana (hoja inferior) con la
    explicación y "Guardar en este dispositivo" / "No, gracias". Escritorio sin cambios.
  - Código actual: `apps/web/components/offline/offline-panel.tsx` (`OfflinePanel`), usado en
    `apps/web/app/(app)/resources/page.tsx`. Pruebas: `apps/web/tests/e2e/spec-0013-offline.spec.ts`.
  - Siguiente paso: que el usuario apruebe (o responda las preguntas abiertas) → `/implement SPEC-0018`.

## Hecho (resumen; detalle en `CLAUDE.md` → "Estado actual" y en `docs/specs/README.md`)

- SPEC-0001 a SPEC-0014, SPEC-0016 y SPEC-0017 implementadas.
- Últimos commits: planeación con cada objetivo en su tarjeta; fichas DBA compactas en el celular; avatar de la IA.

## Pendiente conocido

- SPEC-0012: recorrido guiado con el usuario.
- SPEC-0013: validación manual en un iPhone real y recorrido con docentes.
- SPEC-0014: recorrido con docentes.

## Siguientes candidatos (por priorizar)

- Planes de aula (Fase 6).
- Preguntas tipo Saber/ICFES para exámenes.
- Formatos propios para quices y exámenes.
