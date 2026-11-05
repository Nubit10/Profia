# SPEC-0013 — Profe más fácil: menos pasos en los cuatro flujos del docente

| Campo                    | Valor                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estado                   | Borrador                                                                                                                                                |
| Fase del roadmap         | Transversal · UX (continúa SPEC-0012; no la reemplaza)                                                                                                  |
| Módulo(s) responsable(s) | `apps/web/app` (vistas), `apps/web/components`; `modules/auth` (sesión tras el registro); `modules/documents` (descarga en paquete); `modules/planning` |
| Agentes                  | product, frontend, backend, auth-security, documents, qa, reviewer                                                                                      |
| ADR relacionados         | Ninguno nuevo (ver §9). Se apoya en ADR-0008 (generación en segundo plano) y ADR-0009 (documentos)                                                      |
| Autor / Fecha            | product / 2026-11-05                                                                                                                                    |

## 1. Objetivo

SPEC-0012 le dio a Profe una cara nueva y un asistente para crear. Al recorrer la app real todavía
quedan pasos que sobran: el docente se registra y tiene que volver a escribir su correo y su
contraseña, para su primer taller pasa por tres diálogos de planeación, guarda cada cambio con tres
clics y descarga la hoja y la clave en dos viajes al menú. Esta spec quita esos pasos para que un
docente sin experiencia técnica vaya de "crear cuenta" a "taller descargado" sin ayuda y con el
menor número de clics posible.

## 2. Evidencia: recorrido del 2026-11-05

Recorrido automatizado con Playwright sobre el build de producción, con el AI Engine en modo de
prueba (generación instantánea) y una pantalla de 1366×860 y de 390×844. Capturas en
`docs/design/capturas/spec-0013/`.

| Id   | Flujo       | Fricción observada                                                                                                                                                                                                                                                                | Evidencia                                                           |
| ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| F-01 | Primer uso  | Después de "Crear cuenta" el docente llega al login y escribe otra vez correo y contraseña. Registro → Inicio: **6 campos y 4 clics**, 2 de esos campos repetidos.                                                                                                                | `01-login-tras-registro.png`                                        |
| F-02 | Primer uso  | El Inicio muestra **cuatro llamados a la acción a la vez**: el tutorial (con su "Siguiente"), la tarjeta "Siguiente paso", "Crear rápido" (3 opciones) y el estado vacío "Crear un quiz". El tutorial va arriba y empuja el siguiente paso.                                       | `02-inicio-con-curso.png`                                           |
| F-03 | Curso       | Con un curso y sin temas, el siguiente paso es "Planear ahora", que lleva a la planeación completa, aunque el asistente ya permite escribir un tema nuevo sin salir de él.                                                                                                        | `02-inicio-con-curso.png`, `05-asistente-curso-y-tema.png`          |
| F-04 | Planeación  | Curso → unidad → tema → objetivo con DBA: **14 clics, 4 campos y 4 diálogos**. En el objetivo hay que leer y marcar a mano entre 12 DBA de varias líneas cada uno.                                                                                                                | `03-dialogo-objetivo.png`                                           |
| F-05 | Planeación  | Con 1 unidad, 1 tema y 1 objetivo hay **12 iconos de acción siempre visibles** (editar, subir, bajar, archivar ×3) más 2 "Crear examen". Los periodos 2 a 4 vacíos ocupan media pantalla.                                                                                         | `04-planeacion.png`                                                 |
| F-06 | Crear       | Con un solo curso y un solo tema, el asistente igual pide elegirlos. Inicio → "Generar quiz" por el menú Crear: **6 clics**. El paso de ajustes del quiz muestra **16 controles**.                                                                                                | `05-asistente-curso-y-tema.png`, `06-asistente-confirmar.png`       |
| F-07 | Crear       | Con Groq real un recurso tarda de segundos a ~1 min, y un examen varios. Si el docente sale de la página no hay aviso cuando termina; tiene que volver a "Mis recursos" a ver.                                                                                                    | ADR-0008; `RESOURCE_TIMEOUT_MS = 240 000` en `generation/engine.ts` |
| F-08 | Revisar     | Cambiar una pregunta: Editar → cambiar → "Listo" → "Guardar cambios" (**3 clics** y bajar hasta la barra). Un quiz de 8 preguntas mide **2849 px** y tiene **~72 controles** (9 por pregunta, todos visibles).                                                                    | `07-recurso-descargar.png`                                          |
| F-09 | Descargar   | La hoja y la clave salen en **dos viajes al menú** (4 clics). El número de versiones A–D está fuera del menú. Si el recurso sigue en Borrador, el PDF sale con la marca de agua "BORRADOR" sin que el menú lo avise.                                                              | `07-recurso-descargar.png`; `render-pdf.ts` (watermark)             |
| F-10 | Móvil       | En 390 px el encabezado del recurso ocupa 4 filas (estado, versiones, Descargar y "⋯" solo en una fila) antes de la primera pregunta.                                                                                                                                             | `08-recurso-movil.png`                                              |
| F-11 | Transversal | El docente reportó una "página de error" al tener talleres o quices. Causa: la fecha de la lista de recursos se formateaba distinto en el servidor y en el navegador (error de hidratación). **Ya corregido** (`lib/dates.ts`) con una guardia en los E2E; aquí queda como regla. | commit "Corrige la página de error…"                                |

## 3. Alcance

**Incluye:**

- **Primer uso:** sesión iniciada al crear la cuenta (F-01). Un solo bloque de "Primeros pasos" en
  el Inicio que reúne el tutorial y el siguiente paso, con progreso (F-02).
- **Curso y planeación:** desde el Inicio, el primer tema se escribe en el asistente (F-03).
  Sugerencia de DBA al escribir un objetivo, ya marcados para que el docente confirme (F-04). Las
  acciones de unidad, tema y objetivo pasan a un menú "⋯"; los periodos vacíos se pliegan (F-05).
- **Crear:** curso y tema elegidos solos cuando solo hay uno; ajustes básicos a la vista y el resto
  en "Más opciones"; generar desde los ajustes, con el resumen en el mismo paso (F-06). Aviso en
  cualquier página cuando un recurso termina o falla, y contador "generándose" en el menú (F-07).
- **Revisar y descargar:** "Listo" guarda el ítem (sin "Guardar cambios" aparte); acciones
  secundarias del ítem en un menú "⋯"; vista compacta de solo enunciados (F-08). Un diálogo
  "Descargar" con formato, qué incluir y versiones, que baja todo en un archivo; aviso de borrador
  con "Marcar como listo y descargar" (F-09). Barra de acciones fija abajo en móvil (F-10).
- **Regla de hidratación** (F-11) como criterio permanente.

**No incluye (explícitamente):**

- Cambiar el sistema de diseño, la paleta o el menú lateral de SPEC-0012.
- Cambios en el AI Engine, sus contratos o los prompts. El progreso de la generación se muestra con
  el estado que ya existe en PostgreSQL (ADR-0008), no por etapas del modelo.
- Notificaciones por correo o push del sistema operativo.
- Nuevos tipos de recurso (planes de aula) ni formatos propios para quiz y examen.
- Recorrido guiado con el usuario real (sigue pendiente desde SPEC-0012; ver §12).

## 4. Actores y permisos

| Actor                     | Puede                                                | No puede                                                             |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Visitante                 | Crear cuenta y quedar con sesión iniciada            | Entrar al área de trabajo sin cuenta                                 |
| Docente                   | Todo lo de §3 sobre sus cursos y recursos            | Ver avisos o descargas de recursos de otro docente o de otro espacio |
| Administrador del colegio | Lo mismo que hoy (no crea recursos si no es docente) | Recibir avisos de generación de los docentes                         |

## 5. Reglas de negocio

- **RN-01 — Sesión tras el registro.** Crear la cuenta inicia la sesión con las mismas reglas de
  `requireUser()` y el mismo límite de intentos por IP de SPEC-0001; el docente llega directo a
  `/onboarding`. Si iniciar la sesión falla, se cae al login de hoy con el correo ya escrito.
- **RN-02 — Un solo llamado principal en el Inicio.** "Primeros pasos" reemplaza la tarjeta de
  tutorial y la tarjeta "Siguiente paso" mientras el docente no complete los cuatro pasos (curso →
  tema → primer recurso → primera descarga). Al completarlos desaparece y queda "Siguiente paso"
  de SPEC-0012. El progreso se calcula en el servidor (RN-02 de SPEC-0012).
- **RN-03 — Nada se omite en silencio.** Elegir curso o tema solo vale cuando hay exactamente uno;
  el paso se muestra resuelto ("Para: Matemáticas · 6° · 601 · La recta numérica — Cambiar") y no se
  salta sin dejar rastro.
- **RN-04 — Los DBA sugeridos los confirma el docente.** Al escribir un objetivo, Profe marca hasta
  3 DBA del curso usando la búsqueda curricular que ya existe (SPEC-0005). Quedan marcados como
  "Sugerido" y el docente puede quitarlos. Si la búsqueda falla, el diálogo funciona como hoy.
  Nunca se guarda un objetivo con DBA que el docente no vio.
- **RN-05 — Una versión por cambio confirmado.** "Listo" en un ítem guarda una versión nueva del
  recurso (SPEC-0008 RN de versiones). Varios "Listo" seguidos en menos de 60 s del mismo docente
  sobre el mismo recurso se agrupan en una sola versión (ver pregunta abierta 2).
- **RN-06 — Descarga en un archivo.** Si el docente pide más de un documento (hoja + clave, o varias
  versiones), recibe un solo `.zip` con los archivos y los mismos nombres de SPEC-0009. Un solo
  documento se descarga suelto, como hoy. El diálogo recuerda formato y opciones por docente en el
  navegador (preferencia de UI, no dato de dominio).
- **RN-07 — El borrador se avisa antes, no después.** Si el recurso está en Borrador, el diálogo de
  descarga lo dice y ofrece "Marcar como listo y descargar" o "Descargar con marca de borrador".
  Marcar como listo sigue siendo una acción explícita del docente (teacher-in-control).
- **RN-08 — Avisos de generación propios.** El aviso de "listo" o "falló" solo se muestra al
  docente que pidió el recurso y en el espacio donde lo pidió. Se obtiene consultando el estado en
  el servidor; no hay canal nuevo (ver §9).
- **RN-09 — Sin errores de hidratación.** Ningún texto que dependa de la zona horaria, el idioma o la
  hora actual se formatea distinto en servidor y navegador. Las fechas visibles usan `lib/dates.ts`.
- **RN-10 — Lo que ya cumple SPEC-0012 se mantiene.** Un botón primario por pantalla, glosario sin
  jerga técnica, WCAG 2.1 AA, 360 px sin scroll horizontal.

## 6. Entradas

- Registro: los 4 campos de hoy (nombre, correo, contraseña, confirmación).
- Objetivo: texto del objetivo → consulta a `modules/curriculum` (búsqueda existente, con el grado
  y el área del curso). Respuesta: hasta 3 códigos de DBA.
- Descarga: `{ docs: ("student" | "key" | "answers")[], format: "pdf" | "docx", variants: 1–4,
version }` validado con Zod en el servidor. Mínimo 1 documento.
- Avisos: consulta periódica del estado de los recursos del docente en `GENERATING` (solo mientras
  haya alguno).

## 7. Salidas

- Sesión creada tras el registro (cookie de NextAuth de hoy).
- `.zip` con los documentos pedidos, o un solo archivo si es uno.
- Versión nueva del recurso por cada "Listo" (o agrupada, RN-05).
- Auditoría: `resource.exported` por cada documento del paquete, como hoy.

## 8. Errores y casos límite

| Caso                                                       | Comportamiento esperado                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| El registro funciona pero iniciar sesión falla             | Login de hoy con el correo ya escrito y el aviso "Tu cuenta quedó creada; ingresa."              |
| La búsqueda de DBA no responde                             | El diálogo de objetivo funciona como hoy, sin sugeridos y sin error visible                      |
| El docente quita todos los DBA sugeridos                   | Se guarda igual que hoy (el objetivo puede no tener DBA)                                         |
| Falla un documento dentro del paquete                      | No se entrega un zip incompleto: mensaje "No pudimos preparar la descarga" y se puede reintentar |
| El docente cierra la pestaña mientras el recurso se genera | Al volver a cualquier página ve el aviso del resultado una sola vez                              |
| Dos pestañas abiertas                                      | El aviso puede salir en ambas; no se duplica la acción                                           |
| "Listo" sin cambios                                        | No crea versión                                                                                  |
| Recurso archivado                                          | Sin diálogo de descarga (igual que hoy)                                                          |

## 9. Seguridad y privacidad

- La sesión tras el registro reutiliza `signIn` de NextAuth con las mismas validaciones; no se crea
  otra vía de autenticación. Revisa el agente `auth-security`.
- La descarga en paquete pasa por `exportResource` para cada documento: mismo `requireRole`, mismo
  filtro por `ctx.institutionId` y respuesta 404 para recursos ajenos (test de acceso cruzado).
- Los avisos consultan solo recursos del `membershipId` actual.
- El zip se arma en memoria con `jszip`, que ya es dependencia directa de `apps/web`: **no hace falta
  ADR**. Sin almacenamiento en disco (SPEC-0009).
- La sugerencia de DBA envía al AI Engine solo el texto del objetivo, el área y el grado, como la
  búsqueda curricular de hoy. El texto pasa por `redactContactData`.
- Al estar en Vercel con `maxDuration = 300`, un paquete con 4 versiones × 2 documentos debe
  generarse en menos de 30 s (ver CA-0013-14).

## 10. Criterios de aceptación

Los clics se cuentan como en CA-0012-07: solo clics del usuario, sin contar escribir.

**Primer uso e Inicio**

- **CA-0013-01:** Dado un visitante en `/register`, cuando llena los 4 campos y pulsa "Crear cuenta",
  entonces llega a `/onboarding` con la sesión iniciada, sin pasar por el login. Registro → Inicio:
  4 campos y **2 clics o menos** (antes 6 campos y 4 clics, F-01).
- **CA-0013-02:** Dado un docente nuevo en el Inicio, cuando lo carga, entonces ve un solo bloque
  "Primeros pasos" con 4 pasos y su progreso, y no ve a la vez la tarjeta de tutorial ni otra
  tarjeta de siguiente paso. En `main` hay como máximo un botón primario (F-02).
- **CA-0013-03:** Dado un docente que completó los 4 pasos, cuando vuelve al Inicio, entonces
  "Primeros pasos" ya no está y ve "Siguiente paso" (CA-0012-05 sigue pasando).

**Curso y planeación**

- **CA-0013-04:** Dado un docente con un curso sin temas, cuando sigue "Primeros pasos", entonces
  escribe el tema dentro del asistente y llega a "Generar taller" sin abrir la planeación.
  Inicio → generar: **3 clics o menos** más escribir el tema (F-03).
- **CA-0013-05:** Dado el diálogo "Agregar objetivo", cuando el docente escribe "Compara números
  enteros usando la recta numérica" en Matemáticas 6°, entonces en menos de 3 s aparece el DBA 1
  marcado como "Sugerido", y crear el objetivo toma **1 clic** después de escribir (antes 2, F-04).
- **CA-0013-06:** Dado el AI Engine apagado, cuando el docente abre "Agregar objetivo", entonces el
  diálogo funciona como hoy y no muestra errores.
- **CA-0013-07:** Dada la planeación con 1 unidad, 1 tema y 1 objetivo, cuando se cuentan los
  controles visibles sin abrir menús, entonces hay **4 o menos** (antes 14, F-05), y cada acción
  (editar, subir, bajar, archivar, crear examen) sigue disponible desde "⋯" con teclado.
- **CA-0013-08:** Dado un curso con periodos vacíos, cuando se abre la planeación, entonces cada
  periodo vacío ocupa una sola línea con "Agregar unidad".

**Crear**

- **CA-0013-09:** Dado un docente con un solo curso y un solo tema, cuando abre "Crear → Quiz",
  entonces el curso y el tema ya están elegidos y visibles con "Cambiar", y llega a "Generar quiz"
  en **3 clics o menos** desde el Inicio (antes 6, F-06).
- **CA-0013-10:** Dado el paso de ajustes del quiz, cuando se carga, entonces muestra **6 controles o
  menos** a la vista (cantidad, duración, dificultad, tipos de pregunta) y el resto en "Más
  opciones", con el resumen y "Generar" en el mismo paso. CA-0012-08 (no pierde datos) sigue pasando.
- **CA-0013-11:** Dado un recurso en generación y el docente en otra página del área de trabajo,
  cuando la generación termina, entonces ve un aviso "Tu quiz está listo" con "Abrir" en menos de
  10 s, una sola vez. Si falla, el aviso dice que falló y ofrece "Reintentar" (F-07).
- **CA-0013-12:** Dado un recurso en generación, cuando el docente mira el menú lateral, entonces ve
  "1 generándose" junto a "Mis recursos". Otro docente del mismo colegio no ve ese contador (test de
  acceso cruzado).

**Revisar y descargar**

- **CA-0013-13:** Dado un quiz, cuando el docente edita el enunciado de una pregunta y pulsa
  "Listo", entonces el cambio queda guardado en una versión nueva sin pulsar "Guardar cambios":
  **2 clics** por cambio (antes 3, F-08). Recargar la página muestra el cambio.
- **CA-0013-14:** Dado un quiz en estado Listo, cuando el docente abre "Descargar", elige PDF, hoja y
  clave y 2 versiones, y confirma, entonces recibe **un archivo** `.zip` con 4 PDF nombrados como en
  SPEC-0009, en **3 clics o menos** (antes 2 viajes, sin versiones), y en menos de 30 s.
- **CA-0013-15:** Dado un recurso en Borrador, cuando el docente abre "Descargar", entonces ve el
  aviso de borrador con "Marcar como listo y descargar"; elegirlo deja el recurso en Listo y el PDF
  sin la marca "BORRADOR" (F-09).
- **CA-0013-16:** Dado un recurso de otro docente, cuando se pide su paquete de descarga por URL,
  entonces responde 404 (igual que CA-0009-06).
- **CA-0013-17:** Dado un quiz de 8 preguntas, cuando el docente activa "Vista compacta", entonces
  la página mide la mitad o menos de la vista completa y conserva el orden y la numeración.
- **CA-0013-18:** Dado un recurso a 390 px, cuando se carga, entonces "Descargar" está en una barra
  fija abajo y la primera pregunta se ve sin hacer scroll (F-10).

**Transversal**

- **CA-0013-19:** Dada la suite E2E (incluida la guardia de `tests/e2e/fixtures.ts`), cuando corre
  en modo desarrollo y en build de producción, entonces no hay errores de hidratación en ninguna
  pantalla (RN-09, F-11).
- **CA-0013-20:** Dadas las pantallas que cambian (Inicio, planeación, asistente, recurso, diálogo
  de descarga), cuando se analizan con axe-core, entonces no hay violaciones WCAG 2.1 A ni AA, y a
  360 px no hay scroll horizontal (RN-10).
- **CA-0013-21:** Dada la suite E2E existente, cuando corre, entonces pasa; los selectores solo
  cambian por textos o pasos que esta spec modifica.

## 11. Tareas

- [ ] T1 — Sesión tras el registro (RN-01, CA-01) — auth-security
- [ ] T2 — "Primeros pasos" en el Inicio, cálculo en servidor (RN-02, CA-02/03) — backend + frontend
- [ ] T3 — Primer tema desde "Primeros pasos" al asistente (CA-04) — frontend
- [ ] T4 — DBA sugeridos en el diálogo de objetivo (RN-04, CA-05/06) — backend (planning + curriculum) + frontend
- [ ] T5 — Planeación compacta: menú "⋯" y periodos vacíos plegados (CA-07/08) — frontend
- [ ] T6 — Asistente: autoselección y ajustes con "Más opciones" + resumen en el mismo paso (RN-03, CA-09/10) — frontend
- [ ] T7 — Avisos de generación y contador en el menú (RN-08, CA-11/12) — backend + frontend
- [ ] T8 — "Listo" guarda el ítem; agrupación de versiones (RN-05, CA-13) — backend (resources) + frontend
- [ ] T9 — Diálogo de descarga y paquete `.zip` (RN-06/07, CA-14/15/16) — documents + frontend
- [ ] T10 — Vista compacta y barra fija en móvil (CA-17/18) — frontend
- [ ] T11 — Tests: un E2E por CA con su ID, conteo de clics, axe y 360 px; acceso cruzado (CA-12/16); correr la suite también contra `next dev` (CA-19) — qa
- [ ] T12 — Capturas antes/después en `docs/design/capturas/spec-0013/` y actualizar `docs/design/sistema-de-diseno.md` — frontend
- [ ] T13 — Revisión contra la spec y DoD — reviewer

## 12. Preguntas abiertas

1. **Descarga múltiple:** ¿un `.zip` (recomendado: un solo archivo, funciona en todos los
   navegadores) o un PDF/Word único con hoja y clave una tras otra (más fácil de imprimir, pero
   mezcla clave y hoja en el mismo archivo)?
2. **Versiones al editar:** con "Listo" guardando cada cambio, ¿agrupamos los cambios hechos en menos
   de 60 s en una sola versión (recomendado, evita decenas de versiones), o una versión por cada
   "Listo"?
3. **Avisos de generación:** ¿basta con el aviso dentro de Profe (recomendado para esta spec), o
   quieres también la notificación del navegador cuando el docente está en otra pestaña (requiere
   pedir permiso al docente)?
4. **"Primeros pasos":** ¿cuenta "primera descarga" como el cuarto paso (recomendado: es el momento
   en que el docente obtiene valor) o termina en "primer recurso"?
5. **DBA sugeridos:** ¿máximo 3 marcados por defecto (recomendado) o solo el mejor?
6. **Recorrido con docentes:** SPEC-0012 dejó pendiente el recorrido guiado con un usuario real. ¿Lo
   hacemos antes de implementar (para confirmar estas fricciones con 2–3 docentes) o después, como
   validación?
