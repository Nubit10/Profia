# Estado del trabajo (2026-11-22)

Bitácora para retomar el trabajo después de borrar la conversación. **Se actualiza al cerrar cada tarea**
(qué se hizo, qué quedó a medias y con qué seguir). Lo más reciente va arriba de cada sección.

## En curso

## Hecho

- **SPEC-0038 etapa 2 y SPEC-0039 — Orientaciones del MEN y usar Estándares al generar** (2026-11-22),
  pedido del usuario (ADR-0022 aceptado). Catálogo: tipo `ORIENTATION` con Guía 30 de Tecnología (169),
  Educación Física Doc. 15 (150), Artística Doc. 16 (45) y Filosofía Doc. 14 (15), verificados contra los
  PDF; las Orientaciones curriculares de 2019/2022 no se cargan porque prohíben reproducir sin permiso
  escrito del MEN; Ética no se carga (texto sin desempeños; usa Ciudadanas). Migración
  `20261122120000_curriculum_orientations`. Lucía planea y genera con los referentes base del curso
  (`lib/curriculum-references.ts`): Ética, Cátedra de la Paz, Tecnología, Educación Física, Artística,
  Filosofía e Inglés 1°-5° ya tienen «Proponer con IA». El objetivo deja elegir Estándares aparte
  (también en Matemáticas, Lenguaje, Ciencias) y viajan a Lucía con `kind`; anexo de prompt
  `referentes.v1` solo cuando hay Estándares u Orientaciones. Índice: 2.099 ítems.
  Pruebas: web 402, e2e 117 (1 omitida), AI Engine 201.
  - Pendiente: medir `referentes.v1` en el benchmark con Groq real; revisión docente de las nuevas
    fuentes; en producción `npx prisma migrate deploy`, `curriculum:import` y republicar el Space.

- **SPEC-0038 etapa 1 — Competencias Ciudadanas y DBA de Inglés 6°-11°** (2026-11-22), pedido del usuario
  («que Lucía pueda hacer los recursos por sí misma»). Catálogo: Estándares Ciudadanos (156, área nueva
  `CIUDADANAS`, la ven Ética y la nueva precargada Cátedra de la Paz; migración
  `20261121200000_curriculum_area_ciudadanas`, también para los espacios existentes) y DBA de Inglés 6°-11°
  del Esquema Curricular Sugerido (46, versión corta sin evidencias, nivel A1-B1.3; 6 tramos con fuente
  ilegible transcritos de la imagen). Todo verificado contra los PDF. Índice del AI Engine: 1.720 ítems.
  Pruebas: web unit+integration 387, e2e 116 (1 omitida), AI Engine 197.
  - Pendiente: aceptar **ADR-0022** (propuesto) para la etapa 2: orientaciones de Tecnología (Guía 30),
    Artística, Educación Física, Filosofía y lineamientos de Ética, revisando términos de uso de cada PDF;
    revisión docente; en producción `npx prisma migrate deploy`, `curriculum:import` y republicar el Space.
  - Después: matrices del ICFES, mallas y textos del MEN (licencias), SPEC-0020 (material del docente).

- **SPEC-0037 — Estándares de Matemáticas, Lenguaje e Inglés** (2026-11-21), pedido del usuario. Catálogo:
  Matemáticas 172, Lenguaje 177, Inglés Guía 22 (1°-5° 91, 6°-11° 127), todos verificados contra los PDF
  oficiales. `extract_ebc.py` con perfil por área y `extract_guia22.py`. Un estándar puede ir sin lista; la
  tarjeta dice «Competencias que desarrolla» en Inglés. AI Engine: tipo en el índice y filtro `types`
  (contrato aditivo); las sugerencias de DBA piden solo DBA. Índice: 1.518 ítems.
  - Pendiente: ~~DBA de Inglés 6°-11°~~ (hecho en SPEC-0038); usar los Estándares al planear y generar (spec siguiente, a decidir);
    revisión docente; en producción `curriculum:import` y republicar el Space.

- **Fuente de títulos dentro del proyecto** (2026-11-21). En el computador del usuario `next dev`
  (Turbopack) fallaba con «next/font/google queries have exactly one entry» al cargar Fraunces desde
  Google Fonts (depende de la respuesta de Google; aquí no se reproducía). Fraunces ahora es
  `next/font/local` con los woff2 variables (peso 100–900, normal e itálica, latín) en
  `apps/web/app/fonts/fraunces/` (licencia OFL incluida). Ya no depende de Google; Plus Jakarta Sans y
  Geist Mono siguen por `next/font/google`. Los títulos en peso normal se ven delgados.

- **SPEC-0036 — DBA y Estándares de Ciencias Naturales y Ciencias Sociales** (2026-11-21), aprobada con
  las recomendaciones (Inglés queda para después). Catálogo: DBA Naturales V.1 (54), DBA Sociales V.1 (82),
  Estándares Naturales (342 acciones) y Sociales (250 acciones), verificados contra los PDF oficiales
  (todas las evidencias y viñetas cuadran; 3 correcciones de espacios y 7 textos comparados contra la
  imagen, en `curriculum/tools/fixes/`). Herramientas nuevas: `extract_dba_columns.py`, `extract_ebc.py`,
  `verify_columns.py`. Biología, Física, Química, Historia y Geografía precargadas y vinculadas. La tarjeta
  de un Estándar titula su lista «Estándar del grupo de grados». AI Engine: índice de 951 ítems y 14
  casos nuevos en el benchmark de búsqueda.
  - Pruebas: integración `spec-0036.test.ts` y CA-0036-06/10 en `spec-0014`/`documents`; e2e
    `spec-0036.spec.ts` (Sociales 8° y DBA sugerido por Lucía en Naturales 7°); AI Engine 196.
  - Pendiente: correr el benchmark de búsqueda (CA-0036-07) donde esté el modelo de embeddings; revisión
    docente de una muestra (`docs/curriculum/revision-dba.md`); en producción, `curriculum:import` contra
    Supabase y volver a publicar el Space.
  - Hallazgo: con `pdftotext` 24.02, `curriculum:verify` falla en Matemáticas, Lenguaje y Transición igual
    que antes de este cambio (la versión de pdftotext parte distinto el texto). No afecta a las nuevas.
  - Entorno: se creó el entorno de nube «ProfIA» con acceso a colombiaaprende.edu.co y mineducacion.gov.co
    para descargar los PDF.

- **Ayuda por WhatsApp** (2026-11-21), pedido del usuario al estilo de CliqCut. Número de soporte
  320 568 5222 en un solo lugar (`lib/support.ts`; `NEXT_PUBLIC_SUPPORT_WHATSAPP` lo cambia sin tocar
  código), con mensaje inicial sin datos del docente. Burbuja verde abajo a la derecha con "¿Necesitas
  ayuda?" al pasar el mouse en la página pública y en login, registro y contraseña
  (`components/support/help.tsx`, token `--whatsapp`); en el área de trabajo, "¿Necesitas ayuda? ·
  Escríbenos por WhatsApp" arriba de Instalar y Cerrar sesión (menú lateral y del celular); en la
  página de error, "¿Sigue fallando? Escríbenos por WhatsApp". e2e `soporte.spec.ts`; capturas en
  `design/capturas/soporte/`. El modo de pantalla de Ajustes se queda visible (decisión del usuario).

- **Lucía, la IA de ProfIA, y frases más claras en la página pública** (2026-11-21), aprobado por el usuario.
  - Página pública: título "Prepara tus clases en minutos, alineadas con los DBA y el DUA."; "Le cuentas a
    Lucía, la IA de ProfIA, qué vas a enseñar…"; "Gratis y sin tarjeta de crédito · Funciona en el celular ·
    Tú revisas todo antes de usarlo"; "Así trabaja Lucía" con pasos "Lucía busca el DBA / escribe / revisa";
    "cinco pasos" en vez de "estaciones"; "conectados con sus DBA"; cierre "verás cuánto tiempo te ahorra".
    Descripción del sitio con DBA y DUA.
  - En la app, Lucía es el sujeto de lo que hace la IA: creando el recurso, proponiendo temas, redactando
    objetivos, sugerencias, DBA marcados, ajustes, formatos, "Lucía aprendió algo de ti", tutorial y PIAR.
    La plataforma sigue siendo ProfIA. Regla en `docs/design/sistema-de-diseno.md` → Marca.
  - Pruebas e2e y el recorrido de usabilidad actualizados a los textos nuevos.
  - Inicio (aprobado): bajo el saludo "Soy Lucía, tu asistente. ¿Qué preparamos hoy?" con el foco;
    paso 3 "Crea tu primer taller con Lucía"; columna derecha "Pídele a Lucía". El cupo del menú se
    queda como estaba (decisión del usuario). Capturas en `design/capturas/lucia/`.

- **Nuevo nombre: ProfIA** (2026-11-21), decisión del usuario. Se cambió "Profe" por "ProfIA" en toda la
  interfaz, la página pública, los correos, la app instalable (manifiesto y título), los pies de los Word
  y PDF, el AI Engine (título de la API) y la documentación. El logo escribe "Prof" + "IA" en el color de
  la marca (`components/brand/profia-logo.tsx`, `ProfiaLogo` / `ProfiaMark`). Paquetes: `profia` (raíz),
  `@profia/web` y `profia-ai-engine`; claves del navegador `profia:*` y cachés `profia-*` del service
  worker (sin usuarios en producción, nada que migrar).
  - **No se cambió** (infraestructura con datos): las bases `profe` / `profe_test`, el usuario `profe` de
    PostgreSQL, el contenedor `profe-postgres-1` y el CI; ni los prompts del AI Engine (cambiar uno exige
    versión nueva; el modelo no muestra ese nombre al docente). Las capturas viejas siguen diciendo Profe.

- **Login más minimalista** (2026-11-21), pedido del usuario con su CRM (NubiA) como referencia.
  `app/(auth)/layout.tsx`: formulario sin tarjeta sobre fondo liso (`bg-brand-softer`), logo arriba a la
  izquierda, botón de color sólido (no el degradado) y, en el computador, un panel oscuro con una frase y
  dos avisos de ejemplo (decorativos, `aria-hidden`). Se quitaron la hoja rayada, la lista de 4 pasos y
  la frase de abajo. Títulos con `AuthHeading` en login, registro, olvidé y contraseña nueva. Capturas en
  `design/capturas/login-minimalista/` (las de `spec-0035/` muestran el diseño anterior). e2e de auth,
  0013, a11y, ux, workspaces, auditoría móvil y 0035 en verde (41).

- **SPEC-0035 — Recuperar la contraseña por correo y ver la contraseña** (2026-11-21, ADR-0021). El
  usuario eligió el camino completo por correo con Nodemailer.
  - "¿Olvidaste tu contraseña?" en el login (lleva el correo escrito) → `/forgot-password` → correo con
    enlace de un solo uso (1 hora, solo el SHA-256 en `password_reset_tokens`, pedir otro anula los
    anteriores) → `/reset-password/[token]` → entra a ProfIA. Misma respuesta exista o no la cuenta; el
    correo sale con `after()`; límite 5 por IP y 3 por correo cada 15 min. Cambiarla cierra todas las
    sesiones (`modules/auth/password-reset.ts`).
  - `lib/email` (ADR-0021): SMTP con `SMTP_URL`; sin él, fuera de producción, los correos quedan en
    `apps/web/.mail-outbox/` (fuera de git). Enlaces con `APP_URL` o `VERCEL_PROJECT_PRODUCTION_URL`.
  - `components/forms/password-input.tsx`: ojo para mostrar u ocultar en login, registro y contraseña
    nueva. Los títulos de las pantallas de ingreso ahora son encabezados (`aria-level=1`). Las pruebas
    usan `getByLabel("Contraseña", { exact: true })` (el botón también dice "contraseña").
  - Pruebas: unitarias `email.test.ts`, integración `spec-0035.test.ts` (12), e2e `spec-0035.spec.ts` y
    `spec-0035.movil.spec.ts` + `auth.spec.ts` en verde (12 de 12, con axe y 390 px).
  - Usabilidad: [informe](usabilidad/2026-11-21-recuperar-contrasena.md), 4 toques y 3 campos del login a
    estar adentro; capturas en `design/capturas/spec-0035/`. Recomendaciones pendientes de decisión:
    quitar "Confirmar contraseña", enlace en el error de login, remitente visible.
  - Pendiente: SMTP de producción (sin él el enlace no sale) y prueba de spam con Gmail y Outlook.

- **Avatar de la IA: foco con destellos** (2026-11-21). El usuario eligió la propuesta B entre cinco
  focos (el cerebro no se leía a 14–18 px). Un solo componente, `components/brand/ai-avatar.tsx`
  (vidrio y base de la marca, tres destellos azul violeta; blanco con `tone="light"`), cambia todas
  las pantallas. Captura: `docs/design/capturas/foco/curso.png`; `ux.spec.ts` en verde.

- **Ajustes (2), "Crear con IA" y WhatsApp en el computador** (2026-11-21), pedido del usuario.
  - Ajustes → "Usar sin conexión": activar, ver cuántos van guardados y dejar de guardar
    (`OfflineSettings` en `components/offline/offline-panel.tsx`; solo docentes).
  - En el curso, "Crear con IA" usa el color principal y "+", como en las demás vistas (sin el
    degradado ni el ícono de IA).
  - SPEC-0031 RN-04: "Enviar por WhatsApp" en el computador (descarga el PDF y abre WhatsApp Web). El
    "Compartir" del celular (Web Share) ya existía, pero solo se ve en el teléfono; por eso no aparecía.
  - Pruebas: `spec-0031.spec.ts` nueva (CA-0031-01/02/03 no tenían prueba, y Ajustes sin conexión);
    `ux`, `spec-0013-offline` y `spec-0018` en verde. Capturas en `docs/design/capturas/ajustes/`.

- **Ajustes** (2026-11-21), pedido del usuario. Página nueva `/settings` ("Configuración → Ajustes" en el
  menú; quien no da clases la ve en "Cuenta"): Mi cuenta (nombre, correo y fecha con que se registró, y sus
  espacios con el rol; solo lectura, `getAccount` en `modules/auth`), tamaño de la letra (Normal / Más
  grande, `useLargeText` en `components/app-shell/text-size.tsx`), modo de pantalla Claro / Oscuro / Como
  el dispositivo **solo visual** (aún no cambia nada) y "Ver tutorial". La tarjeta de abajo del menú
  quedó con "Instalar ProfIA" y "Cerrar sesión". El botón "Regenerar" de cada pregunta o actividad ahora
  dice **"Mejorar"** (lo eligió el usuario; la palabra propuesta antes no había quedado escrita).
  - Pruebas: unitarias 104; e2e de `ux`, `resources`, `spec-0027.movil` y `usabilidad-bloques.movil`
    (16 en verde, con axe en Ajustes). Captura: `docs/design/capturas/ajustes/escritorio.png`.
  - Pendiente: la funcionalidad del modo oscuro (tokens oscuros en `globals.css` y guardar la elección).

- **Mejoras de usabilidad, bloques 1–8** (2026-11-21), de
  [usabilidad/proximos-pasos.md](usabilidad/proximos-pasos.md). El usuario aprobó: el ajuste gasta
  cupo; en lo demás, lo recomendado; "lo más importante son todas las mejoras implementadas".
  - **SPEC-0027** (ADR-0020): botones "Más fácil · Más difícil · Más corto · Vida diaria · Agregar 2"
    debajo del recurso. Rehace el recurso entero en segundo plano como **propuesta**
    (`resource_adjustments`, migración `20261121120000_resource_adjustments`); se ve como la hoja y
    el docente elige "Quedarme con esta" (versión nueva, origen IA) o "Volver a la anterior". Cuesta
    como generar (1; examen 2, sin "Más corto" ni "Agregar"). Anexo `adjust.v1` en el AI Engine (campo
    `adjust` aditivo en quiz, taller, examen, plan e ítems). En cada ítem, fichas "Más fácil · Otra
    pregunta · Mejor redactada"; el texto libre queda en "Otra indicación…".
  - **SPEC-0028**: "Usar también en…" (menú del recurso) copia a los otros grupos de la misma
    asignatura y grado, en el tema del mismo título o uno nuevo; sin IA ni cupo
    (`copyResourceToCourses`, `matchTopicsInCourse`).
  - **SPEC-0029**: el recurso abre en **Hoja** (mismo modelo del PDF, `previewResource` +
    `components/documents/doc-preview.tsx`), con "Marcar las respuestas" y "Editar" en cada pregunta o
    actividad; selector Hoja | Editar. Las e2e que editan llaman `openEditor(page)`.
  - **SPEC-0030**: "Para esta semana" en el Inicio (primer tema sin recursos de cada curso, crear con
    un toque; `QuickCreateList` compartido con "¿Qué más necesitas?").
  - **SPEC-0031**: "Imprimir" (PDF en línea) en escritorio y "Compartir" (Web Share con el PDF) en el
    celular.
  - **SPEC-0032**: con DBA, "Primeros pasos" propone los temas del periodo 1
    (`?tab=planeacion&proponer=1`).
  - **SPEC-0033**: barra inferior en el celular (Inicio · Mis cursos · Crear · Mis recursos).
  - **SPEC-0034**: avisos abajo en el celular, "Letra más grande" en el menú y explicación de
    "Borrador / Listo" la primera vez.
  - Pruebas: AI Engine 196 (pytest) y ruff limpio; web 338 unitarias e integración (nuevas:
    `spec-0027`, `spec-0028`, `usabilidad-bloques`, `unit/adjustments`); e2e 100 de 100 en la última
    corrida completa (+3 de `usabilidad-bloques.movil` y la de SPEC-0032 en el celular, en verde por
    separado). `spec-0014.spec.ts` "parte 4" falló una vez por el selector del curso y pasó 3 de 3 al
    repetirla (intermitente, no de esta tarea).
  - Recorrido: 28 / 26 clics (celular / computador), 6 campos; detalle en
    [usabilidad/2026-11-20-recorrido-docente.md](usabilidad/2026-11-20-recorrido-docente.md).
  - Pendiente: probar "Compartir" en teléfonos reales; revisión formal (`/review`).

- **Prueba de usabilidad y de funcionamiento**, 2026-11-20
  ([informe](usabilidad/2026-11-20-recorrido-docente.md)). Pedido del usuario: que sea tan fácil como
  pedirle algo a ChatGPT, pero sin escribir instrucciones.
  - Recorrido de una profesora nueva en celular y computador (`npm run ux:recorrido -w @profia/web`):
    bajó de 34/29 a 27/24 clics para el trabajo de una semana.
  - Cambios:
    - "¿Qué más necesitas para «tema»?" al final de cada recurso: quiz, taller o plan del mismo tema
      con un toque.
    - Sin botón flotante dentro del asistente (tapaba botones).
    - Estructuras del taller plegadas.
    - Áreas táctiles de 44 px en la opción correcta y los interruptores.
    - Examen que suma 100 exacto; tema único ya marcado en el examen.
    - "Crear rápido" con los cinco tipos; un ícono por tipo.
  - Las e2e de descargas fallaban por el contenedor sin configuración regional (no por el producto):
    `playwright.config.ts` fija `LANG=C.UTF-8` y ya pasan.
  - Pruebas: AI Engine 189; web 313; e2e 96 (nueva `usabilidad.movil.spec.ts`).
  - Pendiente: los avisos emergentes tapan un momento el título en el celular; la validación con
    docentes reales (SPEC-0026).
  - Entorno: si se reinicia y Docker Hub no deja bajar la imagen, PostgreSQL 16 local sirve en 5434
    (`initdb` en `/var/lib/postgresql/profe-data`, bases `profe` y `profe_test`).

- **SPEC-0024** — Plan de aula y rúbrica en la escala del colegio
  ([spec](specs/SPEC-0024-plan-de-aula-y-escala-de-valoracion.md), ADR-0019), implementada el 2026-11-20.
  - Recurso `LESSON_PLAN` ("Plan de aula"): sesiones (1–6) de 30–120 minutos con inicio, desarrollo y
    cierre, evaluación, rúbrica de 2–5 criterios × 4 desempeños y ajustes para la diversidad. Cuesta 1 del
    cupo, se genera en segundo plano (contrato `generation-lesson-plan.v1`) y se edita a mano con
    versiones (sin regenerar sesión).
  - Escala de valoración del espacio (`institutions.gradingBands`, migración
    `20261120220000_lesson_plan_grading_bands`): nacional 1,0–5,0 por defecto; escalas de 5, 10 o 100. La
    cambia el administrador del colegio o el docente independiente en Ajustes → "Escala de valoración"
    (`/grading-scale`). La rúbrica la lee al verse y al descargarse.
  - Entradas: asistente "Crear" (tarjeta "Plan de aula"), menú Crear, "Crear plan de aula" en cada tema de
    la planeación y filtro "Planes de aula" en "Mis recursos". Word y PDF de un solo documento (sin clave).
  - El contrato de preferencias acepta `resourceType: LESSON_PLAN` (aditivo).
  - Pruebas: AI Engine 189; web 313 unitarias e integración (7 de spec-0024); e2e spec-0024 (asistente,
    editor, escala, 360 px y axe) en verde; las e2e de ux, 0014, 0019 y auditoría móvil siguen en verde.
    `resources.spec.ts:45` falla aquí por el nombre "download" de las descargas (conocido, no es de esta spec).
  - Pendiente: revisión formal (`/review SPEC-0024`); usar la escala para las notas en SPEC-0025.

- **SPEC-0023** — Preguntas tipo Saber (ICFES) con situación, figura y competencia
  ([spec](specs/SPEC-0023-preguntas-tipo-saber-con-figuras.md), ADR-0018), implementada el 2026-11-20.
  - Interruptor "Estilo Saber (ICFES)" en quiz y examen (Matemáticas y Lenguaje; se recuerda).
  - Figuras dibujadas por código (recta, barras, tabla, fracción, rectángulo) en el editor, el PDF y el
    Word (PNG con resvg y la Roboto de pdfmake).
  - Pendiente: revisión docente del catálogo de competencias; contexto compartido entre preguntas.
  - Siguen SPEC-0024 (planes de aula y rúbricas), SPEC-0025 (resultados → refuerzo) y SPEC-0026
    (validación con docentes).

- **SPEC-0022** — Verificar las respuestas de Matemáticas
  ([spec](specs/SPEC-0022-verificar-respuestas-de-matematicas.md), ADR-0017), implementada el 2026-11-20.
  Primera de las recomendaciones que el usuario pidió hacer ("hazlo lo que recomendaste"); siguen
  SPEC-0023 (Saber/ICFES con figuras), SPEC-0024 (planes de aula y rúbricas en la escala del colegio),
  SPEC-0025 (resultados → dificultades → refuerzo) y SPEC-0026 (validación con docentes).
  - El modelo escribe el cálculo (`check`); el motor lo evalúa exacto y seguro, marca cada pregunta como
    verificada, corregida o por revisar, y el editor lo muestra.
  - Pruebas: AI Engine 170; web 299; e2e spec-0022 en verde.

- **SPEC-0021** — Mejora continua de la IA con lo que hace el docente
  ([spec](specs/SPEC-0021-mejora-continua-con-el-docente.md), ADR-0016), implementada el 2026-11-20 con
  las recomendaciones de producto (el usuario aprobó "hazlo todo con tus recomendaciones").
  - A: ProfIA propone preferencias a partir de ediciones, 👎 con comentario, regeneraciones aceptadas y
    comentarios de 1–3 estrellas (60 días, ≥ 3 recursos, una por semana, 1 llamada al día). Tarjeta
    "ProfIA aprendió algo de ti" en "Mis recursos" (hoja inferior en el celular); el docente edita, elige el
    alcance y acepta o descarta.
  - B: validador de calidad `quality.v1` en el AI Engine (opción más larga, posición de la correcta
    reordenando, distractores repetidos, verbo y nivel, palabras por grado). No tumba la generación: lo
    que queda va a `generation_logs.qualityWarnings`.
  - C: `npm run benchmark:cases -w @profia/web` (casos anonimizados en `apps/ai-engine/benchmarks/real/`,
    fuera de git) y `benchmark-resources --real`; `metrics:resources` con señales implícitas.
  - Revisión (reviewer): Aprobado; se corrigió que un 👎 reciente en un recurso viejo no contaba.
  - Pruebas: AI Engine 146; web 298 unitarias e integración; build; e2e spec-0021 (2) en verde. Las e2e que
    revisan el nombre de un archivo descargado fallan en este entorno ("download"): no es de esta spec.
  - Pendiente: política de privacidad y términos antes de correr `benchmark:cases` en producción;
    revisión de los primeros casos reales; ajustar umbrales con las métricas.

- **PIAR sin autorización obligatoria para el docente independiente**, 2026-11-20 (decisión del usuario).
  - "Nuevo PIAR" del docente independiente ya no tiene casilla: muestra el aviso "Recuerda contarle al
    acudiente…" y `piars.consentAt` queda null (migración `20261120180000_piar_consent_optional`). En el
    espacio de un colegio la casilla sigue siendo obligatoria y el servidor la exige (`createPiar`).
  - Se le advirtió al usuario el riesgo: la Ley 1581 (arts. 6 y 7) pide autorización para datos
    sensibles de menores; el modelo de autorización queda como respaldo opcional.
  - Pruebas: integración spec-0017 (10) en verde; e2e: los pasos de crear pasan, pero
    `spec-0017.spec.ts:93` falla aquí porque el PDF descargado llega como "download" (no se tocó la
    exportación; revisar en el computador del usuario).

- **Modelo de autorización del acudiente para el PIAR**, 2026-11-20
  ([docs/legal/autorizacion-acudiente-piar.md](legal/autorizacion-acudiente-piar.md)). Pensado para el
  **docente independiente**: él es el responsable de los datos y ProfIA su encargado; no necesita al colegio.
  Trae el texto para firmar (Ley 1581, datos sensibles facultativos, IA sin datos personales, servidores en
  EE. UU., borrado y derechos) y una nota para cuando el que contrata es el colegio.
  - En la app, la casilla de "Nuevo PIAR" del docente independiente dice "autorización firmada del acudiente"
    (ya no "y del colegio"); en un espacio de colegio sigue igual. RN-04 de SPEC-0017 actualizada.
  - Falta (de ProfIA, no del docente): publicar la política de privacidad y los términos con la sección del
    PIAR, llenar en el modelo la razón social, el enlace y el correo de soporte, y ofrecerlo para descargar
    desde la pantalla del PIAR. Es un modelo: conviene que lo revise un abogado.

- **PIAR (SPEC-0017) listo para usar en local**, 2026-11-20. En el computador del usuario salía "El PIAR no
  está disponible todavía" porque su `apps/web/.env` no tenía `PIAR_ENCRYPTION_KEY` (el `.env` no va en git).
  - Nuevo comando `npm run piar:key -w @profia/web` (`apps/web/scripts/piar-key.mjs`): crea la clave y la
    escribe en `apps/web/.env` si falta; nunca reemplaza una existente (si se pierde, los PIAR guardados no se
    leen) y avisa si la que hay no es válida. Luego hay que reiniciar `npm run dev`.
  - Producción (Vercel): clave aparte en las variables de entorno (`docs/deploy/README.md`).
  - Pendiente fuera del código (de SPEC-0017): política de datos del colegio (Ley 1581) y autorización de
    los acudientes.

- **SPEC-0019** — Asistente de crear un paso por pantalla
  ([spec](specs/SPEC-0019-asistente-un-paso-por-pantalla.md)), implementada el 2026-11-20.
  - Curso y Tema son pasos separados (examen: Curso → Temas → Ajustes → Confirmar); elegir avanza a otra
    pantalla. Lo elegido se ve en los pasos (escritorio) o en una fila de fichas que se desliza de lado con flechas (celular; el usuario no quiso las fichas una debajo de otra) y tocarlo lo cambia.
    Volver al paso anterior ("← Volver al curso"…) va **debajo de los pasos**, igual en escritorio y celular
    (el usuario descartó ponerlo suelto encima de los pasos y arriba del título).
    Se quitó la tarjeta "Curso / Tema".
  - Código: `apps/web/app/(app)/create/create-wizard.tsx`, `page.tsx` (`curso=elegir`),
    `apps/web/components/stepper.tsx` (`values`), enlace para volver en `create-wizard.tsx`.
  - Pruebas: `spec-0019.spec.ts`, `spec-0019.movil.spec.ts` y ajustes en `ux.spec.ts`, `spec-0013.spec.ts`.
    Capturas: `docs/design/capturas/spec-0019/`.

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

- **Pruebas e2e de descargas en la nube:** el archivo llega con nombre `download` en vez del nombre real
  (CA-0013-38, CA-0013-14, CA-0013-15/16, CA-0011-17, CA-0017-05). **No es un error de ProfIA:** el 2026-11-20 se
  probó con un servidor mínimo (sin ProfIA ni service worker) y el Chromium preinstalado de este contenedor da
  `download` incluso con `Content-Disposition` correcto, y no dispara la descarga de un enlace `blob:` con
  `download`. En una máquina normal deberían pasar; si fallan allí, revisar entonces.
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
