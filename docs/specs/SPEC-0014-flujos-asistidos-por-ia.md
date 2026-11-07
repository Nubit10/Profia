# SPEC-0014 — Flujos asistidos por IA de punta a punta: el docente hace lo mínimo

| Campo                    | Valor                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                                                                                                                                                                                                        |
| Fase del roadmap         | 4 · Planning y 6 · Generation (continúa SPEC-0013)                                                                                                                                                                                                                  |
| Módulo(s) responsable(s) | `modules/planning` (propuesta de planeación y su aceptación), `modules/generation` (cliente del contrato), `apps/ai-engine` (endpoint, prompt y validador), `modules/resources` (recursos por periodo y tema), `modules/curriculum` (DBA a la mano), `apps/web/app` |
| Agentes                  | product, architect, curriculum, ai-engine, backend, frontend, qa, reviewer                                                                                                                                                                                          |
| ADR relacionados         | **ADR-0013 (propuesto): propuesta de planeación con IA** (contrato nuevo `generation-planning.v1`, ver §9). Se apoya en ADR-0005 (catálogo), ADR-0007 (inferencia) y ADR-0008 (segundo plano)                                                                       |
| Autor / Fecha            | product / 2026-11-06                                                                                                                                                                                                                                                |

## 1. Objetivo

Hoy el docente tiene que inventar la estructura de su periodo: escribe cada unidad y cada tema a mano.
La IA solo aparece al final (objetivos de un tema, el taller o el quiz) y el DBA se ve como una
etiqueta "DBA 1" sin su texto. Además, los recursos quedan en una lista plana por fecha.

Esta spec invierte eso. **La IA propone todo lo que puede, a partir de los DBA del MEN del grado y el
área del curso**:

- los temas del periodo con sus títulos;
- los objetivos;
- el recurso de cada tema, con un toque.

El docente solo revisa, ajusta y acepta. El DBA está siempre a la mano, con su texto, sus evidencias
y la fuente oficial. Cada taller, quiz y examen queda ordenado en su lugar: "Periodo 1 · Números
enteros · La recta numérica".

Dos reglas no se negocian:

- **Evidencia, no alucinación.** La IA solo usa DBA que existen en el catálogo, y el texto que ve el
  docente sale de la base, nunca del modelo.
- **El docente decide.** Nada se guarda sin su acción.

## 2. Evidencia: recorrido del 2026-11-06

Recorrido automatizado sobre el build de producción (con los cambios de SPEC-0013), con la IA de
prueba, en 1366 × 860. Un curso de Matemáticas 6° con el catálogo de DBA cargado (12 DBA del grado).
Capturas en `docs/design/capturas/spec-0014/`.

| Id   | Flujo     | Fricción observada                                                                                                                                                                                                        | Evidencia                                                      |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| F-01 | Planear   | La planeación vacía no ofrece **ninguna ayuda de IA**. El docente inventa las unidades y los temas. Planear el periodo 1 con 3 unidades y 6 temas costó **18 clics y 9 campos escritos**, y no queda ligado a ningún DBA. | `01-planeacion-a-mano.png`                                     |
| F-02 | Objetivos | "Sugerir objetivos con IA" va **tema por tema**. Cada sugerencia se acepta una a una: 2 clics por objetivo y un diálogo por tema (6 temas con 3 objetivos son más de 24 clics).                                           | `02-sugerir-objetivos.png`                                     |
| F-03 | DBA       | En la planeación y en el recurso el DBA aparece solo como "DBA 1", "DBA 2". **No se ve su texto ni sus evidencias** donde el docente decide; para leerlo hay que ir a la pestaña "DBA y Estándares".                      | `03-recurso-dba-sin-texto.png`; el texto no está en la página  |
| F-04 | Recursos  | "Mis recursos" y "Recursos del curso" son **listas planas por fecha**. No hay periodo, unidad ni tema; con un año de trabajo, encontrar "el quiz de la recta numérica del periodo 1" exige leer toda la lista.            | `04-mis-recursos-lista-plana.png`, `05-recursos-del-curso.png` |
| F-05 | Recurso   | Desde un tema de la planeación, crear un quiz pasa por el asistente (elegir tipo y luego generar). No hay un "crear con un toque" que use los valores recomendados del grado.                                             | recorrido (SPEC-0013 dejó 3 clics desde el Inicio)             |

**Después (2026-11-07, mismo recorrido con la IA de prueba; `CAPTURAS=1 npx playwright test
tests/e2e/spec-0014-capturas.spec.ts`):**

| Id   | Ahora                                                                                                 | Evidencia                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| F-01 | "Proponer temas con IA" en la planeación vacía; el periodo 1 queda planeado en 3 clics, sin escribir. | `despues-01-planeacion-vacia.png`, `despues-02-revision-propuesta.png`                              |
| F-02 | "Proponer objetivos" para toda la unidad: una revisión y "Aceptar todos" (3 clics).                   | `despues-03-objetivos-en-bloque.png`                                                                |
| F-03 | Cada "DBA n" abre su ficha con el enunciado, las evidencias y la fuente; cada tema muestra sus DBA.   | `despues-04-planeacion-con-dba.png`, `despues-05-ficha-dba.png`, `despues-09-movil-ficha-dba.png`   |
| F-04 | Recursos por Periodo · Unidad · Tema, con los exámenes en su unidad; "Mis recursos" con recientes.    | `despues-06-recursos-del-curso.png`, `despues-07-mis-recursos.png`, `despues-08-movil-recursos.png` |
| F-05 | "Crear quiz" y "Crear taller" en cada tema y en los temas vacíos de "Recursos del curso": 1 clic.     | `despues-06-recursos-del-curso.png`                                                                 |

## 3. Alcance

**Incluye:**

- **Proponer la planeación con IA (F-01).** En la planeación, "Proponer temas con IA" para un periodo
  o para el año completo, que reparte los DBA del grado entre los periodos.
  - La IA propone unidades y temas con título y una línea de descripción, cada tema ligado a 1–3 DBA
    del catálogo del curso.
  - Una pantalla de revisión muestra la propuesta como árbol con casillas: el docente cambia títulos
    en el sitio, quita lo que no quiere, pide "otra propuesta" para una unidad y la agrega con
    "Agregar a la planeación".
  - Las unidades y temas que ya existen se respetan: la IA completa, no reemplaza.
- **Proponer temas para una unidad.** Sugiere los títulos de temas de una unidad que ya existe.
- **Objetivos para todos los temas de una vez (F-02).** "Proponer objetivos" en una unidad o un
  periodo propone 2–3 objetivos por tema, ligados a los DBA del tema, y una revisión única deja
  "Aceptar todos" o elegir.
- **Recurso con un toque (F-05).** En cada tema de la planeación:
  - "Crear taller" y "Crear quiz" generan con los valores recomendados del grado (SPEC-0008), sin
    pasar por el asistente; "Ajustar antes" abre el asistente como hoy.
  - En cada unidad y periodo, "Crear examen" con un toque usa todos sus temas.
- **DBA a la mano (F-03).** Cada etiqueta de DBA ("DBA 1") se abre con clic o teclado y muestra el
  enunciado, las evidencias y la fuente oficial (documento del MEN, versión y página, SPEC-0004). Va
  en la planeación, en las propuestas, en el diálogo de objetivo, en el asistente y en el recurso.
  Cada tema muestra además sus DBA (los de sus objetivos o los que trajo la propuesta).
- **Recursos por periodo y tema (F-04).**
  - "Recursos del curso" se agrupa Periodo → Unidad → Tema, con encabezados como "Periodo 1 ·
    Números enteros · La recta numérica". Los temas sin recursos ofrecen crearlos con un toque, y los
    exámenes van en su unidad o su periodo.
  - "Mis recursos" agrupa por curso y, dentro, por periodo y tema; arriba quedan los recientes, y los
    filtros de SPEC-0012 se mantienen.
- **Trazabilidad.** Cada propuesta queda en `generation_logs` con el modelo y la versión del prompt.

**No incluye (explícitamente):**

- Generar una "guía del tema" (documento explicativo del contenido para el estudiante) como tipo de
  recurso nuevo: ver la pregunta abierta 4.
- Planes de aula.
- Cambiar el catálogo de DBA, o agregar áreas que el catálogo no tiene (hoy: Matemáticas, Lenguaje y
  Transición).
- Cambiar cómo se generan los talleres, quices y exámenes (SPEC-0008/0011): el toque usa esa misma
  generación.
- Publicar o compartir planeaciones entre docentes (fase 11).

## 4. Actores y permisos

| Actor                     | Puede                                                                | No puede                                                                       |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Docente                   | Pedir propuestas para sus cursos, revisarlas, editarlas y aceptarlas | Pedir propuestas o ver recursos de cursos de otro docente o de otro espacio    |
| Administrador del colegio | Lo mismo que hoy (no planea cursos si no es docente)                 | Ver la planeación ni los recursos de los docentes (sin cambio respecto de hoy) |

## 5. Reglas de negocio

- **RN-01 — Solo DBA del catálogo.**
  - La IA recibe los DBA del curso (código, número y enunciado) del catálogo publicado (ADR-0005), y
    solo puede responder con esos códigos.
  - El servidor descarta cualquier código que no sea del grado y el área del curso, y lo registra
    como reparación.
  - Un tema sin ningún DBA válido se muestra marcado "Sin DBA" para que el docente decida.
  - El texto del DBA que se muestra sale siempre de la base, nunca del modelo.
- **RN-02 — Nada se guarda sin el docente.** La propuesta vive solo en la pantalla de revisión hasta
  que el docente pulsa "Agregar a la planeación" o "Aceptar". Cerrar la revisión la descarta, y
  pedir otra propuesta no borra lo ya aceptado.
- **RN-03 — Completar, no reemplazar.**
  - La propuesta recibe los títulos que ya existen en el periodo o la unidad y no los repite.
  - Aceptar agrega unidades y temas al final; nunca modifica, mueve ni archiva lo existente.
- **RN-04 — Reparto de DBA en el año.**
  - Al proponer el año completo, cada DBA del grado queda en al menos un tema de algún periodo,
    según el número de periodos del curso (SPEC-0006).
  - La cobertura de DBA de la planeación ("Cobertura de DBA: N de M") debe subir al aceptar.
- **RN-05 — Tamaño de la propuesta.**
  - Por defecto, 2 a 4 unidades por periodo y 2 a 4 temas por unidad, con títulos de máximo 80
    caracteres.
  - El docente puede pedir "más temas" o "menos temas" antes de generar.
  - El validador pedagógico del AI Engine rechaza títulos repetidos, vacíos o que no correspondan
    al área.
- **RN-06 — Objetivos ligados al DBA del tema.** Los objetivos propuestos en bloque usan los DBA que
  el tema ya tiene (de la propuesta o de sus objetivos). Siguen las reglas de SPEC-0007: verbo
  observable y nunca más de 5 objetivos por tema.
- **RN-07 — Un toque usa los valores recomendados.**
  - "Crear taller" y "Crear quiz" desde un tema generan con los valores por defecto del grado
    (`defaultsForGrade`), el formato predeterminado del docente (SPEC-0010) y todos los objetivos
    del tema.
  - Cuentan en el cupo diario como cualquier recurso (SPEC-0008) y muestran el aviso de cupo antes
    de generar si no alcanza.
- **RN-08 — Cupo de las propuestas.** Las propuestas de planeación y de objetivos **no** descuentan el
  cupo de recursos. Tienen su propio límite por docente: 20 propuestas por día y 5 por minuto (ver
  la pregunta abierta 3).
- **RN-09 — Un recurso, un lugar.**
  - Cada recurso se muestra bajo el periodo, la unidad y el tema que tenía al generarse; se guarda
    la referencia al tema (SPEC-0008).
  - Si el tema se movió de unidad o de periodo, se muestra donde está ahora. Si se archivó, va en
    "Temas archivados".
  - El examen va en la unidad o el periodo de su alcance (SPEC-0011); si cubre varios periodos, en
    "Exámenes del año".
- **RN-10 — Lo de SPEC-0012/0013 se mantiene:** un botón principal por pantalla, glosario sin jerga
  (la UI dice "Proponer con IA", nunca "prompt"), WCAG 2.1 AA, celular primero y sin errores de
  hidratación.

## 6. Entradas

- **Proponer planeación:** `{ courseId, scope: "PERIOD" | "YEAR", periodNumber?, size: "LESS" | "DEFAULT" | "MORE" }`,
  validado con Zod. El servidor arma lo que va al AI Engine:
  - asignatura y grado;
  - número y nombre de los periodos;
  - DBA del curso (código, número, enunciado y evidencias);
  - títulos existentes de unidades y temas.

  Nunca va nombre del docente, colegio ni estudiantes.

- **Proponer temas de una unidad:** `{ unitId, size }`.
- **Proponer objetivos en bloque:** `{ unitId }` o `{ courseId, periodNumber }`.
- **Aceptar una propuesta:** la versión revisada por el docente:
  - `{ courseId, units: [{ title, periodNumber, topics: [{ title, description, dbaCodes[] }] }] }`;
  - o `{ objectives: [{ topicId, statement, dbaCodes[] }] }`.

  El servidor vuelve a validar los DBA (RN-01) y los límites (RN-05, RN-06).

- **Recurso con un toque:** `{ topicId, type: "WORKSHOP" | "QUIZ" }` o
  `{ scope: unidad o periodo, type: "EXAM" }`.

## 7. Salidas

- **Contrato nuevo `generation-planning.v1`** (`docs/ai/contracts/`): unidades y temas con títulos,
  descripción y códigos de DBA, más los metadatos de siempre (modelo, versión de prompt, intentos,
  tokens).
- **Unidades, temas y objetivos creados** al aceptar, auditados como hoy (`unit.created`,
  `topic.created`, `objective.created`). Se agrega `planning.ai_proposal_accepted`, con el número de
  elementos aceptados.
- **`generation_logs`** de cada propuesta (tarea `planning` u `objectives_batch`).
- **Vista agrupada de recursos** (curso → periodo → unidad → tema) desde `modules/resources`, sin
  cambios en la base.

## 8. Errores y casos límite

| Caso                                                        | Comportamiento esperado                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| AI Engine apagado o lento                                   | "No pudimos proponer temas ahora. Puedes agregarlos a mano." La planeación funciona como hoy   |
| La IA devuelve un DBA que no es del curso                   | Se descarta (RN-01); si el tema queda sin DBA, se marca "Sin DBA"                              |
| La IA repite un tema que ya existe                          | El validador lo quita; si no queda nada nuevo, "Tu periodo ya cubre estos DBA"                 |
| Asignatura sin DBA en el catálogo (p. ej. Educación Física) | No se ofrece "Proponer temas con IA"; se explica que la asignatura no tiene DBA en el catálogo |
| El docente edita un título y lo deja vacío                  | Ese tema no se agrega; el botón dice cuántos se agregarán                                      |
| Se agota el límite de propuestas                            | Se avisa a qué hora se puede pedir otra; la planeación manual sigue                            |
| El cupo de recursos no alcanza para el toque                | El botón muestra el aviso de cupo antes de generar (SPEC-0012 CA-0012-10)                      |
| Un recurso cuyo tema se archivó                             | Aparece en "Temas archivados" del periodo, no se pierde                                        |
| Un periodo sin temas                                        | Una línea: "Sin temas · Proponer temas con IA · Agregar tema" (SPEC-0013 CA-0013-08)           |
| Dos pestañas aceptan la misma propuesta                     | La segunda no duplica: los títulos que ya existen en la unidad se omiten (RN-03)               |

## 9. Seguridad y privacidad

- **Tenancy (ADR-0004):** cada acción recibe `ctx` y verifica que el curso, la unidad o el tema sean
  del docente en el espacio activo. Los IDs ajenos responden "no encontrado". Habrá un test de acceso
  cruzado para proponer, aceptar, el toque y la vista agrupada.
- **Qué va al modelo:** solo datos pedagógicos (asignatura, grado, periodos, DBA y títulos). Los
  títulos escritos por el docente pasan por `redactContactData` (SPEC-0008 §9).
- **Las propuestas son datos, no instrucciones.** La respuesta del modelo se valida con schema y con
  el validador pedagógico antes de mostrarse; lo que el docente acepta se valida otra vez en el
  servidor.
- **Límites:** RN-08, para evitar abuso y costo.
- **ADR-0013 (propuesto).** El contrato nuevo `generation-planning.v1` entre el producto y el AI
  Engine requiere ADR (AGENTS.md: "cambio de contrato entre producto y AI Engine"). El ADR fija:
  - entradas y salidas;
  - el validador (solo códigos dados, sin repetidos, tamaños);
  - la cadena de modelos (ADR-0007);
  - que la propuesta nunca se persiste sin aceptación.

  El reparto de DBA en el año (RN-04) se decide ahí: solo prompt, o un reparto previo determinista
  que el modelo solo titula.

## 10. Criterios de aceptación

Los clics se cuentan como en SPEC-0012/0013 (solo clics, sin escribir).

**Proponer la planeación**

- **CA-0014-01:** Dado un curso de Matemáticas 6° con el periodo 1 vacío, cuando el docente pulsa
  "Proponer temas con IA", elige "Periodo 1" y luego "Agregar a la planeación", entonces el periodo
  queda con al menos 2 unidades y 4 temas con título, **en 4 clics o menos y sin escribir nada**
  (antes 18 clics y 9 campos, F-01).
- **CA-0014-02:** Dada una propuesta, cuando se revisa, entonces cada tema muestra sus DBA. Todos los
  códigos son DBA de Matemáticas 6° del catálogo publicado, y su texto es el del catálogo. Con un
  motor de prueba que devuelve un código inventado, ese código no aparece y el tema queda marcado
  "Sin DBA".
- **CA-0014-03:** Dada la pantalla de revisión, cuando el docente cambia un título, quita una unidad
  y pide "otra propuesta" para otra unidad, entonces "Agregar a la planeación" guarda exactamente lo
  que quedó y nada más. Cerrar sin agregar no guarda nada.
- **CA-0014-04:** Dado un periodo con unidades y temas existentes, cuando se pide una propuesta y se
  acepta, entonces lo existente no cambia (títulos, orden, objetivos) y no se repite ningún título.
- **CA-0014-05:** Dado un curso con 4 periodos vacíos, cuando el docente propone el año completo y lo
  acepta, entonces cada periodo queda con temas y la cobertura de DBA llega a 12 de 12.
- **CA-0014-06:** Dada una unidad existente, cuando el docente pulsa "Proponer temas" en su menú,
  entonces recibe 2–4 títulos nuevos para esa unidad y agrega los que marque con 1 clic.
- **CA-0014-07:** Dado el AI Engine apagado, cuando se pide una propuesta, entonces se ve el mensaje
  de §8 y la planeación manual funciona igual. Para una asignatura sin DBA en el catálogo, la opción
  no aparece y se explica por qué.

**Objetivos en bloque**

- **CA-0014-08:** Dada una unidad con 3 temas sin objetivos, cuando el docente pulsa "Proponer
  objetivos" y luego "Aceptar todos", entonces cada tema queda con 2–3 objetivos ligados a sus DBA,
  **en 3 clics o menos** (antes 2 clics por objetivo y un diálogo por tema, F-02).
- **CA-0014-09:** Dada la revisión de objetivos en bloque, cuando el docente desmarca uno y edita
  otro, entonces se guardan solo los marcados, con el texto editado, y ningún tema pasa de 5
  objetivos.

**Recurso con un toque**

- **CA-0014-10:** Dado un tema con objetivos en la planeación, cuando el docente pulsa "Crear quiz"
  en ese tema, entonces el quiz se empieza a generar con los valores recomendados del grado **en 1
  clic** y llega a la página del recurso (antes pasaba por el asistente, F-05).
  "Ajustar antes" abre el asistente con el curso y el tema elegidos.
- **CA-0014-11:** Dada una unidad con temas, cuando el docente pulsa "Crear examen de esta unidad"
  con un toque, entonces el examen se genera con todos los temas de la unidad y los valores
  recomendados. Sin cupo suficiente, se avisa antes de generar.

**DBA a la mano**

- **CA-0014-12:** Dada cualquier etiqueta de DBA (planeación, propuesta, diálogo de objetivo,
  asistente, recurso), cuando el docente la toca o la activa con el teclado, entonces ve el número,
  el enunciado, las evidencias y la fuente (documento del MEN, versión y página), sin salir de la
  pantalla. Escape o Atrás la cierran.
- **CA-0014-13:** Dado un tema con DBA, cuando se mira en la planeación, entonces sus DBA se ven en el
  tema (no solo en sus objetivos) y se abren como en CA-0014-12.

**Recursos por periodo y tema**

- **CA-0014-14:** Dado un curso con un quiz en "La recta numérica" (periodo 1), un taller en
  "Fracciones equivalentes" (periodo 1) y un quiz en "Ángulos" (periodo 2), cuando el docente abre
  "Recursos del curso", entonces los ve bajo los encabezados "Periodo 1 · Números enteros · La recta
  numérica", "Periodo 1 · Fracciones · Fracciones equivalentes" y "Periodo 2 · Geometría · Ángulos",
  en el orden de la planeación (antes una lista por fecha, F-04).
- **CA-0014-15:** Dado un tema sin recursos en "Recursos del curso", cuando se mira, entonces ofrece
  "Crear taller" y "Crear quiz" con un toque (CA-0014-10).
- **CA-0014-16:** Dado un examen de la unidad "Números enteros", cuando se abre "Recursos del curso",
  entonces aparece en "Exámenes" de esa unidad. Un recurso de un tema archivado aparece en "Temas
  archivados" de su periodo.
- **CA-0014-17:** Dado un docente con recursos en dos cursos, cuando abre "Mis recursos", entonces ve
  arriba los 5 más recientes y debajo cada curso agrupado por periodo y tema. Los filtros por tipo y
  curso siguen funcionando, y no ve recursos de otro docente (test de acceso cruzado).
- **CA-0014-18:** Dado "Mis recursos" con 30 recursos en 4 periodos, cuando el docente busca "el quiz
  de la recta numérica del periodo 1", entonces lo encuentra en el encabezado de ese tema sin hacer
  scroll por los demás periodos, que se pueden plegar.

**Transversal**

- **CA-0014-19:** Dada cualquier propuesta, cuando termina, entonces queda en `generation_logs` con
  el modelo, la versión del prompt, los intentos y las reparaciones (p. ej. DBA descartados), y no se
  creó ninguna unidad, tema ni objetivo hasta que el docente aceptó.
- **CA-0014-20:** Dado otro docente del mismo colegio, cuando intenta proponer, aceptar o crear con
  un toque sobre un curso, unidad o tema ajenos, entonces recibe "no encontrado" y no se crea nada
  (test de acceso cruzado).
- **CA-0014-21:** Dado el límite de propuestas (RN-08), cuando se supera, entonces se avisa a qué hora
  se puede pedir otra y el cupo de recursos no cambió.
- **CA-0014-22:** Dadas las pantallas nuevas (revisión de propuesta, objetivos en bloque, recursos
  agrupados, ficha de DBA), cuando se analizan con axe y a 360 px, entonces no hay violaciones WCAG
  2.1 AA, no hay scroll horizontal y no hay errores de hidratación.

## 11. Tareas

- [x] T1 — ADR-0013 y contrato `generation-planning.v1` (entradas, salidas, validador, reparto de DBA) — architect + ai-engine
- [x] T2 — AI Engine: endpoint, prompt versionado, validador pedagógico (solo códigos dados, sin repetidos, tamaños) y benchmark con `--mock` — ai-engine
- [x] T3 — Cliente del contrato y propuestas en `modules/generation`; aceptación en `modules/planning` con validación y auditoría (RN-01 a RN-05) — backend
- [x] T4 — Pantalla de revisión de la propuesta (árbol con casillas, edición en el sitio, "otra propuesta") y "Proponer temas" de una unidad (CA-01 a CA-07) — frontend
- [x] T5 — Objetivos en bloque por unidad o periodo (RN-06, CA-08/09) — backend + frontend
- [x] T6 — Recurso con un toque desde el tema, la unidad y el periodo (RN-07, CA-10/11) — backend + frontend
- [x] T7 — Ficha de DBA (`DbaChip` con enunciado, evidencias y fuente) en todas las pantallas, y DBA del tema (CA-12/13) — curriculum + frontend
- [x] T8 — Vista agrupada Periodo → Unidad → Tema en "Recursos del curso" y "Mis recursos" (RN-09, CA-14 a CA-18) — backend (resources) + frontend
- [x] T9 — Límite de propuestas (RN-08, CA-21) — backend
- [x] T10 — Pruebas: un test por CA con su ID; acceso cruzado (CA-17/20); axe, 360 px e hidratación (CA-22) — qa
- [x] T11 — Capturas antes/después y sistema de diseño — frontend
- [x] T12 — Revisión contra la spec y DoD — reviewer

## 12. Decisiones (resueltas por el usuario el 2026-11-06: "con tu recomendación")

1. **Por periodo y año completo.** Las dos opciones. Con el curso vacío se sugiere "el año completo"
   (RN-04).
2. **Tamaño:** 2–4 unidades por periodo y 2–4 temas por unidad, con "más temas" o "menos temas"
   (RN-05). No se agregan horas semanales a la asignatura.
3. **Cupo:** las propuestas no descuentan el cupo de recursos. Tienen su propio límite de 20 por día
   y 5 por minuto por docente (RN-08).
4. **Guía del tema:** va en una spec aparte (SPEC-0015). Esta spec queda en los flujos.
5. **Un toque:** genera directo con los valores recomendados; "Ajustar antes" queda al lado (RN-07).
6. **Mis recursos:** "Recientes" arriba y debajo agrupado por curso, periodo y tema, con periodos
   plegables (CA-0014-17/18).
7. **Asignaturas sin DBA en el catálogo:** no se ofrece la propuesta y se explica por qué. Los
   Estándares Básicos de Competencias quedan para cuando estén en el catálogo.

## 13. Estado de la implementación y cómo continuar

Actualizado el 2026-11-06, al cerrar la parte 4 (rama `claude/jolly-dirac-fz2ibq`, PR
Nubit10/Profia#1).

**Parte 1, hecha (T1–T4):** propuesta de planeación con IA.

- ADR-0013 y contrato `docs/ai/contracts/generation-planning.v1.md`.
- AI Engine: `app/generation/planning.py`, `prompts/planning.v1.md`, endpoint
  `POST /v1/generation/planning`, tarea `"planeacion"` en `providers/mock_llm.py` (inventa un
  código a propósito) y `tests/test_planning.py`.
- Web:
  - `modules/planning/distribution.ts` (reparto de DBA) y `proposal.ts` (`acceptPlanningProposal`);
  - `modules/generation/planning.ts` (`proposePlanning` y `consumeProposalLimits`: 20 al día y 5
    por minuto);
  - `Topic.dbaCodes` y `GenerationLog.discardedCodes`;
  - UI en `planning/proposal-panel.tsx`.

**Parte 2, hecha (T5 y T6):**

- **Objetivos en bloque:**
  - `modules/generation/objectives-batch.ts` (`proposeObjectivesBatch`). Reutiliza el contrato
    `objective-suggestions.v1` con una llamada por tema (3 a la vez, hasta 12 temas), así que no
    cambia ningún contrato.
  - Cada tema recibe hasta llegar a 3 objetivos; los que ya tienen 3 no se tocan.
  - Se aceptan con `acceptObjectivesBatch` (`modules/planning/proposal.ts`): todo o nada, máximo 5
    por tema.
  - UI en `planning/objectives-batch-panel.tsx`, desde el menú "⋯" de la unidad y del periodo.
- **Recurso con un toque:**
  - `modules/resources/quick.ts` (`createResourceQuick`) arma el mismo blueprint que el asistente
    sin cambios: valores del grado, formato predeterminado y todos los objetivos.
  - En cada tema hay "Crear quiz" y "Crear taller", y "Ajustar antes de crear" en el menú del
    tema.
  - En el menú de la unidad y del periodo: "Crear examen de esta unidad" o "del periodo" y
    "Ajustar examen…".
  - El cupo se revisa antes de llamar a la IA.
- **Pruebas:**
  - `tests/integration/spec-0014.test.ts` (16) y `tests/e2e/spec-0014.spec.ts` (12).
  - Las pruebas de accesibilidad de SPEC-0012 y SPEC-0013 esperan a que terminen las animaciones
    antes de medir el contraste.

**Parte 3, hecha (T7):** la ficha de DBA.

- `components/curriculum/dba-chip.tsx`:
  - `DbaChip`: botón "DBA n" que abre el número, el enunciado, las evidencias y la fuente (documento
    del MEN, versión, año y página, con enlace al PDF). Es un `Dialog`, así que en el teléfono es una
    hoja inferior y se cierra con Escape, Atrás o la X.
  - Recibe el DBA ya leído (`dba`, p. ej. el vínculo de un objetivo con sus evidencias elegidas) o lo
    busca por `code` en `DbaCatalogProvider`; si no lo encuentra, queda solo la etiqueta.
  - `DbaChips` pinta varios códigos.
- El texto sale siempre del catálogo (RN-01). El proveedor recibe los DBA del curso en la
  planeación (`planning.references`), en la página del recurso y en `/create`
  (`getCourseReferences`).
- Va en: objetivos y temas de la planeación, DBA pendientes de la cobertura, propuesta, objetivos
  en bloque, sugerencias, diálogo de objetivo, asistente (taller, quiz y examen) y editores del
  recurso.
- CA-0014-13: cada tema muestra sus DBA (`Topic.dbaCodes` más los de sus objetivos vigentes).
- Pruebas e2e: CA-0014-12/13, CA-0014-10/12 (ficha desde una pregunta del quiz) y CA-0014-22
  (parte 3, axe y 360 px con la ficha abierta).

**Parte 4, hecha (T8):** recursos por periodo y tema.

- `modules/planning/outline.ts` (`listCoursePlans`): periodos, unidades y temas de los cursos del
  docente, también los archivados, en el orden de la planeación. Un curso ajeno no aparece.
- `ResourceSummary.topicIds`: el tema principal y, en un examen, todos sus temas.
- `modules/resources/grouping.ts` (`groupByPlan`, función pura, también en `client.ts`):
  - cada recurso va en el tema donde está hoy (si se movió, se muestra en el lugar nuevo);
  - el examen va en "Exámenes" de su unidad, en "Exámenes del periodo" o en "Exámenes del año";
  - lo de temas o unidades archivados va en "Temas archivados" de su periodo;
  - con `includeEmpty` salen también los temas sin recursos.
- `components/plan-resources.tsx`: un bloque plegable (`<details>`) por periodo, con un
  encabezado "Periodo · Unidad · Tema" por tema.
- "Recursos del curso" (`resources-library.tsx`): los temas sin recursos ofrecen "Crear taller" y
  "Crear quiz" con un toque (`topic-quick-create.tsx`). Sin temas, lleva a la planeación.
- "Mis recursos": arriba los 5 más recientes y debajo cada curso agrupado. Los filtros por tipo y
  por curso siguen igual.
- Pruebas:
  - `tests/unit/resources-grouping.test.ts` (5);
  - integración CA-0014-16/17, con acceso cruzado;
  - e2e CA-0014-14/15/16, CA-0014-17/18 y CA-0014-22 (parte 4).
  - Se ajustaron 3 e2e anteriores que buscaban la lista plana.

**Cierre, hecho (T9 a T12, 2026-11-07):**

- T9: el límite de 20 propuestas al día, compartido con los objetivos en bloque, ya tenía código;
  se agregó su prueba (CA-0014-21).
- T10: un test por CA; se agregaron CA-0014-18 con 30 recursos en 4 periodos y CA-0014-22
  (parte 2) para los objetivos en bloque.
- T11: capturas "después" (§2), con el recorrido en `tests/e2e/spec-0014-capturas.spec.ts`
  (solo con `CAPTURAS=1`); `DbaChip` y `PlanResources` en el sistema de diseño.
- T12: revisión en §14.

**Para retomar en una sesión nueva:**

1. Arrancar la base de datos: `service postgresql start`. En local: `docker compose up -d postgres`.
2. Revisar el repositorio: `git status` y `git log -1`, en la rama de arriba.
3. Leer esta spec (§5, §10, §11 y esta sección) y ADR-0013.
4. Verificar con estos comandos:
   - `npm run lint` y `npm run typecheck`;
   - `LANG=C.UTF-8 npm test`;
   - `cd apps/web && LANG=C.UTF-8 npx playwright test --trace off`;
   - en `apps/ai-engine`: `uv run pytest` y `uv run ruff check .`.
5. Entregar por partes: commit, push a la rama y reporte en español al terminar cada parte.

**Pendiente del usuario (no es código):**

- Despliegue: elegir la base de datos (Supabase Free ya tiene 2 proyectos; hay que pausar uno,
  pasar a Pro u otro proveedor) y si se despliega desde `main` (fusionando el PR) o desde la rama.
- Claves VAPID en Vercel.
- Validación en un iPhone real y recorrido con docentes (SPEC-0013).

## 14. Revisión (2026-11-07, agente `reviewer`)

**Veredicto: Aprobado.** Sin hallazgos bloqueantes.

**Verificación real:**

- lint sin errores, typecheck y build de producción;
- 264 pruebas unitarias y de integración;
- 76 E2E en el build de producción (1 omitida a propósito: el recorrido de capturas);
- las 16 E2E de esta spec también contra `next dev`, sin errores de hidratación;
- AI Engine: 105 pruebas y ruff sin hallazgos.

| Criterios        | Estado    | Prueba (archivo:línea)                                                                                  |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| CA-0014-01/02/03 | Cumplido  | `e2e/spec-0014.spec.ts:39`, `:68`; `integration/spec-0014.test.ts:141`, `:198`                          |
| CA-0014-04/05/06 | Cumplido  | `e2e/spec-0014.spec.ts:115`, `:127`; `integration/spec-0014.test.ts:254`, `:308`, `:332`                |
| CA-0014-07       | Cumplido  | `e2e/spec-0014.spec.ts:158`; `integration/spec-0014.test.ts:359`                                        |
| CA-0014-08/09    | Cumplido  | `e2e/spec-0014.spec.ts:204`, `:225`; `integration/spec-0014.test.ts:546`, `:592`                        |
| CA-0014-10/11    | Cumplido  | `e2e/spec-0014.spec.ts:253`, `:285`; `integration/spec-0014.test.ts:703`, `:733`                        |
| CA-0014-12/13    | Cumplido* | `e2e/spec-0014.spec.ts:253` (recurso), `:302` (planeación, clic, teclado, Escape y Atrás)               |
| CA-0014-14/15/16 | Cumplido  | `e2e/spec-0014.spec.ts:360`; `unit/resources-grouping.test.ts:59`, `:76`, `:85`; `integration/…:818`    |
| CA-0014-17/18    | Cumplido  | `e2e/spec-0014.spec.ts:404`; `unit/resources-grouping.test.ts:156`; `integration/spec-0014.test.ts:818` |
| CA-0014-19       | Cumplido  | `integration/spec-0014.test.ts:175`                                                                     |
| CA-0014-20       | Cumplido  | `integration/spec-0014.test.ts:388`, `:668`, `:784`, `:818` (acceso cruzado)                            |
| CA-0014-21       | Cumplido  | `integration/spec-0014.test.ts:442` (por minuto), `:464` (por día)                                      |
| CA-0014-22       | Cumplido  | `e2e/spec-0014.spec.ts:167`, `:339` y las partes 2 y 4 al final del archivo; suite contra `next dev`    |

\* CA-0014-12: la ficha se prueba en la planeación y en el recurso. La propuesta, los objetivos en
bloque, el diálogo de objetivo y el asistente usan el mismo `DbaChip`. Ahí la prueba solo verifica
que la etiqueta se ve, sin abrir la ficha.

**Reglas globales (AGENTS.md):**

- Autorización y espacio en el servidor:
  - `listCoursePlans` filtra por `institutionId` y por el docente;
  - las fichas de DBA salen de `getCourseReferences`, que valida el curso (`getMyCourse`);
  - "Mis recursos" y "Recursos del curso" siguen filtrando por docente.
- Lo que muestra la ficha de DBA sale del catálogo, nunca de la IA (RN-01).
- La agrupación es una función pura que no consulta la base.
- Límites entre módulos verificados por ESLint: `resources` ya dependía de `planning`. No hay
  dependencias nuevas.
- El contrato con el AI Engine es `generation-planning.v1` (ADR-0013, Aceptado). Las partes 3 y 4
  no cambian el AI Engine.

**Definition of Done:**

- [x] Spec aprobada y criterios cubiertos.
- [x] Permisos en el servidor.
- [x] Pruebas unitarias, de integración y E2E.
- [x] Lint, typecheck y build.
- [x] Documentación: spec, sistema de diseño, `CLAUDE.md` y ADR-0013.
- [x] Revisión sin bloqueantes.
- [x] Sin TODO críticos.

**Observaciones no bloqueantes:**

- "Recursos del curso" muestra todos los temas, también los vacíos, con sus botones. Con un año
  entero planeado la página es larga; los periodos se pueden plegar. Se puede ver en el recorrido
  con docentes.
- CA-0013-20 (SPEC-0013) falló 2 veces de 4 con la suite completa en paralelo y pasó sola cada vez.
  Parece intermitente por carga; conviene vigilarlo.

**Pendiente fuera del código:** el recorrido con 2–3 docentes, junto con el de SPEC-0013.
