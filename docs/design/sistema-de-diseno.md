# Sistema de diseño de Profe

Origen: [SPEC-0012](../specs/SPEC-0012-rediseno-visual-y-ux.md). Catálogo vivo (solo en desarrollo): `/design`.

## Principios

1. **Un siguiente paso evidente.** Cada pantalla deja claro qué hacer después. El Inicio lo calcula en el servidor.
2. **Una acción primaria por pantalla** (RN-01). Lleva el degradado de marca (`variant="brand"`). Las demás acciones son sólidas, de contorno o van en un menú.
3. **Pocos clics.** Un docente con un curso y un tema genera un taller en 4 clics o menos desde el Inicio.
4. **Lenguaje de docente.** Frases cortas, en segunda persona y sin jerga técnica (ver el glosario).
5. **Nada se pierde.** Los asistentes guardan el paso en la URL y el borrador en la pestaña del navegador.

## Marca

- **Logotipo provisional:** un icono de birrete sobre el degradado, junto a "Profe" en negrita (`components/brand/profe-logo.tsx`).
- **Degradado:** naranja `#cf3d0c` → magenta `#be185d` → violeta `#7c3aed`. Los tres tienen contraste AA (≥ 4,5:1) con texto blanco y sobre el fondo claro, así que se puede usar en botones y en titulares (RN-10).
- **Tipografía:** Plus Jakarta Sans (`next/font`). Títulos en `font-extrabold`, texto en peso normal.

## Tokens (`app/globals.css`)

Todos los colores de la UI salen de tokens (RN-09). Fuera de `components/ui` no se usan colores literales (hex, oklch ni la paleta de Tailwind).

| Token                                                                  | Uso                                                      |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `brand`, `brand-strong`                                                | Ítem activo del menú, botón sólido, enlaces              |
| `brand-soft`, `brand-softer`, `brand-border`                           | Fondos de iconos, tarjetas seleccionadas, estados vacíos |
| `brand-gradient` (utilidad `bg-brand-gradient`, `text-brand-gradient`) | Acción primaria, titulares de la landing                 |
| `surface`, `surface-warm`, utilidad `bg-hero`                          | Fondo del área de trabajo y de las pantallas públicas    |
| `success`, `warning`, `danger`, `info` y sus `-soft`                   | Estados (listo, falló, cupo agotado, generando)          |
| `tint-1…6` y `tint-N-fg`                                               | Color estable por asignatura (`lib/subject-tint.ts`)     |
| `shadow-soft`, `shadow-lift`                                           | Tarjetas en reposo y elementos destacados                |

Radios: `rounded-xl` en campos y botones, `rounded-2xl` en tarjetas y `rounded-3xl` en bloques principales.

## Componentes

| Componente                                                   | Dónde                             | Regla                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button` (`brand`, `default`, `outline`, `ghost`, `inverse`) | `components/ui/button.tsx`        | `brand` una vez por pantalla. `inverse` sobre fondos de marca                                                                                                                                                          |
| `Badge` (`brand`, `success`, `warning`, `info`)              | `components/ui/badge.tsx`         | Estado de un recurso con `StatusBadge`                                                                                                                                                                                 |
| `PageHeader`                                                 | `components/page-header.tsx`      | Línea superior, título, descripción y acciones                                                                                                                                                                         |
| `EmptyState`                                                 | `components/empty-state.tsx`      | Siempre una explicación de una línea y una acción concreta                                                                                                                                                             |
| `ResourceList`                                               | `components/resource-list.tsx`    | Talleres y quices con tipo, estado y fecha                                                                                                                                                                             |
| Menú lateral                                                 | `components/app-shell/`           | Ver abajo                                                                                                                                                                                                              |
| `PageSkeleton`                                               | `components/page-skeleton.tsx`    | Pantalla de carga de una ruta; nunca en rutas que responden 404                                                                                                                                                        |
| `OfflinePanel`, `OfflineBadge`                               | `components/offline/`             | Pregunta, progreso y marca "Disponible sin conexión"                                                                                                                                                                   |
| `NotifyCard`                                                 | `components/notifications/`       | Pide el permiso de avisos solo después de "Generar"                                                                                                                                                                    |
| `DbaChip`, `DbaChips` (SPEC-0014)                            | `components/curriculum/`          | Toda etiqueta "DBA n" abre su ficha (enunciado, evidencias, fuente del MEN); el texto sale del catálogo, nunca de la IA                                                                                                |
| `PlanResources` (SPEC-0014)                                  | `components/plan-resources.tsx`   | Recursos por Periodo · Unidad · Tema, un bloque plegable por periodo; agrupar con `groupByPlan`                                                                                                                        |
| `SelectableOption`, `SelectToggle`                           | `components/forms/selectable.tsx` | Nunca casillas sueltas: cada opción es un botón que se toca entero (44 px) con un círculo con check; `SelectToggle` es el botón redondo de "incluir" junto a un campo. Para lectores de pantalla son `role="checkbox"` |
| `AiAvatar`, `AiIcon`                                         | `components/brand/ai-avatar.tsx`  | El avatar de la IA de Profe (carita con visor y chispa) en todo lo que hace la IA, en lugar de destellos. `tone="light"` sobre botones con degradado                                                                   |
| Modales (`Dialog`)                                           | `components/ui/dialog.tsx`        | Solo el cuerpo se desplaza: el encabezado (título y descripción) y la X quedan siempre a la vista; las barras inferiores fijas llevan `data-sticky-footer`                                                             |

## Menú lateral (patrón CliqCut/Duali)

- Tarjeta de identidad: logo del espacio (o el de Profe), nombre en 2 líneas, docente con su rol y línea de cupo de IA. Si hay varios espacios, la tarjeta abre el cambio de espacio.
- Botón "Crear" (degradado) con Taller, Quiz, Planeación y Examen (Próximamente). En el celular se repite como botón flotante.
- Secciones con título pequeño en mayúsculas, definidas en `nav-items.ts` según el rol: PRINCIPAL, MI TRABAJO, AJUSTES y COLEGIO.
- Ítem activo: fondo sólido de marca, texto blanco, barra corta a la izquierda y `aria-current="page"`.
- Pie: "Ver tutorial" y "Cerrar sesión" (con confirmación).
- En el celular: barra superior con logo, espacio y pastilla de cupo, y un cajón lateral. Se cierra con Escape, con el fondo, con el botón Atrás o al navegar (no al tocar un enlace, para que se vea que carga), y bloquea el scroll con un contador compartido (`lib/scroll-lock.ts`).
- "Mis recursos" muestra "N generándose" mientras la IA trabaja, y cada enlace muestra un indicador al tocarlo si la pantalla aún no carga (`useLinkStatus`).
- Pie: "Instalar Profe" cuando el navegador lo permite (en iPhone explica "Agregar a pantalla de inicio").

- Barra de desplazamiento: clase `thin-scrollbar` (`app/globals.css`), delgada y sin flechas como en CliqCut. Va en el menú lateral; úsala en cualquier zona con scroll propio.

## Celular (SPEC-0013, patrón de Terram)

Referencia: 390 × 844, táctil. Las pruebas corren en el proyecto `movil` de Playwright.

- **Una sola barra abajo.** Las acciones de la pantalla van en una barra fija inferior (la del recurso: "Marcar como listo", "Descargar", "⋯"). Nada más flota abajo: el botón flotante "Crear" no aparece donde la página tiene su barra. Todo lo que flota lleva `data-floating` y una prueba verifica que no se tapen.
- **Formularios como hoja inferior.** `Dialog` sube desde abajo en pantallas pequeñas (centrado desde `sm`), con el botón principal a la vista y sin pasar del alto de la pantalla.
- **Atrás cierra lo abierto.** Diálogos, menús "⋯" y el cajón agregan una entrada al historial (`lib/use-back-to-close.ts`). Si una capa se cierra porque se navega, llama `navigatingFromLayer()` antes de `router.push`.
- **Tamaño del dedo.** Controles de 44 × 44 px o más en el celular (`max-sm:min-h-11`). Los checkbox amplían su zona con un pseudo-elemento. Los enlaces que cubren una tarjeta usan `after:absolute after:inset-0`.
- **Áreas seguras.** Con `viewport-fit=cover`, encabezado, cajón, hojas y barra inferior usan `env(safe-area-inset-*)`.
- **Rejillas y filas.** Las rejillas declaran `grid-cols-1` de base; en filas que se parten, el bloque de texto lleva `basis-*` para que los botones bajen a su línea (encabezado del curso). Las pestañas del curso se ven completas en tres columnas.
- **Vista compacta.** En el editor del recurso, `data-compact` oculta lo marcado con `data-detail` (opciones, justificación, etiquetas y acciones).

- Pasos de un flujo: `Stepper` (`components/stepper.tsx`, patrón de CliqCut). En el celular: "Atrás", "Paso 2 de 3 · Nombre", barra de progreso y puntos; nunca una fila de nombres que se corte. En escritorio, la fila con cada paso.
- Filas que no caben (pestañas, filtros): `ScrollableRow` (`components/scrollable-row.tsx`, como `ScrollableTabs` de CliqCut). Se desliza hasta el elemento con `data-active` y avisa con un degradado y una flecha mientras quede algo por ver. Mejor aún si caben: etiquetas cortas en el celular (la pestaña "DBA y Estándares" dice "DBA", con el nombre completo en `aria-label`).
- Nunca tarjeta dentro de tarjeta: dentro de un bloque, `ResourceList plain` y vacíos de una línea.
- Filas de filtros o chips en el celular: una sola fila deslizable (`overflow-x-auto`, sin barra), nunca dos líneas.
- Barras con varios botones en el celular: los botones se reparten el ancho; si el texto no cabe, uno más corto con el mismo `aria-label`.
- `basis-*` solo en filas: en una columna (`flex-col`) la base se vuelve altura y deja huecos. En columnas que pasan a fila, `sm:basis-*`.
- Avisos emergentes: arriba y centrados en el celular (abajo está "Crear"), abajo a la derecha en el escritorio (`AppToaster`).
- El menú lateral del celular se cierra tocando fuera, con Atrás o con Escape; sin botón flotante fuera del cajón.
- Auditoría: `tests/e2e/auditoria.movil.spec.ts` recorre cada pantalla a 360 px (sin scroll horizontal ni nada fuera del borde); con `AUDIT_SHOTS=<carpeta>` deja capturas.

## App instalable y sin conexión (SPEC-0013, ADR-0012)

- Manifiesto en `app/manifest.ts`; íconos en `public/icons/`, generados desde el logo con `node scripts/generate-app-icons.mjs`; colores en `lib/brand-colors.ts` (una prueba los compara con los tokens).
- "Sin conexión" (`/offline`) es estática: con señal no muestra datos; sin señal lista lo guardado en el dispositivo.
- Los avisos del navegador piden el permiso solo después de "Generar" o desde Ajustes → Notificaciones, y no se repiten si Profe está a la vista.

## Estados

- **Vacío:** `EmptyState`.
- **Cargando:** Inicio, "Mis recursos", Formatos, Asignaturas y el asistente tienen esqueleto (`loading.tsx` con `PageSkeleton`). Las rutas que pueden responder 404 (curso, recurso, colegio) no lo llevan: con él Next respondería 200 a una ruta ajena. Mientras la IA genera, se muestra una tarjeta con mensajes de lo que está pasando y una barra indeterminada.
- **Error:** el título dice qué no se pudo hacer, la frase siguiente explica por qué en lenguaje simple y luego vienen las acciones ("Reintentar", "Volver al curso").
- **Éxito:** un toast de Sileo con un título corto.
- **Movimiento:** con `prefers-reduced-motion: reduce` se desactivan animaciones y transiciones (CA-0012-19).

## Glosario de UI (RN-07)

| Decimos                              | No decimos                     |
| ------------------------------------ | ------------------------------ |
| Ajustes del taller o del quiz        | Blueprint                      |
| Espacio, colegio                     | Tenant, institución (en la UI) |
| DBA y Estándares                     | Referentes                     |
| Indicaciones para la IA              | Prompt                         |
| Recursos con IA (cupo)               | Tokens, generaciones           |
| Crear, generar                       | Inferir, llamar al modelo      |
| Archivado (no aparece en tus listas) | Soft delete                    |

Prohibidos en textos visibles: blueprint, tenant, prompt, token, schema, RAG.

## Accesibilidad

WCAG 2.1 AA, verificado con axe-core en los E2E (CA-0012-13). Se pueden usar todas las pantallas con teclado, hay un enlace "Saltar al contenido" y los íconos decorativos llevan `aria-hidden`. Los campos y botones miden al menos 40 px de alto (44 px en el celular, SPEC-0013). Desde 360 px de ancho no hay scroll horizontal. Ninguna pantalla puede tener diferencias de hidratación: la guardia de `tests/e2e/fixtures.ts` las detecta y `npm run test:e2e:dev` corre la suite en modo desarrollo (CA-0013-19). Las fechas visibles usan `lib/dates.ts`.
