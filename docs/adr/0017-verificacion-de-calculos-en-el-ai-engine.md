# ADR-0017 — Verificación de cálculos en el AI Engine

| Campo              | Valor      |
| ------------------ | ---------- |
| Estado             | Aceptado   |
| Fecha              | 2026-11-20 |
| Specs relacionadas | SPEC-0022  |

## Contexto

SPEC-0022 pide recalcular las respuestas numéricas de Matemáticas sin el modelo. Para eso:

- el modelo tiene que entregar el cálculo, lo que cambia el prompt;
- el motor tiene que evaluar texto que escribió el modelo, lo que es un riesgo de seguridad si se ejecuta;
- el contrato hacia el producto suma el estado de la verificación.

AGENTS.md pide un ADR para cambiar el contrato y para incorporar tecnología nueva.

## Decisión

1. **Evaluador propio, sin dependencias.**
   - `app/generation/mathcheck.py` analiza el texto con `ast.parse(mode="eval")` y recorre el árbol con una
     lista blanca: números, `+ - * / ** %`, signo, paréntesis, `sqrt` y una sola incógnita.
   - Cualquier otro nodo (nombres, llamadas, atributos, subíndices, cadenas) se rechaza **antes** de
     calcular. Nunca se usa `eval`, `exec` ni `sympy.sympify` (que usa `eval` por dentro).
   - La aritmética es con `fractions.Fraction`, exacta, con límites de tamaño.
   - Una ecuación lineal se resuelve evaluando `f(x) = izquierda − derecha` en 0, 1 y 2: si las diferencias
     no son iguales no es lineal, y si la pendiente es 0 no tiene solución única.
2. **Anexo de prompt `math_check.v1`**, como el DUA (ADR-0014).
   - Se suma al prompt del quiz, de la sección del examen o del ítem solo en Matemáticas.
   - La versión registrada es la combinación, p. ej. `quiz.v1+math_check.v1`.
3. **Contrato aditivo.**
   - El modelo devuelve `check` en cada pregunta. El motor lo consume, decide `answerCheck` (`VERIFIED` ·
     `CORRECTED` · `REVIEW` con `note`) y no devuelve `check`.
   - El producto guarda `answerCheck` en el contenido y lo quita cuando el docente edita la pregunta.
4. **Los desacuerdos son errores de calidad** (pipeline de SPEC-0021): reparan, no tumban la generación y
   quedan en `qualityWarnings`. La única corrección automática es elegir la opción que coincide con el
   cálculo, y solo cuando coincide exactamente una.

## Alternativas consideradas

- **SymPy.** Resuelve más casos, pero `sympify`/`parse_expr` usan `eval` sobre el texto del modelo y
  agregan una dependencia pesada al Space gratuito. Para aritmética escolar y ecuaciones lineales basta un
  evaluador propio. Se puede revisar si llegan ecuaciones cuadráticas o álgebra simbólica.
- **Pedirle al modelo que verifique su propia cuenta.** No es verificación: el mismo modelo repite el
  error.
- **Corregir siempre la respuesta con el cálculo.** El cálculo también lo escribe el modelo y puede estar
  mal planteado. Corregir solo cuando coincide exactamente una opción, y si no pedir revisión, deja la
  decisión al docente (teacher-in-control).

## Consecuencias

- Positivas:
  - las claves de Matemáticas dejan de depender de que el modelo sume bien;
  - el docente sabe en qué preguntas fijarse.
- Negativas / costos:
  - unos pocos tokens más por pregunta;
  - preguntas de geometría, estadística o conceptuales no se verifican.
- Qué queda prohibido o restringido a partir de ahora:
  - evaluar texto del modelo con `eval`, `exec` o librerías que lo usen;
  - cambiar una respuesta del modelo por una que no esté en las opciones.
