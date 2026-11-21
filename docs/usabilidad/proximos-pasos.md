# Usabilidad: lo próximo a hacer

Pedido del usuario (2026-11-20): dejar documentado como **lo próximo a hacer** lo que se recomendó
después de la [prueba de usabilidad](2026-11-20-recorrido-docente.md). La idea que lo guía: los
docentes usan ChatGPT o Claude dando instrucciones. Aquí no las van a escribir, así que **ProfIA
propone y el docente aprueba o ajusta con un toque**. Escribir y elegir debe ser lo mínimo.

## Cómo trabajarlo

- Una spec por bloque, con `/spec` y en el orden de abajo. Se espera la aprobación del usuario entre
  cada una, como con las demás specs.
- La 1 y la 2 se pueden juntar en una sola spec si el usuario lo prefiere: son las que se le
  recomendaron como más cercanas a "como ChatGPT, pero sin escribir".
- Al cerrar cada una:
  - volver a correr el recorrido (`LANG=C.UTF-8 npm run ux:recorrido -w @profia/web -- <url> <carpeta>
movil|escritorio`) y anotar los clics en el informe;
  - marcar el punto como hecho aquí y en `docs/ESTADO.md`.

## Estado (2026-11-21)

Los bloques 1 a 8 están implementados (SPEC-0027 a SPEC-0034; el usuario aprobó seguir con lo
recomendado: "lo más importante son todas las mejoras de usabilidad implementadas"). Queda el 9
(validación con docentes reales, SPEC-0026), que necesita personas.

## Orden recomendado

### 1. Ajustes rápidos con botones (en vez de instrucciones escritas) — ✔ hecho (SPEC-0027)

- **Problema:** para cambiar un recurso hay que escribir qué cambiar ("Regenerar" de un ítem pide texto
  libre). En ChatGPT bastaría con "hazlo más fácil".
- **Propuesta:** debajo de cada taller, quiz o examen, botones que rehacen el recurso entero:
  - _Más fácil_
  - _Más difícil_
  - _Más corto_
  - _Más ejemplos de la vida diaria_
  - _Agregar 2 preguntas_ (o actividades)

  También, en cada ítem, chips que reemplacen el texto libre: _Más fácil · Otra pregunta · Mejor
  redactada_. La versión anterior queda guardada (versiones de SPEC-0008); el docente acepta o vuelve.

- **Dónde:**
  - `modules/resources/service.ts`: `regenerateItem` ya existe para un ítem; falta "rehacer todo con
    una indicación", que puede ser un `retry` con `notes` extra.
  - `app/(app)/courses/[courseId]/resources/[resourceId]/item-tools.tsx`
  - `resource-view.tsx`
- **Cuidado:**
  - cuesta cupo como una generación;
  - las indicaciones son fijas, del producto, no texto del docente: van como anexo de prompt
    versionado en `apps/ai-engine/prompts/`.

### 2. Usar el mismo recurso en mis otros grupos — ✔ hecho (SPEC-0028)

- **Problema:** es muy común dictar la misma materia en 601, 602 y 603. Hoy hay que crear el taller
  tres veces (y gastar tres del cupo).
- **Propuesta:**
  - en el recurso, "Usar también en…" con los otros cursos del docente de la misma asignatura y grado;
  - copia el recurso (contenido y versión actual) al tema equivalente, o crea el tema si no existe;
  - **sin gastar cupo de IA**.
- **Dónde:**
  - `duplicateResource` en `modules/resources/service.ts`, que hoy copia en el mismo curso;
  - la copia de planeación de SPEC-0006 sirve de referencia para emparejar temas por título.
- **Cuidado:** tenancy (mismo espacio y mismo docente) y un test de acceso cruzado.

### 3. Ver el recurso como el documento que va a imprimir — ✔ hecho (SPEC-0029)

- **Problema:** al abrir un taller lo primero es un formulario ("Título", "Propósito", "Materiales" en
  cajas). El docente espera ver la hoja como saldrá en papel.
- **Propuesta:**
  - vista de documento por defecto (encabezado, actividades, como en el PDF);
  - "Editar" dentro de cada parte;
  - en el celular, la misma vista con texto legible.
- **Dónde:**
  - `resource-view.tsx` y los editores (`workshop-editor.tsx`, `quiz-editor.tsx`,
    `exam-editor.tsx`, `lesson-plan-editor.tsx`);
  - el modelo intermedio de `modules/documents/model.ts` puede alimentar la vista previa para que sea
    igual al PDF.

### 4. "Para esta semana" en el Inicio — ✔ hecho (SPEC-0030)

- **Problema:** "Crear rápido" todavía obliga a elegir qué y para qué tema.
- **Propuesta:** el Inicio dice _"Lo que sigue en 6°01: Fracciones equivalentes"_ con [Taller] [Quiz]
  [Plan de aula], y crea con un toque (`createResourceQuick`, como en "¿Qué más necesitas?"). El tema
  que sigue es el primero de la planeación, en orden, que todavía no tiene recursos.
- **Dónde:**
  - `modules/resources/overview.ts` (`getTeacherHome`, `NextStep`);
  - `app/(app)/dashboard/teacher-home.tsx`.

### 5. Compartir por WhatsApp e imprimir directo — ✔ hecho (SPEC-0031; falta probar en teléfonos reales)

- **Propuesta:**
  - en el celular, "Compartir" con la Web Share API (archivo PDF), que abre WhatsApp u otra app;
  - en el computador, "Imprimir", que abre el PDF listo para imprimir;
  - si el navegador no deja compartir archivos, se descarga como hoy.
- **Dónde:**
  - `app/(app)/courses/[courseId]/resources/[resourceId]/downloads.tsx`;
  - la ruta `export` ya entrega el archivo.

### 6. Primer curso sin escribir temas — ✔ hecho (SPEC-0032)

- **Propuesta:** al crear el primer curso, ofrecer _"¿Te propongo los temas del primer periodo según los
  DBA?"_ (la propuesta de SPEC-0014 ya existe). En "Primeros pasos", el paso 2 pasa a ser "Revisa los
  temas que te propongo", en vez de "Escribe tu primer tema".
- **Dónde:**
  - `app/(app)/dashboard/first-steps.tsx`;
  - `modules/generation/planning.ts`.
- **Cuidado:** asignaturas sin DBA siguen con "Escribe tu tema".

### 7. Barra de navegación abajo en el celular — ✔ hecho (SPEC-0033)

- **Problema:** llegar a "Mis recursos" en el celular toma 3 toques (menú de tres rayas).
- **Propuesta:**
  - barra inferior fija con Inicio · Mis cursos · Crear (centro) · Mis recursos, que reemplaza el
    botón flotante "Crear";
  - en la pantalla de un recurso sigue su propia barra de acciones.
- **Dónde:** `components/app-shell/app-shell.tsx`.
- **Cuidado:** que no tape nada; ya hay pruebas de elementos flotantes (`data-floating`) en
  `spec-0013.movil.spec.ts`.

### 8. Detalles — ✔ hecho (SPEC-0034)

- Avisos emergentes abajo en el celular (`components/app-toaster.tsx`): hoy tapan el título un
  momento.
- Opción de letra más grande en Ajustes, para docentes mayores.
- Explicar en una línea "Borrador" y "Listo" la primera vez ("Listo = ya lo revisaste; se descarga sin
  la marca de borrador").

### 9. Validación con docentes reales — antes de seguir agregando (SPEC-0026)

- 5 docentes, tarea real: "prepara el material de tu próxima clase y llévalo impreso".
- Se observa en voz alta dónde dudan y se mide el tiempo hasta la primera descarga.
- Medir dentro de la aplicación dónde abandonan el flujo, sin datos personales:
  - creó curso;
  - creó tema;
  - generó;
  - descargó.

## Después

Siguen las specs que ya estaban en la lista: SPEC-0025 (resultados → dificultades → refuerzo) y
SPEC-0026 (validación con docentes, que puede adelantarse con el punto 9). SPEC-0020 (material de
referencia) sigue en Borrador, esperando respuestas del usuario.
