# Estado del trabajo (2026-11-20)

Bitácora para retomar el trabajo después de borrar la conversación. **Se actualiza al cerrar cada tarea**
(qué se hizo, qué quedó a medias y con qué seguir). Lo más reciente va arriba de cada sección.

## En curso

- Nada a medias. Siguiente paso: que el usuario elija el próximo trabajo (ver "Siguientes candidatos").

## Hecho

- **SPEC-0018** — "Sin conexión" compacto en el celular
  ([spec](specs/SPEC-0018-sin-conexion-compacto-en-celular.md)), implementada el 2026-11-20.
  - En el celular, en "Mis recursos", la tarjeta pasó a ser un ícono (nube) con punto de aviso junto a
    "Crear con IA"; al tocarlo abre una hoja inferior con la explicación y "Guardar en este dispositivo" /
    "No, gracias". Ya decidido, el ícono sigue sin punto y la hoja muestra "guardados N de M" y "Dejar de
    guardar". En escritorio sigue la tarjeta de siempre.
  - Código: `apps/web/components/offline/offline-panel.tsx` (`OfflineButton`, `OfflinePanel`),
    `apps/web/app/(app)/resources/page.tsx`.
  - Pruebas: `apps/web/tests/e2e/spec-0018.movil.spec.ts` (3 en verde) y CA-0018-07 en
    `spec-0013-offline.spec.ts`. Capturas: `docs/design/capturas/spec-0018/`.
- SPEC-0001 a SPEC-0014, SPEC-0016 y SPEC-0017 implementadas (detalle en `CLAUDE.md` → "Estado actual").

## Pendiente conocido

- **Prueba e2e que ya fallaba antes de SPEC-0018:** en `spec-0013-offline.spec.ts` (CA-0013-38), al descargar
  sin red la "Clave en Word" el archivo llega con nombre `download` en vez de `Clave - Quiz - … .docx`.
  Comprobado: falla igual sin los cambios de SPEC-0018. Revisar cómo el service worker / la página
  `/offline` arma el nombre del archivo (`Content-Disposition` o atributo `download`).
- SPEC-0012: recorrido guiado con el usuario.
- SPEC-0013: validación manual en un iPhone real y recorrido con docentes.
- SPEC-0014: recorrido con docentes.

## Siguientes candidatos (por priorizar)

- Planes de aula (Fase 6).
- Preguntas tipo Saber/ICFES para exámenes.
- Formatos propios para quices y exámenes.

## Notas del entorno

- En la nube no hay Docker: PostgreSQL 16 local en el puerto 5434 sirve para las e2e
  (`initdb` con usuario `profe`, bases `profe` y `profe_test`).
- El proyecto "movil" de Playwright (iPhone 13) tiene 390 × 664 px visibles, no 844.
