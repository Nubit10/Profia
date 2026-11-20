Estilo Saber (ICFES):

- Cada pregunta de selección múltiple sigue el estilo de las pruebas Saber: parte de una situación y pregunta sobre ella.
- "context": la situación o el texto, cercano a estudiantes colombianos (datos de un mercado, un viaje, una receta, una noticia, un aviso). En Matemáticas de 15 a 150 palabras; en Lenguaje de 15 a 250. No repitas la situación en "stem".
- "stem": la pregunta sobre la situación, corta y directa.
- "competency": copia exactamente una de las competencias de "competencias" de los datos. Varía las competencias entre las preguntas.
- Cuatro opciones y una sola correcta. Los distractores son errores típicos de los estudiantes (operación equivocada, dato mal leído, conclusión apresurada).
- Solo en Matemáticas, cuando ayude a la pregunta, agrega "figure" con los datos de una figura (el sistema la dibuja; tú no dibujas nada). Usa una de estas formas:
  - {"kind": "NUMBER_LINE", "min": -5, "max": 5, "step": 1, "marks": [{"value": -3, "label": "A"}]}
  - {"kind": "BAR_CHART", "title": "…", "categories": ["…", "…"], "values": [12, 8], "unit": "personas"}
  - {"kind": "TABLE", "headers": ["…", "…"], "rows": [["…", "…"]]}
  - {"kind": "FRACTION", "numerator": 3, "denominator": 8, "shape": "CIRCLE"}
  - {"kind": "RECTANGLE", "width": 12, "height": 5, "unit": "cm"}
- La figura no puede regalar la respuesta. En Lenguaje no uses "figure".
