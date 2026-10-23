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

| Componente                                                   | Dónde                          | Regla                                                         |
| ------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------- |
| `Button` (`brand`, `default`, `outline`, `ghost`, `inverse`) | `components/ui/button.tsx`     | `brand` una vez por pantalla. `inverse` sobre fondos de marca |
| `Badge` (`brand`, `success`, `warning`, `info`)              | `components/ui/badge.tsx`      | Estado de un recurso con `StatusBadge`                        |
| `PageHeader`                                                 | `components/page-header.tsx`   | Línea superior, título, descripción y acciones                |
| `EmptyState`                                                 | `components/empty-state.tsx`   | Siempre una explicación de una línea y una acción concreta    |
| `ResourceList`                                               | `components/resource-list.tsx` | Talleres y quices con tipo, estado y fecha                    |
| Menú lateral                                                 | `components/app-shell/`        | Ver abajo                                                     |

## Menú lateral (patrón CliqCut/Duali)

- Tarjeta de identidad: logo del espacio (o el de Profe), nombre en 2 líneas, docente con su rol y línea de cupo de IA. Si hay varios espacios, la tarjeta abre el cambio de espacio.
- Botón "Crear" (degradado) con Taller, Quiz, Planeación y Examen (Próximamente). En el celular se repite como botón flotante.
- Secciones con título pequeño en mayúsculas, definidas en `nav-items.ts` según el rol: PRINCIPAL, MI TRABAJO, AJUSTES y COLEGIO.
- Ítem activo: fondo sólido de marca, texto blanco, barra corta a la izquierda y `aria-current="page"`.
- Pie: "Ver tutorial" y "Cerrar sesión" (con confirmación).
- En el celular: barra superior con logo, espacio y pastilla de cupo, y un cajón lateral. Se cierra con Escape, con el fondo o al navegar, y bloquea el scroll con un contador compartido (`lib/scroll-lock.ts`).

## Estados

- **Vacío:** `EmptyState`.
- **Cargando:** el asistente y el Inicio llegan del servidor ya armados. Mientras la IA genera, se muestra una tarjeta con mensajes de lo que está pasando y una barra indeterminada.
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

WCAG 2.1 AA, verificado con axe-core en los E2E (CA-0012-13). Se pueden usar todas las pantallas con teclado, hay un enlace "Saltar al contenido" y los íconos decorativos llevan `aria-hidden`. Los campos y botones miden al menos 40 px de alto. Desde 360 px de ancho no hay scroll horizontal.
