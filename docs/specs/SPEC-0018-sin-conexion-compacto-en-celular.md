# SPEC-0018 — "Sin conexión" compacto en el celular: un ícono con aviso que abre una ventana

| Campo                    | Valor                                                  |
| ------------------------ | ------------------------------------------------------ |
| Estado                   | **Implementada**                                       |
| Fase del roadmap         | Transversal (UX en el celular, continúa SPEC-0013)     |
| Módulo(s) responsable(s) | `components/offline/` · `app/(app)/resources/page.tsx` |
| Agentes                  | product, frontend, qa                                  |
| ADR relacionados         | ADR-0012 (recursos sin conexión)                       |
| Autor / Fecha            | product / 2026-11-20                                   |

## 1. Objetivo

En el celular, la tarjeta "¿Guardar tus recursos en este dispositivo para usarlos sin conexión?" ocupa casi
toda la primera pantalla de "Mis recursos" y empuja la lista hacia abajo. El docente debe ver primero sus
recursos: la pregunta se reduce a un ícono con un aviso (punto) y la explicación con las opciones pasa a una
ventana que se abre al tocarlo.

## 2. Alcance

**Incluye:**

- En el celular (ancho menor que `sm`, 640 px), en "Mis recursos", la tarjeta actual del `OfflinePanel` se
  reemplaza por un **botón de ícono** (nube con flecha, `HiOutlineCloudArrowDown`) junto a "Crear con IA" en el
  encabezado de la página.
- Mientras el docente no ha decidido, el ícono lleva un **punto de aviso** (color de alerta del sistema de
  diseño) que llama la atención sin texto.
- Al tocarlo se abre una **ventana** (`Dialog`, que en el celular ya es hoja inferior y se cierra con Atrás)
  con: título, la misma explicación de hoy y los botones **"Guardar en este dispositivo"** y **"No, gracias"**.
- Ya decidido, el ícono sigue ahí (sin punto) y la ventana muestra el estado y la acción contraria:
  - activo: "Guardados N de M" (· guardando…), "Guardar ahora" si faltan y "Dejar de guardar en este dispositivo";
  - apagado: la explicación y "Guardar en este dispositivo".
- En escritorio (≥ `sm`) no cambia nada: se mantiene la tarjeta y la línea de estado actuales.

**No incluye (explícitamente):**

- Cambios en cómo se guardan los archivos, el service worker o la sincronización (ADR-0012 sigue igual).
- Mover el ícono a otras pantallas (Inicio, recurso) ni al menú lateral.
- Cambiar el comportamiento de la app instalada (sigue guardando sin preguntar, CA-0013-41).

## 3. Actores y permisos

| Actor   | Puede                                                 | No puede                                    |
| ------- | ----------------------------------------------------- | ------------------------------------------- |
| Docente | Abrir la ventana, aceptar, rechazar, dejar de guardar | Guardar sin aceptar antes (en el navegador) |

## 4. Reglas de negocio

- **RN-01:** No se guarda nada en el dispositivo hasta que el docente toca "Guardar en este dispositivo"
  (igual que SPEC-0013 RN-14). Abrir o cerrar la ventana no cambia la preferencia.
- **RN-02:** El punto de aviso se muestra solo mientras la preferencia está sin decidir y hay recursos
  (o un filtro activo), las mismas condiciones en que hoy aparece la tarjeta.
- **RN-03:** Cerrar la ventana con Atrás, Escape o tocando fuera equivale a "decidir después": el punto sigue.
- **RN-04:** Al elegir una opción la ventana se cierra y el ícono queda sin punto.
- **RN-05:** El botón de ícono mide al menos 44 × 44 px y tiene nombre accesible
  ("Guardar recursos sin conexión"; con aviso: "… (pendiente de decidir)").
- **RN-06:** La preferencia sigue viviendo en el navegador: en el servidor no se pinta el ícono (sin errores
  de hidratación, CA-0013-19).

## 5. Entradas

Ninguna nueva. Se reutilizan `offlinePreference`, `setOfflinePreference`, `wipeOffline`, `forceOfflineSync`
y `useOfflineState`.

## 6. Salidas

Solo UI. Mismos valores de preferencia (`on` / `off`) que hoy.

## 7. Errores y casos límite

| Caso                                        | Comportamiento esperado                                       |
| ------------------------------------------- | ------------------------------------------------------------- |
| Sin recursos y sin filtro                   | No hay ícono (como hoy no hay tarjeta).                       |
| Se gira el teléfono o se agranda la ventana | Al pasar a ≥ 640 px se ve la tarjeta; el estado no se pierde. |
| Guardando mientras la ventana está abierta  | El contador "Guardados N de M" se actualiza en vivo.          |
| Navegador sin soporte (sin service worker)  | Igual que hoy: el panel no ofrece guardar.                    |

## 8. Criterios de aceptación

- **CA-0018-01:** Dado un docente en el celular (390 px) sin preferencia y con recursos, cuando abre
  "Mis recursos", entonces no ve la tarjeta de sin conexión sino un botón de ícono con punto de aviso junto a
  "Crear con IA", y la lista de recursos empieza en la primera pantalla.
- **CA-0018-02:** Dado ese ícono, cuando lo toca, entonces se abre una hoja inferior con la explicación y los
  botones "Guardar en este dispositivo" y "No, gracias", y nada queda guardado en el dispositivo todavía.
- **CA-0018-03:** Cuando toca "Guardar en este dispositivo", la ventana se cierra, el punto desaparece y los
  recursos quedan "Disponible sin conexión" (como CA-0013-37).
- **CA-0018-04:** Cuando toca "No, gracias", la ventana se cierra, el punto desaparece y no se guarda nada.
- **CA-0018-05:** Cuando cierra la ventana con Atrás sin elegir, sigue en "Mis recursos" y el punto sigue.
- **CA-0018-06:** Con la preferencia activa, al tocar el ícono ve "Guardados N de M" y puede dejar de guardar;
  al hacerlo se borra lo guardado (como hoy).
- **CA-0018-07:** En escritorio (1280 px) se ve la tarjeta actual y no el ícono.
- **CA-0018-08:** El botón de ícono mide ≥ 44 px, tiene nombre accesible y la página pasa la revisión de
  accesibilidad (axe) en el celular.

## 9. Seguridad y privacidad

Sin cambios: nada sale del dispositivo; al cerrar sesión se borra lo guardado (CA-0013-40).
La explicación conserva el aviso "Si este computador lo usan otras personas, mejor no".

## 10. Tareas

- [x] T1 — Extraer el contenido de la tarjeta (pregunta y estado) a un componente reutilizable — frontend
- [x] T2 — `OfflineButton`: ícono con punto de aviso y `Dialog` (hoja inferior en el celular) — frontend
- [x] T3 — En `resources/page.tsx`: ícono en `actions` del `PageHeader` solo `< sm`; tarjeta solo `≥ sm` — frontend
- [x] T4 — Ajustar `spec-0013-offline.spec.ts` (escritorio) y nuevo `spec-0018-offline-mobile.spec.ts` — qa
- [x] T5 — Captura antes/después en `docs/design/capturas/spec-0018/` y actualizar docs y `docs/ESTADO.md` — frontend

## 11. Preguntas abiertas (resueltas el 2026-11-20)

- En escritorio se mantiene la tarjeta (no estorba allá).
- El ícono va solo en "Mis recursos".

## 12. Implementación

- `components/offline/offline-panel.tsx`: `OfflineButton` (ícono, punto de aviso y `Dialog`); `OfflinePanel`
  se oculta por debajo de `sm` (`max-sm:hidden`). Ambos comparten el texto y las acciones.
- `app/(app)/resources/page.tsx`: el ícono va en `actions` del `PageHeader`, junto a "Crear con IA".
- Pruebas: `tests/e2e/spec-0018.movil.spec.ts` (CA-0018-01 a 06 y 08) y CA-0018-07 en
  `tests/e2e/spec-0013-offline.spec.ts`. Capturas en `docs/design/capturas/spec-0018/`.
