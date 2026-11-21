# Prueba de usabilidad y de funcionamiento — 2026-11-20

Pedido del usuario: "recuerda que son profesores; en ChatGPT o Claude solo dan instrucciones. Aquí no
darán instrucciones, pero todo debe ser fácil e intuitivo".

## Cómo se hizo

- **Recorrido de una profesora nueva** (`apps/web/scripts/recorrido-docente.mjs`,
  `npm run ux:recorrido -w @profia/web`): sin ayuda y con lo que tiene a la vista, hace el trabajo de
  una semana. En celular (360 px, táctil) y en computador (1366 px). Por pantalla mide clics, campos
  escritos, palabras técnicas, controles de menos de 44 px, botones principales y desbordes, y guarda
  una captura.
  1. Crear la cuenta y empezar.
  2. Primer taller (siguiendo "Primeros pasos").
  3. Descargarlo.
  4. Quiz del mismo tema.
  5. Corregir una pregunta.
  6. Plan de aula.
  7. Examen.
  8. Encontrar lo que hizo.
- **Funcionamiento**: suites completas (AI Engine, unitarias e integración, e2e en escritorio y
  celular).

## Resultados

| Tarea                     | Antes (celular / computador) | Después (celular / computador) |
| ------------------------- | ---------------------------- | ------------------------------ |
| 1. Crear cuenta y empezar | 3 / 3 clics, 4 campos        | igual                          |
| 2. Primer taller          | 9 / 9 clics, 2 campos        | igual                          |
| 3. Descargar              | 2 / 2 clics                  | igual                          |
| 4. Quiz del mismo tema    | 4 / 3 clics                  | **1 / 1 clic**                 |
| 5. Corregir una pregunta  | 2 / 2 clics, 1 campo         | igual                          |
| 6. Plan de aula del tema  | 4 / 3 clics                  | **1 / 1 clic**                 |
| 7. Examen                 | 7 / 6 clics                  | 6 / 5 clics                    |
| 8. Encontrar mis recursos | 3 / 1 clics                  | igual                          |
| **Total**                 | **34 / 29 clics**            | **27 / 24 clics**              |

Sin desbordes a 360 px ni palabras técnicas en ninguna pantalla.

## Hallazgos y qué se hizo

| #   | Hallazgo                                                                                                                                                  | Gravedad | Qué se hizo                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Desde un taller no hay cómo pedir "ahora un quiz de esto": en el celular el botón "Crear" desaparece y hay que volver a elegir curso y tema.              | Alta     | Bloque **"¿Qué más necesitas para «tema»?"** al final de cada recurso: crea con un toque el quiz, el taller o el plan de aula del mismo tema (valores del grado), o "Ajustar" abre el asistente ya ubicado. |
| 2   | En el asistente, el botón flotante "+ Crear" tapaba el botón para continuar del examen y el interruptor DUA.                                              | Alta     | El botón flotante no aparece dentro del asistente (ya se está creando).                                                                                                                                     |
| 3   | Ajustes del taller de 2.600 px en el celular: las 4 estructuras ocupan media pantalla antes de "Generar".                                                 | Media    | Se ve solo la estructura elegida; "Cambiar estructura (N opciones)" muestra las demás. Bajó a 1.900 px.                                                                                                     |
| 4   | El círculo para marcar la opción correcta medía 13 × 13 px; los interruptores, 48 × 28.                                                                   | Media    | Área táctil de 44 px en ambos (se ven igual).                                                                                                                                                               |
| 5   | El examen recomendado sumaba 100,4 puntos.                                                                                                                | Media    | El reparto deja exacto el total cuando una sección puede absorber el redondeo con un decimal (100,0).                                                                                                       |
| 6   | Con un solo tema en el curso, el examen obligaba a marcarlo.                                                                                              | Baja     | Viene marcado.                                                                                                                                                                                              |
| 7   | "Crear rápido" del Inicio no tenía Examen ni Plan de aula; en "Mis recursos" plan y examen tenían el ícono del taller; textos decían "talleres y quices". | Baja     | Los cinco tipos en "Crear rápido", un ícono por tipo y textos al día.                                                                                                                                       |
| 8   | Las descargas de las pruebas llegaban con el nombre "download".                                                                                           | —        | No era del producto: el contenedor no tiene configuración regional y Chromium no lee nombres con tildes. Las pruebas fijan `LANG=C.UTF-8`.                                                                  |

## Pendiente (no se tocó)

- Los avisos emergentes ("Curso creado", "Tema agregado") quedan un momento encima del título en el
  celular. Son pasajeros.
- Llegar a "Mis recursos" en el celular pide abrir el menú (3 toques).
- La prueba con docentes reales (SPEC-0026) sigue siendo necesaria: esto mide el camino, no si el
  contenido les sirve.

## Funcionamiento

- AI Engine: 189 pruebas en verde.
- Web: 313 unitarias e integración en verde.
- e2e: 96 en verde (incluye la nueva `usabilidad.movil.spec.ts`, que fija los hallazgos 1–4 y 6).

## Después de los bloques 1–8 (2026-11-21)

Mismo recorrido (`npm run ux:recorrido`), ajustado a los flujos nuevos: los temas los propone ProfIA
(SPEC-0032), el recurso abre en la hoja y se edita desde "Editar pregunta 1" (SPEC-0029), "Mis
recursos" está en la barra de abajo del celular (SPEC-0033). Celular / computador:

| Tarea                     | 2026-11-20 (después)  | 2026-11-21                                                    |
| ------------------------- | --------------------- | ------------------------------------------------------------- |
| 1. Crear cuenta y empezar | 3 / 3 clics, 4 campos | igual                                                         |
| 2. Primer taller          | 9 / 9 clics, 2 campos | 10 / 10 clics, **1 campo**, y el periodo 1 planeado (4 temas) |
| 3. Descargar              | 2 / 2 clics           | igual                                                         |
| 4. Quiz del mismo tema    | 1 / 1 clic            | igual                                                         |
| 5. Corregir una pregunta  | 2 / 2 clics, 1 campo  | igual (desde la hoja)                                         |
| 6. Plan de aula del tema  | 1 / 1 clic            | igual                                                         |
| 7. Examen                 | 6 / 5 clics           | 7 / 6 clics                                                   |
| 8. Encontrar mis recursos | 3 / 1 clics           | **2 / 1 clics**                                               |
| **Total**                 | **27 / 24 clics**     | **28 / 26 clics, 6 campos (antes 7)**                         |

- El paso 2 suma un clic porque ya no se escribe el tema: se aceptan los que propone ProfIA, y queda
  planeado todo el primer periodo (antes, un solo tema).
- El examen suma un clic porque el curso ahora tiene varios temas y hay que marcar uno.
- No miden lo que más ahorra: "Usar también en…" (un taller para 3 grupos ya no son 3 generaciones),
  los ajustes con un toque (antes había que escribir la indicación) y "Para esta semana".
- Durante el recorrido apareció un error real, ya corregido: en el celular, al aceptar los temas la
  hoja se cerraba con "Atrás" y deshacía el salto al Inicio (`navigatingFromLayer`; prueba
  `CA-0032-02` en `usabilidad-bloques.movil.spec.ts`).
