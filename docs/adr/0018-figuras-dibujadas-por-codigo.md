# ADR-0018 — Figuras dibujadas por código

| Campo              | Valor      |
| ------------------ | ---------- |
| Estado             | Aceptado   |
| Fecha              | 2026-11-20 |
| Specs relacionadas | SPEC-0023  |

## Contexto

Las preguntas tipo Saber de Matemáticas necesitan figuras: rectas numéricas, gráficas de barras, tablas,
fracciones y rectángulos. Una imagen generada por IA no sirve:

- puede traer números equivocados;
- no se puede revisar;
- se imprime mal y cuesta cupo.

Además, el Word no dibuja SVG en todas las versiones de Office ni en Google Docs.

## Decisión

1. **La IA describe, el código dibuja.**
   - El modelo devuelve la figura como datos (`figure` con `kind` y sus campos, SPEC-0023 RN-04).
   - El AI Engine los valida.
   - El producto los dibuja con una función pura en `apps/web/lib/figures`, que arma un SVG con todo el
     texto escapado.
2. **Un solo SVG para todo:**
   - en el editor, como `<img src="data:image/svg+xml;…">`, nunca como HTML inyectado;
   - en el PDF, como nodo `svg` de pdfmake (vector, ADR-0009).
3. **PNG para el Word con `@resvg/resvg-js` 2.6.2 (MPL-2.0)**, una dependencia nueva.
   - Rasteriza el SVG al doble de resolución con la fuente Roboto que ya trae pdfmake (`fontBuffers`,
     `loadSystemFonts: false`), así el resultado no depende de las fuentes del servidor (Vercel).
   - El Word inserta el PNG con `ImageRun`.
   - Se usa la librería sin modificarla. La MPL-2.0 permite usarla en un producto comercial (su copyleft
     es por archivo y solo aplica si se modifican sus archivos).
4. **Contrato aditivo**: `context`, `competency` y `figure` en las preguntas de quiz y examen; `saber` en
   el pedido. Anexo de prompt `saber.v1`, como el DUA (ADR-0014).

## Alternativas consideradas

- **Imágenes generadas por IA:** inexactas, no verificables y con costo.
- **`sharp` (librsvg) para el PNG:** ya está como dependencia de Next, pero usa las fuentes del sistema,
  que en el servidor pueden faltar: el texto de la figura saldría vacío.
- **SVG en el Word (`ImageRun` tipo `svg`):** exige además un PNG de respaldo para Office antiguo y
  Google Docs. Con el PNG basta.
- **Dibujar con formas nativas de Word:** muy laborioso y distinto para cada renderizador; rompe la idea
  de un solo modelo (ADR-0009).

## Consecuencias

- Positivas:
  - figuras exactas, revisables e imprimibles en blanco y negro;
  - el mismo dibujo en el editor, el PDF y el Word;
  - sin costo de IA.
- Negativas / costos:
  - una dependencia nativa (binarios por plataforma de resvg);
  - solo cinco tipos de figura.
- Qué queda prohibido o restringido a partir de ahora:
  - insertar el SVG de una figura como HTML (`dangerouslySetInnerHTML`);
  - pedirle a la IA imágenes de figuras;
  - rasterizar con fuentes del sistema.
