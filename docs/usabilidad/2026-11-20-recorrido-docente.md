# Prueba de usabilidad y de funcionamiento — 2026-11-20

Pedido del usuario: "recuerda que son profesores; en ChatGPT o Claude solo dan instrucciones. Aquí no
darán instrucciones, pero todo debe ser fácil e intuitivo".

## Cómo se hizo

- **Recorrido de una profesora nueva** (`apps/web/scripts/recorrido-docente.mjs`,
  `npm run ux:recorrido -w @profe/web`): sin ayuda y con lo que tiene a la vista, hace el trabajo de
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
