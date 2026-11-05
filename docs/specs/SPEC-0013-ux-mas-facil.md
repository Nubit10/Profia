# SPEC-0013 — Profe más fácil: menos pasos, hecho para el celular e instalable

| Campo                    | Valor                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estado                   | En revisión                                                                                                                                             |
| Fase del roadmap         | Transversal · UX (continúa SPEC-0012; no la reemplaza)                                                                                                  |
| Módulo(s) responsable(s) | `apps/web/app` (vistas), `apps/web/components`; `modules/auth` (sesión tras el registro); `modules/documents` (descarga en paquete); `modules/planning` |
| Agentes                  | product, frontend, backend, auth-security, documents, qa, reviewer                                                                                      |
| ADR relacionados         | **ADR-0012 (propuesto): app instalable** (ver §9). Se apoya en ADR-0008 (generación en segundo plano) y ADR-0009 (documentos)                           |
| Autor / Fecha            | product / 2026-11-05                                                                                                                                    |

## 1. Objetivo

SPEC-0012 le dio a Profe una cara nueva y un asistente para crear. Al recorrer la app real todavía
quedan pasos que sobran: el docente se registra y tiene que volver a escribir su correo y su
contraseña, para su primer taller pasa por tres diálogos de planeación, guarda cada cambio con tres
clics y descarga la hoja y la clave en dos viajes al menú. Esta spec quita esos pasos para que un
docente sin experiencia técnica vaya de "crear cuenta" a "taller descargado" sin ayuda y con el
menor número de clics posible.

Además, Profe tiene que funcionar **perfecto en el celular** y **poder instalarse** en la pantalla
de inicio como una app, igual que Terram (otro producto del mismo equipo): una sola barra de
acciones abajo, formularios que suben desde abajo, el botón Atrás del teléfono cierra lo que se
abrió, botones del tamaño del dedo y un ícono propio que abre Profe a pantalla completa.

## 2. Evidencia: recorrido del 2026-11-05

Recorrido automatizado con Playwright sobre el build de producción, con el AI Engine en modo de
prueba (generación instantánea), en escritorio (1366×860) y en un iPhone 13 emulado (390×844,
táctil). Capturas en `docs/design/capturas/spec-0013/` (01–08 escritorio, 09–13 celular).

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
| F-10 | Móvil       | En 390 px el encabezado del recurso ocupa 4 filas (estado, versiones, Descargar y "⋯" solo en una fila) antes de la primera pregunta. La página mide **3451 px** (3896 px al editar una pregunta).                                                                                | `08-recurso-movil.png`, `12-movil-recurso.png`                      |
| F-12 | Móvil       | Con un formulario abierto ("Nuevo curso"), el botón **Atrás del teléfono no lo cierra: saca al docente de la página** y pierde lo escrito.                                                                                                                                        | recorrido en celular                                                |
| F-13 | Móvil       | Los formularios son ventanas centradas (113 px arriba y abajo libres), no hojas que suben desde abajo. "Objetivo de aprendizaje" mide 598 px con scroll interno: "Crear objetivo" queda debajo de los 12 DBA, fuera del alcance del pulgar.                                       | `09-movil-dialogo-curso.png`, `10-movil-dialogo-objetivo.png`       |
| F-14 | Móvil       | **Entre 5 y 24 controles por pantalla miden menos de 44×44 px** (el mínimo para el dedo): iconos de planeación de 28×28, "Cerrar" de 28×28, pestañas y botones de 36 px.                                                                                                          | recorrido en celular (medido en cada pantalla)                      |
| F-15 | Móvil       | En el curso el título se parte en 3 líneas ("Matemáticas / · 6° · / 601") por el botón "Crear con IA" al lado, y las pestañas se cortan ("DBA y Es") sin señal de que hay más.                                                                                                    | `11-movil-curso.png`                                                |
| F-16 | Instalable  | Profe **no se puede instalar**: no hay manifiesto (`/manifest.webmanifest` responde 404), ni íconos de app, ni service worker. En el celular siempre es una pestaña del navegador. Terram sí se instala (`app/manifest.ts`, `public/sw.js`).                                      | `curl /manifest.webmanifest` → 404                                  |
| F-17 | Móvil       | No hay pantallas de carga (`loading.tsx`): con mala señal, al tocar un enlace la pantalla anterior se queda quieta y el docente vuelve a tocar.                                                                                                                                   | `find app -name loading.tsx` sin resultados                         |
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
- **Celular primero, como Terram** (F-12 a F-15, F-17): barra inferior única con las acciones de la
  pantalla; formularios como hoja que sube desde abajo en el celular (ventana centrada en
  escritorio); el botón Atrás cierra hojas, menús y diálogos; todo control táctil de 44×44 px o más;
  áreas seguras del teléfono (`env(safe-area-inset-*)`); encabezado del curso y pestañas que caben
  en 390 px; pantallas de carga en las rutas que consultan datos.
- **App instalable** (F-16): manifiesto, íconos (192, 512 y "maskable", ícono de Apple), color de
  la barra del sistema, service worker mínimo, página "Sin conexión" y la opción "Instalar Profe"
  en el menú (en iPhone, con la explicación de "Compartir → Agregar a pantalla de inicio").
- **Regla de hidratación** (F-11) como criterio permanente.

**No incluye (explícitamente):**

- Cambiar el sistema de diseño, la paleta o el menú lateral de SPEC-0012.
- Cambios en el AI Engine, sus contratos o los prompts. El progreso de la generación se muestra con
  el estado que ya existe en PostgreSQL (ADR-0008), no por etapas del modelo.
- Notificaciones por correo o push del sistema operativo (Terram las tiene; aquí no hacen falta
  todavía).
- Usar Profe sin conexión: sin señal solo se muestra "Sin conexión" (RN-13, decisión 9).
- App nativa en tiendas (AGENTS.md: "No construir app móvil nativa").
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
  sobre el mismo recurso se agrupan en una sola versión (decisión 2).
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
- **RN-11 — Celular primero (patrón de Terram).** El tamaño de referencia es 390×844.
  - Una sola barra inferior por pantalla con sus acciones; nada más flota abajo. Los elementos
    flotantes (barra, avisos, hojas) llevan `data-floating` y nunca se tapan entre sí.
  - Los formularios se abren como hoja inferior debajo de `md` y como ventana centrada desde `md`,
    con el botón principal siempre visible al final de la hoja.
  - Toda capa que se abre (hoja, menú lateral, menú de opciones, diálogo) agrega una entrada al
    historial: Atrás o Escape la cierran sin cambiar de página. El menú lateral se cierra al
    navegar.
  - Todo control táctil mide al menos 44×44 px (salvo enlaces dentro de un párrafo).
  - El contenido respeta `env(safe-area-inset-*)`; las rejillas declaran `grid-cols-1` de base y
    las filas de pestañas o chips se desplazan con flechas o arrastre y muestran que hay más.
  - Cada ruta que carga datos tiene `loading.tsx` con un esqueleto.
- **RN-12 — Profe se instala como app (patrón de CliqCut-Web y Terram, ADR-0012).**
  - `app/manifest.ts` declara nombre "Profe", `display: standalone`, `scope: /`,
    `start_url: /dashboard` (como CliqCut abre el panel de quien trabaja; sin sesión, `proxy.ts`
    lleva al login y vuelve), `lang: es-CO`, colores desde los tokens de marca e íconos 192 y 512
    "any maskable". El layout raíz declara `appleWebApp` (`capable`, título "Profe"), el ícono de
    Apple y `themeColor` en el viewport.
  - El ícono es el logo actual de Profe (el birrete) sobre un cuadro con el degradado de marca, en
    PNG de 512 px con el logo dentro de la zona segura de "maskable" (como el `logo-tile.png` de
    CliqCut), y una versión de 192 px.
  - La opción "Instalar Profe" del menú usa el aviso del navegador donde existe (Chrome, Edge,
    Android) y en iPhone o iPad explica "Compartir → Agregar a pantalla de inicio". No aparece si
    Profe ya está instalado (`display-mode: standalone`) ni en navegadores que no pueden instalarla.
  - Abierta como app, ninguna pantalla depende de los botones del navegador: siempre hay una forma
    visible de volver.
- **RN-13 — El service worker no guarda datos del docente.** Como en CliqCut, `public/sw.js` es
  mínimo y no guarda en caché páginas, acciones ni descargas: todo va a la red. Lo único que guarda
  es la página estática "Sin conexión" (sin datos de nadie), para que sin señal una navegación
  muestre "Sin conexión" con "Reintentar" y no la pantalla de error del navegador.

## 6. Entradas

- Registro: los 4 campos de hoy (nombre, correo, contraseña, confirmación).
- Objetivo: texto del objetivo → consulta a `modules/curriculum` (búsqueda existente, con el grado
  y el área del curso). Respuesta: hasta 3 códigos de DBA.
- Descarga: `{ docs: ("student" | "key" | "answers")[], format: "pdf" | "docx", variants: 1–4,
version }` validado con Zod en el servidor. Mínimo 1 documento.
- Avisos: consulta periódica del estado de los recursos del docente en `GENERATING` (solo mientras
  haya alguno).
- Instalación: el evento `beforeinstallprompt` del navegador (donde existe) y el modo de pantalla
  (`display-mode`). Nada de esto se envía al servidor.

## 7. Salidas

- Sesión creada tras el registro (cookie de NextAuth de hoy).
- `.zip` con los documentos pedidos, o un solo archivo si es uno.
- Versión nueva del recurso por cada "Listo" (o agrupada, RN-05).
- Auditoría: `resource.exported` por cada documento del paquete, como hoy.
- `/manifest.webmanifest`, íconos de la app, `/sw.js` y la página "Sin conexión".

## 8. Errores y casos límite

| Caso                                                             | Comportamiento esperado                                                                                                                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El registro funciona pero iniciar sesión falla                   | Login de hoy con el correo ya escrito y el aviso "Tu cuenta quedó creada; ingresa."                                                                                                     |
| La búsqueda de DBA no responde                                   | El diálogo de objetivo funciona como hoy, sin sugeridos y sin error visible                                                                                                             |
| El docente quita todos los DBA sugeridos                         | Se guarda igual que hoy (el objetivo puede no tener DBA)                                                                                                                                |
| Falla un documento dentro del paquete                            | No se entrega un zip incompleto: mensaje "No pudimos preparar la descarga" y se puede reintentar                                                                                        |
| El docente cierra la pestaña mientras el recurso se genera       | Al volver a cualquier página ve el aviso del resultado una sola vez                                                                                                                     |
| Dos pestañas abiertas                                            | El aviso puede salir en ambas; no se duplica la acción                                                                                                                                  |
| "Listo" sin cambios                                              | No crea versión                                                                                                                                                                         |
| Recurso archivado                                                | Sin diálogo de descarga (igual que hoy)                                                                                                                                                 |
| Navegador que no permite instalar (p. ej. Firefox de escritorio) | No aparece "Instalar Profe"; Profe funciona igual en la pestaña                                                                                                                         |
| Profe instalado en iPhone y el docente descarga un Word o PDF    | Se abre la vista previa del sistema con "Compartir" para guardarlo o abrirlo en Word; el docente vuelve a Profe sin perder la página (validación manual en un iPhone real, decisión 10) |
| Se publica una versión nueva de Profe                            | El service worker nuevo toma el control en la siguiente navegación; nunca sirve archivos de una versión vieja con HTML nuevo                                                            |
| El docente cierra sesión en la app instalada                     | Vuelve al login; como el service worker no guarda datos del docente, no queda nada que borrar                                                                                           |

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
- **App instalable (ADR-0012, propuesto):** el service worker es una pieza nueva del navegador,
  así que se documenta en un ADR aunque no agrega dependencias (manifiesto nativo de Next y un
  `public/sw.js` escrito a mano, como Terram). El ADR fija: qué se guarda en caché (RN-13), alcance
  `/`, cómo se actualiza al desplegar y que no se guardan datos de docentes ni de recursos.
- El manifiesto y el service worker son públicos y no contienen datos de nadie.

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

**Celular** (proyecto de Playwright con iPhone 13 emulado, 390×844 y táctil)

- **CA-0013-22:** Dado cualquier formulario, menú lateral o menú de opciones abierto en el celular,
  cuando el docente toca Atrás, entonces la capa se cierra y la URL no cambia (antes salía de la
  página, F-12).
- **CA-0013-23:** Dados los formularios de curso, unidad, tema y objetivo en el celular, cuando se
  abren, entonces quedan pegados abajo (0 px al borde inferior, respetando el área segura) y su
  botón principal se ve sin hacer scroll dentro de la hoja (F-13).
- **CA-0013-24:** Dadas las pantallas principales (Inicio, Mis cursos, curso, asistente, recurso,
  Mis recursos, Formatos) en el celular, cuando se miden los controles táctiles visibles, entonces
  **ninguno mide menos de 44×44 px**, salvo enlaces dentro de un párrafo (antes 5–24 por pantalla,
  F-14).
- **CA-0013-25:** Dado el curso "Matemáticas · 6° · 601" en 390 px, cuando se carga, entonces el
  título ocupa 2 líneas o menos y la fila de pestañas indica que hay más y se desplaza con el dedo
  (F-15).
- **CA-0013-26:** Dada cualquier pantalla del celular, cuando se revisan los elementos con
  `data-floating`, entonces ninguno se sobrepone a otro (barra inferior, avisos, hojas).
- **CA-0013-27:** Dada una conexión lenta (Playwright con latencia de 2 s), cuando el docente toca
  "Mis cursos", "Mis recursos" o un curso, entonces en menos de 300 ms ve el esqueleto de carga de
  esa pantalla (F-17).

**App instalable**

- **CA-0013-28:** Dado Profe en producción, cuando Chrome revisa si se puede instalar
  (`Page.getInstallabilityErrors` por CDP), entonces no hay errores; `/manifest.webmanifest` trae
  nombre, `display: standalone`, `start_url`, colores e íconos 192, 512 y "maskable", y cada ícono
  responde 200 con su tamaño real (F-16).
- **CA-0013-29:** Dado Chrome con el aviso de instalación disponible, cuando el docente abre el
  menú, entonces ve "Instalar Profe" y al tocarlo se abre el aviso del navegador. Con un agente de
  iPhone ve la explicación de "Agregar a pantalla de inicio". Con `display-mode: standalone` la
  opción no aparece.
- **CA-0013-30:** Dado Profe abierto con el service worker activo, cuando se corta la red y el
  docente navega, entonces ve "Sin conexión" con "Reintentar"; y la caché del navegador no contiene
  ninguna respuesta de `/courses`, `/resources`, `/dashboard` ni de descargas (RN-13).
- **CA-0013-31:** Dado Profe abierto como app (`display-mode: standalone`), cuando el docente
  recorre Inicio → curso → recurso → Inicio, entonces lo logra sin los botones del navegador y el
  contenido no queda debajo de la barra de estado ni de la barra de gestos (áreas seguras).

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
- [ ] T13 — ADR-0012 "App instalable": caché, alcance, actualización al desplegar, sin datos del docente — architect
- [ ] T14 — Piezas de celular en `components/ui`: hoja inferior/ventana según tamaño, `useBackToClose`, barra inferior, cajón y desplazador de pestañas (patrón de Terram) — frontend
- [ ] T15 — Pasar los formularios y menús a esas piezas; controles de 44 px; encabezado del curso y pestañas; `loading.tsx` con esqueletos (RN-11, CA-22 a 27) — frontend
- [ ] T16 — Manifiesto, íconos desde el logo, `themeColor`, `public/sw.js`, página "Sin conexión" y "Instalar Profe" (RN-12/13, CA-28 a 31) — frontend + devops
- [ ] T17 — Proyecto de Playwright "iPhone 13" que corre los E2E de esta spec en el celular, con la revisión de `data-floating` y de controles de 44 px — qa
- [ ] T18 — Revisión contra la spec y DoD — reviewer

## 12. Decisiones (resueltas por el usuario el 2026-11-05)

Las preguntas 1 a 6 se resolvieron con la recomendación de product. Las 7 a 10 siguen lo que hace
CliqCut-Web (`Nubit10/CliqCut-Web`: `public/manifest*.webmanifest`, `public/sw.js`, `app/layout.tsx`,
`components/pushnotification/PushNotificationInit.tsx`).

1. **Descarga múltiple:** un solo `.zip` con los documentos (RN-06). Un documento suelto se baja
   como hoy.
2. **Versiones al editar:** "Listo" guarda; los cambios del mismo docente en el mismo recurso en
   menos de 60 s se agrupan en una versión (RN-05).
3. **Avisos de generación:** solo dentro de Profe (aviso y contador en el menú, RN-08). Sin
   notificaciones del navegador en esta spec.
4. **"Primeros pasos":** cuatro pasos, y el cuarto es la primera descarga (RN-02).
5. **DBA sugeridos:** hasta 3 marcados por defecto, que el docente confirma (RN-04).
6. **Recorrido con docentes:** después de implementar, como validación con 2–3 docentes; las
   fricciones de §2 ya tienen evidencia medida. Si el recorrido cambia algo, va en una spec nueva.
7. **Al abrir la app instalada:** `start_url: /dashboard`, el Inicio del área de trabajo (CliqCut
   abre el panel de quien trabaja: `/owner/dashboard`).
8. **Ícono:** el logo actual de Profe sobre un cuadro con el degradado de marca, 512 px y "any
   maskable", el mismo para Apple (CliqCut usa su `logo-tile.png` de 512 px así) (RN-12).
9. **Sin conexión:** nada del docente se guarda en el teléfono; el service worker es mínimo como el
   de CliqCut y solo agrega la página estática "Sin conexión" (RN-13).
10. **iPhone:** en iPhone o iPad, "Instalar Profe" muestra el texto de CliqCut adaptado: "Abre Profe
    en Safari, toca Compartir y elige Agregar a pantalla de inicio. Luego entra desde ese ícono".
    Las pruebas automáticas corren en Android/Chrome y en un iPhone emulado; queda una **validación
    manual en un iPhone real** (descargas dentro de la app instalada) antes de marcar la spec como
    Implementada.

Nota: CliqCut bloquea la invitación del navegador a instalar en sus páginas públicas porque quien las
visita es el cliente final (`SuppressInstallPrompt`). En Profe quien visita la landing es un docente
que puede querer instalarla, así que no se bloquea en ninguna página.
