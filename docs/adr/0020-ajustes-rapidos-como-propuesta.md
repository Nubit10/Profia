# ADR-0020 — Ajustes rápidos del recurso como propuesta (anexo `adjust.v1`)

| Campo              | Valor      |
| ------------------ | ---------- |
| Estado             | Aceptado   |
| Fecha              | 2026-11-21 |
| Specs relacionadas | SPEC-0027  |

## Contexto

SPEC-0027 pone botones ("Más fácil", "Más corto"…) que rehacen el recurso entero sin que el docente
escriba instrucciones. El camino que ya existía para volver a generar (`retryResource` → `enqueue` →
`saveGenerated`) reemplaza la versión 1 y borra el historial: sirve para un recurso fallido, no para
uno que el docente ya revisó y editó. Además, AGENTS.md exige que nada generado se guarde sin acción
del docente y que cada indicación a la IA esté versionada.

## Decisión

Un ajuste es una **propuesta aparte**, generada en segundo plano, que el docente acepta o descarta.

1. **Tabla `resource_adjustments`** (tenant, FK compuestas al recurso y a la membresía): código,
   versión de origen, estado `GENERATING → PROPOSED → ACCEPTED | DISCARDED` (o `FAILED`), propuesta
   (JSON con el mismo esquema que una versión) y `generationId`.
2. **Mismo motor de generación.** El `Job` de ADR-0008 lleva un `adjust` opcional; los
   ejecutores de taller, quiz, examen y plan no cambian, solo dónde se guarda el resultado
   (`saveProposal` en lugar de `saveGenerated`) y cómo se marca un fallo.
3. **Cupo:** cuenta como una generación (1, o 2 el examen) salvo que falle (`failureReason` no
   nulo). `quotaFor` suma recursos y ajustes; `assertQuota` es el mismo chequeo con bloqueo por
   docente para los dos caminos. En curso cuentan para el límite de 3.
4. **Contrato aditivo:** las peticiones de quiz, taller, examen y plan aceptan
   `adjust: { code, current }`; las de ítem aceptan `adjust` (código) con `instruction` en `null`.
   Sin `adjust`, nada cambia. El texto que lee la IA vive en `prompts/adjust.v1.md`; la versión
   registrada suma `+adjust.v1`. La cantidad y la dificultad se piden en los campos de siempre
   (el producto calcula el blueprint ajustado), así los validadores existentes las hacen cumplir.
5. **Aceptar** crea la versión siguiente con origen `AI` (concurrencia optimista de siempre) y deja
   el recurso en borrador. **Descartar** no crea versión.
6. **Vista de la propuesta:** se dibuja con el modelo intermedio de documentos (ADR-0009) en la
   página (`previewResource` + `DocPreview`), igual a la hoja que se imprime.

## Alternativas consideradas

- **Reutilizar `retryResource` con notas extra** — borra el historial y pisa las ediciones del
  docente; además guardaría contenido de la IA sin su acción.
- **Guardar la versión nueva de una vez y ofrecer "Deshacer"** — más simple, pero contradice "nada
  generado se guarda sin acción del docente" y llena el historial de versiones descartadas.
- **Mandar la indicación como texto en `notes`** — no queda versionada en el AI Engine y abre la
  puerta a texto libre; el código fijo con anexo sí.

## Consecuencias

- Positivas: el docente ajusta con un toque sin perder lo que tenía; el cupo sigue controlando el
  gasto; la vista de documento queda lista para el bloque 3 de usabilidad.
- Negativas / costos: una tabla más y un estado más que sondear en la página del recurso.
- Restringido: un solo ajuste en curso por recurso; el examen no admite "Más corto" ni "Agregar"
  (cambiarían los puntos); nunca se envía texto del docente en un ajuste del recurso completo.
