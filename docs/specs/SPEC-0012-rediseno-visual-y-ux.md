# SPEC-0012 — Rediseño visual y de experiencia de usuario

| Campo                    | Valor                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                                         |
| Fase del roadmap         | Transversal · UX (se implementa antes de SPEC-0011)                                                  |
| Módulo(s) responsable(s) | `apps/web/app` (rutas y vistas), `apps/web/components` (shell, sistema de diseño), `app/globals.css` |
| Agentes                  | product, frontend, qa, reviewer                                                                      |
| ADR relacionados         | Ninguno nuevo (ver §9 y decisión 6)                                                                  |
| Autor / Fecha            | product / 2026-10-10                                                                                 |

## 1. Objetivo

Hoy Profe funciona, pero se ve plano y gris, y al docente le cuesta saber qué hacer después. Para hacer un taller tiene que entrar a un curso, buscar la pestaña correcta y llenar un formulario largo. Esta spec cambia la apariencia de toda la plataforma (más moderna, cálida y con identidad propia) y reorganiza los flujos para que un docente sin experiencia técnica cree su primer recurso sin ayuda y en pocos pasos.

Tomamos como referencia el estilo de Tututor.AI: degradados cálidos en titulares y botones principales, fondos claros con tintes suaves, tarjetas redondeadas, chips con iconos y navegación clara. **Nos inspiramos en ese estilo, pero no copiamos su marca, sus textos ni sus cifras.**

## 2. Alcance

**Incluye:**

- **Sistema de diseño de Profe:**
  - Paleta de marca con degradado principal (cálido → violeta), colores de estado, tipografía de titulares y de texto, radios, sombras y espaciado como tokens en `globals.css`.
  - Variantes de botón, tarjeta, chip y badge sobre shadcn/ui.
  - Una página interna `/design` (solo en desarrollo) que muestra los componentes.
  - Documentación en `docs/design/sistema-de-diseno.md`.
- **Landing pública (`/`):**
  - Navegación superior y hero con titular en degradado, subtítulo y dos llamados a la acción ("Empieza gratis" y "Ver herramientas").
  - Una vista previa del producto (captura o ilustración).
  - Herramientas disponibles en tarjetas con icono: planeación, talleres, quices, Word y PDF, formato propio. Las que aún no existen (exámenes) llevan la etiqueta "Próximamente".
  - Sección "Cómo funciona" en 3 pasos, sección para colegios, preguntas frecuentes y pie de página.
  - El contenido está pensado para Colombia (DBA, Estándares, periodos).
- **Registro, ingreso y onboarding:**
  - Pantallas con el mismo estilo y una columna de valor al lado.
  - El onboarding termina llevando al docente a crear su primer curso, no a una página vacía.
- **Shell del área de trabajo, con el patrón de menú lateral de CliqCut-Web y Duali** (`components/shared/Sidebar.tsx` y `components/dashboard/shell.tsx`), ya probado con usuarios no técnicos. Lo detalla §2.1.
- **Inicio del docente (`/dashboard`):**
  - Saludo y una tarjeta de **"Siguiente paso"** que cambia según el estado del docente:
    - sin cursos → crear curso;
    - curso sin planeación → planear;
    - con temas pero sin recursos → crear taller;
    - con recursos → ver el último.
  - Accesos rápidos ("Crear taller", "Crear quiz"), tarjetas de cursos con color por asignatura y recursos recientes.
- **Asistente de creación de recursos:** el formulario actual de `resources/new` pasa a ser un asistente por pasos con progreso visible:
  1. Qué crear.
  2. Curso y tema.
  3. Ajustes con valores por defecto razonables.
  4. Confirmar y generar.
  - Se puede llegar desde "Crear" sin pasar antes por la página del curso.
- **Generación en curso:** una pantalla de espera clara mientras la IA trabaja, que dice qué está pasando y cuánto falta aproximadamente. Si falla, explica qué hacer.
- **Página del curso:** encabezado con identidad visual de la asignatura, pestañas más claras y estados vacíos con una acción concreta.
- **Vista y edición de recurso:**
  - Jerarquía clara: contenido, acciones principales (Descargar, Regenerar ítem, Evaluar) y acciones secundarias en un menú.
  - Las descargas se agrupan en un solo botón con opciones.
- **Formatos, Colegio y Profesores:** se les aplica el nuevo estilo, sin cambiar su funcionalidad.
- **Microcopia:** revisión de todos los textos de la UI con lenguaje simple de docente:
  - nada de "blueprint", "tenant" ni "recurso archivado" sin explicar;
  - "Referentes" se reemplaza por un término más claro (decisión 4).
- **Estados transversales:** vacío, cargando (esqueletos, no spinners sueltos), error y éxito, con el mismo patrón en toda la app.
- **Accesibilidad y responsive:** WCAG 2.1 AA, uso completo con teclado y pantallas desde 360 px de ancho.

### 2.1 Menú lateral (patrón CliqCut/Duali adaptado a Profe)

**En escritorio (desde `lg`):** un menú lateral fijo de 256 px, fondo blanco y borde derecho suave. El contenido va a la derecha, sobre un fondo neutro con un tinte muy leve y un ancho máximo de `max-w-7xl`. De arriba hacia abajo:

1. **Tarjeta de identidad** (redondeada, con borde y sombra suave). Responde "¿dónde estoy y quién soy?" sin abrir nada.
   - **Arriba:** el logo de la institución si lo tiene (ADR-0010), o el de Profe, junto al nombre del espacio en hasta 2 líneas.
   - Si el docente tiene más de un espacio, tocar esta parte abre el cambio de espacio. Reemplaza el selector suelto de hoy.
   - **Bajo un divisor:** el nombre del docente con una pastilla de rol (Docente, Administrador o Independiente) y una **línea de estado** con icono, por ejemplo "7 de 10 recursos con IA hoy".
   - La línea cambia de color cuando el cupo está por acabarse (ámbar con 2 o menos) o se acabó (naranja, con la hora a la que se renueva). Así el docente sabe del cupo antes de intentar generar.
2. **Botón "Crear"**, la acción primaria del área de trabajo, con degradado.
   - Abre un menú con Taller, Quiz, Planeación y Examen ("Próximamente").
   - En el celular se repite como botón flotante.
3. **Navegación por secciones.** Cada sección tiene un título pequeño en mayúsculas y gris, y las secciones se separan con un divisor fino:
   - **PRINCIPAL:** Inicio, Mis cursos.
   - **MI TRABAJO:** Mis recursos (todos los recursos del docente, de todos sus cursos), Formatos.
   - **AJUSTES:** Asignaturas.
   - **COLEGIO** (solo administradores): Datos y sedes, Profesores. Para el administrador que no da clases, también Formatos (formato institucional y logo, SPEC-0010) y Asignaturas, que hoy ya administra.
   - Las secciones y sus ítems se arman según el rol y el tipo de espacio desde una sola fuente: `components/app-shell/nav-items.ts`, con test unitario, como `nav-items.ts` de Duali. Una sección sin ítems no se muestra.
4. **Ítem del menú:**
   - Icono de 16 px y texto de 14 px semibold, redondeado y con al menos 36 px de alto.
   - En reposo: icono gris; al pasar el cursor, el icono toma el color de marca y el fondo se aclara.
   - **Activo:** fondo sólido de marca, texto blanco, sombra suave y una barra indicadora corta en el borde izquierdo. Además lleva `aria-current="page"`.
   - Un ítem también queda activo en sus subrutas: por ejemplo, Mis cursos sigue marcado dentro de `/courses/...`.
5. **Pie del menú:** una tarjeta con **"Ver tutorial"** y **"Cerrar sesión"**.
   - "Cerrar sesión" se resalta en rojo suave al pasar el cursor y pide confirmación en un modal.
   - Al salir, la página no debe parpadear ni dejar el área de trabajo en el historial del navegador (lección de CliqCut).

**En celular y tableta (menos de `lg`):**

- Una barra superior fija con el logo, el nombre del espacio (truncado), una pastilla compacta del cupo (por ejemplo, "7/10 hoy") y el botón de menú.
- El menú abre como un cajón lateral de `82vw`, con máximo 256 px, el mismo contenido y un fondo oscuro semitransparente que lo cierra al tocarlo.
- El scroll de la página queda bloqueado mientras el cajón está abierto, y se respetan otros bloqueos activos (por ejemplo, un modal).
- El cajón se cierra al navegar o con Escape, y el foco vuelve al botón de menú.

**Tutorial de primer uso:** 3–4 tarjetas cortas que se muestran la primera vez y se pueden volver a abrir con "Ver tutorial". Explican:

1. tus cursos;
2. planea tus temas;
3. crea con IA y revisa;
4. descarga en Word o PDF.

**No incluye (explícitamente):**

- Funcionalidad nueva de dominio: exámenes, planes de aula, nuevos tipos de pregunta.
- Cambios en el AI Engine o en los contratos.
- Cambios en la base de datos, salvo la columna opcional del tutorial (decisión 9).
- Modo oscuro (decisión 5).
- Videos promocionales, blog, precios con pasarela de pago, chat de soporte.
- Una suite tipo EduNova (asistencia, familias, mensajería): no está en el roadmap.
- Cambiar el diseño de los documentos Word y PDF exportados.

## 3. Actores y permisos

| Actor                     | Puede                                                                                | No puede                                             |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Visitante                 | Ver la landing, registrarse, ingresar                                                | Ver el área de trabajo                               |
| Docente                   | Usar el Inicio con siguiente paso, el botón "Crear", el asistente y todas sus vistas | Ver datos de otros docentes o espacios (sin cambios) |
| Administrador del colegio | Lo mismo en las vistas de Colegio y Profesores. Su Inicio guía a invitar profesores  | Ver cursos de docentes (sin cambios)                 |

Los permisos no cambian. El rediseño no puede saltarse `requireUser()` ni `requireTenant()`, ni mover la validación al cliente.

## 4. Reglas de negocio

- **RN-01 — Una acción principal por pantalla.** Cada pantalla tiene como máximo un botón con estilo primario (degradado). Las demás acciones son secundarias o van en un menú.
- **RN-02 — Siguiente paso calculado en el servidor.** El "Siguiente paso" del Inicio se calcula con datos que el servidor ya expone por las APIs públicas de los módulos, filtrados por el tenant. Las reglas son las de §2 y se evalúan en ese orden.
- **RN-03 — Pocos clics hasta el primer recurso.** Desde el Inicio, un docente con al menos un curso y un tema llega a "Generar" un taller en **4 clics o menos** con los valores por defecto.
- **RN-04 — El asistente no pierde datos.**
  - Volver a un paso anterior conserva lo elegido.
  - Recargar la página dentro del asistente conserva el paso y las elecciones. El borrador vive en la URL o en Zustand persistido en la sesión del navegador, nunca en el servidor antes de confirmar.
- **RN-05 — Sin prueba social inventada.**
  - La landing no muestra cifras de usuarios, calificaciones ni testimonios que no sean reales y autorizados.
  - Mientras no los haya, la sección de confianza muestra hechos verificables: "Alineado con los DBA y Estándares del MEN", "Tú revisas todo antes de usarlo", "Descarga en Word y PDF".
- **RN-06 — Lo que no existe no se ofrece como disponible.** Una herramienta aún no implementada aparece con la etiqueta "Próximamente" y sin enlace activo.
- **RN-07 — Lenguaje de docente.** Los textos visibles usan el glosario de `docs/design/sistema-de-diseno.md`. Términos técnicos prohibidos en la UI: blueprint, tenant, prompt, token, schema, RAG.
- **RN-08 — La marca es de Profe.** Nombre, logo, colores y textos son propios. No se usan nombres, logos, textos ni imágenes de Tututor.AI ni de otra marca.
- **RN-09 — Los colores salen de los tokens.** Los colores se definen como tokens en `globals.css`. Los componentes no usan colores sueltos (hex u oklch) fuera de los tokens.
- **RN-10 — Contraste.**
  - El texto sobre degradados y fondos tintados cumple contraste AA: 4,5:1 para texto normal y 3:1 para texto grande.
  - Los titulares con texto en degradado deben cumplir el contraste en el punto más claro del degradado.
- **RN-11 — El menú refleja permisos, no los define.** `nav-items.ts` solo decide qué se muestra. Cada página sigue validando el rol en el servidor: un docente que escribe `/school/members` en la barra de direcciones recibe el mismo rechazo de hoy.
- **RN-12 — La línea de cupo sale del servidor.** Se calcula con el mismo conteo que aplica el límite en `modules/resources` (`DAILY_LIMIT`, las generaciones fallidas no cuentan). Nunca se calcula en el cliente.
- **RN-13 — "Mis cursos" y "Mis recursos" son vistas de lectura.**
  - "Mis cursos" (`/courses`) separa la lista de cursos del Inicio.
  - "Mis recursos" (`/resources`) lista los recursos del docente de todos sus cursos, con filtros por curso y tipo.
  - Ninguna de las dos agrega operaciones nuevas: usan servicios existentes o una consulta nueva de solo lectura filtrada por `ctx.institutionId` y por el docente.

## 5. Entradas

No hay entradas nuevas de dominio. El asistente de recursos usa los mismos schemas Zod de `modules/resources` que el formulario actual. Solo cambia cómo se presentan los campos y en qué orden.

## 6. Salidas

- Tokens y componentes del sistema de diseño en `apps/web/app/globals.css` y `apps/web/components/`.
- Landing, auth, onboarding, shell, Inicio, curso, asistente, vista de recurso, Formatos, Colegio y Profesores rediseñados.
- `docs/design/sistema-de-diseno.md`: paleta, tipografía, componentes, patrones de estados y glosario de UI.
- Capturas de antes y después de las pantallas principales, adjuntas al cierre de la spec.

## 7. Errores y casos límite

| Caso                                                   | Comportamiento esperado                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Docente sin cursos abre "Crear → Taller"               | El asistente lo lleva primero a crear un curso (paso inline) y luego continúa                                    |
| Curso sin temas en la planeación                       | El paso "Curso y tema" ofrece crear un tema ahí mismo o ir a la planeación, sin dejar al docente en un callejón  |
| Docente llegó al cupo diario de recursos               | "Crear" sigue visible. El asistente avisa del cupo antes del paso de confirmar, no después de llenar todo        |
| La generación falla o el AI Engine no responde         | Mensaje en lenguaje simple con "Reintentar" y "Volver al curso". Nada técnico en pantalla                        |
| Nombre de curso o de colegio muy largo                 | Se trunca con puntos suspensivos y muestra el texto completo al pasar el cursor o enfocar. El layout no se rompe |
| Pantalla de 360 px                                     | Sin scroll horizontal. Tablas y listas pasan a tarjetas                                                          |
| Usuario con "reducir movimiento" activo en su sistema  | Las animaciones y transiciones se desactivan                                                                     |
| Administrador sin rol docente                          | Su Inicio muestra el siguiente paso de administración (agregar sede o invitar profesores), no "Mis cursos"       |
| Administrador sin rol docente en el menú               | No ve "Crear", "Mis cursos" ni "Mis recursos", ni la línea de cupo. Ve PRINCIPAL (Inicio) y COLEGIO              |
| Espacio sin logo                                       | La tarjeta de identidad muestra el logo de Profe                                                                 |
| Nombre de espacio de más de 2 líneas                   | Se corta en 2 líneas con puntos suspensivos y el nombre completo queda en `title`                                |
| Falla el cálculo del cupo                              | El menú se muestra sin la línea de cupo. Un error ahí no puede tumbar el área de trabajo                         |
| Cajón abierto y el usuario abre un modal desde el menú | Al cerrar el modal, el scroll sigue bloqueado mientras el cajón esté abierto                                     |

## 8. Criterios de aceptación

- **CA-0012-01:** Dado un visitante, cuando abre `/`, entonces ve:
  - la navegación superior;
  - el hero con titular, subtítulo y los botones "Empieza gratis" (lleva a `/register`) y "Ver herramientas" (baja a la sección de herramientas);
  - las secciones Herramientas, Cómo funciona, Para colegios, Preguntas frecuentes y pie de página.
- **CA-0012-02:** Dada la landing, cuando se revisa su contenido, entonces no hay cifras de usuarios, calificaciones ni testimonios sin respaldo, y "Exámenes" aparece como "Próximamente" y sin enlace (RN-05, RN-06).
- **CA-0012-03:** Dado un docente sin cursos, cuando entra al Inicio, entonces la tarjeta "Siguiente paso" le propone crear su primer curso.
- **CA-0012-04:** Dado un docente con un curso y un tema pero sin recursos, cuando entra al Inicio, entonces el siguiente paso es "Crea tu primer taller" y lleva al asistente con ese curso y ese tema ya elegidos.
- **CA-0012-05:** Dado un docente con al menos un recurso, cuando entra al Inicio, entonces ve sus recursos recientes y el siguiente paso apunta al último recurso.
- **CA-0012-06:** Dado un docente en cualquier página del área de trabajo, cuando usa el botón "Crear", entonces ve las opciones Taller, Quiz y Planeación (y Examen como "Próximamente"). Al elegir Taller, abre el asistente.
- **CA-0012-07:** Dado un docente con un curso y un tema, cuando va del Inicio a generar un taller con los valores por defecto, entonces lo logra en 4 clics o menos (RN-03).
- **CA-0012-08:** Dado el asistente en el paso 3, cuando el docente vuelve al paso 1 o recarga la página, entonces conserva el paso y lo que había elegido (RN-04).
- **CA-0012-09:** Dado un docente sin cursos, cuando abre "Crear → Taller", entonces el asistente le permite crear un curso sin salir del flujo y luego continúa.
- **CA-0012-10:** Dado un docente que llegó al cupo diario, cuando abre el asistente, entonces ve el aviso del cupo antes de llenar los ajustes.
- **CA-0012-11:** Dado un recurso en generación, cuando el docente está en su página, entonces ve un estado de progreso con un texto que explica qué pasa. Si la generación falla, ve "Reintentar" y "Volver al curso" sin mensajes técnicos.
- **CA-0012-12:** Dada cualquier lista vacía (cursos, recursos, formatos, profesores), cuando no hay elementos, entonces se muestra un estado vacío con una explicación de una línea y una acción concreta.
- **CA-0012-13:** Dada cada pantalla principal (landing, login, registro, Inicio, curso, asistente, recurso, Formatos, Colegio), cuando se analiza con axe-core, entonces no hay violaciones de WCAG 2.1 A ni AA.
- **CA-0012-14:** Dada cada pantalla principal a 360 px de ancho, cuando se carga, entonces no hay scroll horizontal y la navegación es accesible desde el menú móvil.
- **CA-0012-15:** Dada cada pantalla principal, cuando se cuentan los botones primarios de su contenido (`main`), entonces hay como máximo uno (RN-01). El "Crear" del menú lateral es la acción global y no cuenta.
- **CA-0012-16:** Dado el código de la UI, cuando se buscan los términos prohibidos de RN-07 en los textos visibles, entonces no aparece ninguno.
- **CA-0012-17:** Dado `globals.css` y los componentes, cuando se revisan, entonces la paleta de marca está definida como tokens y ningún componente de `app/` ni de `components/` (salvo `components/ui`) usa colores literales (RN-09).
- **CA-0012-18:** Dado el rediseño completo, cuando corre la suite E2E existente (auth, workspaces, curriculum, planning, resources, formats), entonces pasa. Los selectores se actualizan solo por cambios de texto o estructura, nunca porque cambió el comportamiento.
- **CA-0012-19:** Dado un usuario con `prefers-reduced-motion: reduce`, cuando navega por la app, entonces no hay animaciones de entrada ni transiciones decorativas.
- **CA-0012-20:** Dado `nav-items.ts`, cuando se arma el menú, entonces:
  - un docente independiente ve PRINCIPAL, MI TRABAJO y AJUSTES;
  - un docente de colegio ve lo mismo;
  - un administrador que también es docente ve además COLEGIO;
  - un administrador sin rol docente ve solo PRINCIPAL (Inicio) y COLEGIO (con Formatos y Asignaturas), sin "Crear".
- **CA-0012-21:** Dado un docente que generó 7 recursos en las últimas 24 horas, cuando ve el menú, entonces la línea de estado dice "7 de 10 recursos con IA hoy". Con 10 usados, indica que se acabó y a qué hora se renueva. Las generaciones fallidas no cuentan.
- **CA-0012-22:** Dado un docente en `/courses/<id>/resources/<id>`, cuando ve el menú, entonces "Mis cursos" está marcado como activo con `aria-current="page"`.
- **CA-0012-23:** Dado un docente con espacios en dos instituciones, cuando ve la tarjeta de identidad, entonces ve el logo y el nombre del espacio activo. Al tocarla puede cambiar de espacio, y el menú se actualiza con el logo y el nombre del nuevo.
- **CA-0012-24:** Dada una pantalla de menos de `lg`, cuando el usuario abre el menú, entonces:
  - se abre el cajón con el mismo contenido y el scroll de la página queda bloqueado;
  - al tocar un ítem, al tocar el fondo o al pulsar Escape, el cajón se cierra y el foco vuelve al botón de menú.
- **CA-0012-25:** Dado un usuario que pulsa "Cerrar sesión", cuando confirma en el modal, entonces llega al login sin ver otra vez el área de trabajo, y el botón Atrás del navegador no lo devuelve a ella.
- **CA-0012-26:** Dado un docente que entra por primera vez, cuando llega al Inicio, entonces ve el tutorial. Si lo cierra, no vuelve a aparecer solo, pero puede abrirlo con "Ver tutorial".
- **CA-0012-27:** Dado un docente con recursos en dos cursos, cuando abre "Mis recursos", entonces ve los de ambos cursos y puede filtrar por curso y tipo. No ve recursos de otro docente ni de otro espacio (test de acceso cruzado).
- **CA-0012-28:** Dado un docente que no es administrador, cuando escribe `/school/members` en la barra de direcciones, entonces recibe el mismo rechazo de hoy, aunque el menú no muestre esa opción (RN-11).

## 9. Seguridad y privacidad

- No hay datos nuevos ni nuevos llamados a la IA. El rediseño no puede mover a componentes de cliente datos que hoy solo viven en el servidor.
- El "Siguiente paso" se calcula en el servidor con `requireTenant()` y servicios que filtran por `ctx.institutionId`. Lleva un test de acceso cruzado: los cursos de otro espacio no cuentan para el siguiente paso.
- El borrador del asistente en el navegador contiene solo identificadores y opciones, nunca contenido generado ni datos de estudiantes. Se borra al confirmar o al cerrar la sesión.
- **ADR:** no se propone uno. No hay tecnología nueva de ejecución: Tailwind, shadcn/ui, React Icons, Sileo y `next/font` ya están en el stack. Hay dos dependencias de desarrollo que validar (decisión 6):
  - `@axe-core/playwright`, para CA-0012-13;
  - una fuente de Google vía `next/font`, sin costo ni dependencia de ejecución.

## 10. Tareas

- [x] T1 — Sistema de diseño: tokens (paleta, degradado, tipografía, radios, sombras), variantes de Button/Card/Badge/Chip, página `/design` y `docs/design/sistema-de-diseno.md` con el glosario — frontend
- [x] T2 — Menú lateral según §2.1:
  - `nav-items.ts` por rol y tipo de espacio, con test;
  - tarjeta de identidad con logo, espacio, rol y cupo, que integra el cambio de espacio;
  - botón "Crear", ítem activo con indicador, pie con tutorial y cierre de sesión confirmado;
  - barra superior y cajón en el celular con bloqueo de scroll compartido, Escape y regreso del foco;
  - `prefers-reduced-motion`.
  - Referencia: CliqCut `components/shared/Sidebar.tsx`, Duali `components/dashboard/shell.tsx`.
  - Agente: frontend.
- [x] T2b — Datos del menú en el servidor: cupo usado y hora de renovación (desde `modules/resources`) y logo del espacio (desde `modules/formats`). Si falla, el menú degrada sin romper — backend
- [x] T2c — Vistas "Mis cursos" (`/courses`) y "Mis recursos" (`/resources`), con la consulta de solo lectura y su test de acceso cruzado — backend + frontend
- [x] T2d — Tutorial de primer uso que se puede reabrir — frontend
- [x] T3 — Landing pública según §2 (sin prueba social inventada) — frontend + product (textos)
- [x] T4 — Auth y onboarding con el nuevo estilo; el onboarding termina en "crea tu primer curso" — frontend
- [x] T5 — Servicio del "Siguiente paso" en el servidor, con su test de acceso cruzado — backend
- [x] T6 — Inicio: siguiente paso, accesos rápidos, tarjetas de curso y recursos recientes — frontend
- [x] T7 — Asistente de recursos por pasos: borrador persistente, curso inline, aviso de cupo y estado de generación — frontend
- [x] T8 — Curso, vista de recurso, Formatos, Colegio y Profesores: estilo, jerarquía de acciones y estados vacíos — frontend
- [x] T9 — Revisión de microcopia en toda la UI (RN-07) — product
- [x] T10 — Tests: E2E de CA-0012-01…28, axe-core, 360 px, conteo de botones primarios, búsqueda de términos y colores literales; actualizar los E2E existentes — qa
- [x] T11 — Capturas del después en `docs/design/capturas/spec-0012/` (build de producción, AI Engine de prueba), tomadas con `scripts/ux-tour.mts`. **Desviación aceptada:** las del antes no se conservaron. **Seguimiento:** el recorrido guiado con el usuario (decisión 8) y la prueba con 3–5 docentes con la tarea "crea un taller para tu curso" quedan pendientes; sus hallazgos irán a una spec nueva si piden cambios — product
- [x] T12 — Revisión contra la spec y la DoD (2026-10-10). La primera revisión pidió cambios; tras corregirlos quedó aprobada (ver §13) — reviewer

## 11. Decisiones (resueltas por el usuario el 2026-10-10, con las recomendaciones de product)

1. **Colores de marca:** paleta propia cálida naranja → magenta → violeta, distinta a la de Tututor.AI.
2. **Logo:** logotipo tipográfico provisional "Profe" con icono hasta que exista un logo definitivo.
3. **Navegación:** menú lateral con el patrón de CliqCut y Duali (§2.1); "Mis cursos" y "Mis recursos" son páginas propias.
4. **Términos:** "Referentes" pasa a llamarse **"DBA y Estándares"**.
5. **Modo oscuro:** fuera de esta spec.
6. **Dependencias:** se aprueban `@axe-core/playwright` (solo tests) y Plus Jakarta Sans vía `next/font`.
7. **Entregas:** se implementa todo, en orden 12A (sistema de diseño, menú, Inicio, asistente) y luego 12B (landing, auth y resto).
8. **Prueba con docentes:** recorrido guiado con el usuario; la prueba con docentes del cliente queda para cuando estén disponibles.
9. **Tutorial:** columna aditiva `tutorialDismissedAt` en `users`.
10. **Ítem activo:** fondo sólido de marca; el degradado queda solo para la acción primaria.

## 12. Notas de implementación

- **Rutas nuevas:**
  - `/courses` (Mis cursos);
  - `/resources` (Mis recursos);
  - `/create` (asistente; el paso va en la URL: `type`, `courseId`, `topicId`, `step=confirmar`);
  - `/design` (catálogo, solo en desarrollo).
  - `/courses/[id]/resources/new` redirige al asistente.
- **Servidor:**
  - `getTeacherHome`, `getQuotaStatus` y `listMyResources` en `modules/resources/overview.ts`;
  - `listTopicOutline` y `createQuickTopic` (con `createQuickTopicAction`) en `modules/planning/outline.ts`;
  - `dismissTutorialAction` en `modules/auth`;
  - `createCourseAction` ahora devuelve el id del curso.
- **Migración** `20261010200000_user_tutorial`: `users.tutorialDismissedAt` (aditiva).
- **Tutorial:** la primera vez es una tarjeta en el Inicio que no bloquea la pantalla. "Ver tutorial" lo abre en un diálogo.
- **Borrador del asistente:** `sessionStorage` con la clave `profe:create:<tipo>:<tema>`. Se borra al generar y al cerrar sesión.
- **Tests:**
  - `tests/unit/app-shell.test.ts`: CA-20, CA-21 y CA-22.
  - `tests/unit/design-system.test.ts`: CA-17 y RN-10.
  - `tests/integration/ux-home.test.ts`: CA-03, CA-04, CA-05, CA-21 y CA-27, más el acceso cruzado y el tema rápido.
  - `tests/e2e/ux.spec.ts`: CA-01 a CA-16, CA-19, CA-21, CA-22 y CA-24 a CA-28. Corre axe, cuenta los botones primarios y busca términos técnicos en cada pantalla principal.
  - CA-18: se actualizaron los E2E existentes solo por cambios de texto o estructura (menú "Descargar", asistente, "DBA y Estándares", confirmación al salir).
  - CA-23: lo cubre `workspaces.spec.ts` (CA-0002-07).

## 13. Revisión (2026-10-10)

Primera pasada: **Cambios requeridos**. Cinco criterios tenían cobertura parcial (CA-12, 13, 14, 23 y 24), la página Profesores no tenía estado vacío y faltaban las capturas.

Correcciones:

- Profesores muestra un estado vacío cuando el administrador es el único miembro, con "Invitar al primer profesor", que lleva al campo de correo (CA-0012-12).
- `ux.spec.ts`:
  - test nuevo del colegio (`/school` y `/school/members`) con axe, conteo de botones primarios, términos técnicos y 360 px;
  - 360 px también en landing, ingreso, registro, curso y recurso;
  - el cajón se cierra al tocar el fondo y el foco vuelve al botón de menú también al navegar (CA-0012-24);
  - recarga en el paso 3 del asistente (CA-0012-08).
- `workspaces.spec.ts` (CA-0002-07 / CA-0012-23): el logo del colegio aparece en la tarjeta de identidad y desaparece al cambiar al espacio propio.
- `PNG_1X1` y `signUpSchoolAdmin` pasan a `tests/e2e/helpers.ts`.
- `instrumentation.test.ts`: timeout de 20 s (fallaba por la carga de la suite completa, no por el código).

Segunda pasada: **Aprobado**. Lint, typecheck y Prettier sin errores; Vitest 194 de 194; E2E 33 de 33 contra el build de producción.
