# ADR-0009 — Librerías para generar DOCX y PDF

| Campo              | Valor        |
| ------------------ | ------------ |
| Estado             | **Aceptado** |
| Fecha              | 2026-10-01   |
| Specs relacionadas | SPEC-0009    |

## Contexto

El plan maestro pide documentos DOCX y PDF utilizables e imprimibles (criterio #8), pero no fija cómo generarlos. Necesitamos que Word y PDF tengan el mismo contenido, que se generen en el servidor web sin infraestructura nueva (presupuesto cero, ADR-0007) y que las librerías permitan uso comercial.

## Decisión

**Un modelo de documento intermedio en `modules/documents` y dos renderizadores: [`docx`](https://www.npmjs.com/package/docx) para Word y [`pdfmake`](https://www.npmjs.com/package/pdfmake) para PDF.**

- El modelo intermedio (encabezado, secciones, párrafos, listas, preguntas con opciones, líneas para responder, pie) se construye desde el contenido del recurso. Los renderizadores no conocen talleres ni quices: así DOCX y PDF no se desalinean (SPEC-0009 RN-03) y un tipo de recurso nuevo solo agrega un constructor.
- `docx` 9.x (MIT): genera DOCX nativo, editable, en Node.
- `pdfmake` 0.3.x (MIT, sobre PDFKit): PDF declarativo con tablas, saltos de página controlados y texto seleccionable. Se embebe una fuente libre (Roboto u otra con licencia OFL/Apache) que cubre español y símbolos matemáticos básicos.
- Ambos corren en el route handler de Next.js en el runtime de Node.

Versiones y licencias verificadas en npm el 2026-10-01.

## Alternativas consideradas

- **Convertir DOCX a PDF con LibreOffice headless:** un solo formato fuente, pero exige instalar LibreOffice en el servidor (cientos de MB) y un proceso externo por descarga.
- **HTML → PDF con Chromium (Playwright/Puppeteer):** buena fidelidad, pero un navegador en el servidor web es pesado en memoria; demasiado para el servidor del piloto.
- **`@react-pdf/renderer`:** PDF con componentes React; válido, pero no sirve para DOCX y obligaría a mantener dos descripciones del documento.
- **Generar los documentos en el AI Engine (Python):** el AI Engine no debe conocer datos del producto como la institución o el docente (ADR-0001).

## Consecuencias

- Positivas: sin infraestructura nueva; DOCX y PDF coherentes; licencias permisivas.
- Negativas / costos: dos dependencias nuevas y una fuente embebida (~1 MB en el build del servidor). El diseño visual es más limitado que con HTML/CSS.
- Queda prohibido construir documentos concatenando texto del recurso como HTML o como campos de Word: el texto siempre entra como texto plano.
