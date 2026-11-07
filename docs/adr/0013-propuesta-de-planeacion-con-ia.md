# ADR-0013 — Propuesta de planeación con IA (contrato `generation-planning.v1`)

| Campo              | Valor      |
| ------------------ | ---------- |
| Estado             | Aceptado   |
| Fecha              | 2026-11-06 |
| Specs relacionadas | SPEC-0014  |

## Contexto

SPEC-0014 pide que la IA proponga las unidades y los temas de un periodo, del año completo o de una
unidad, siempre a partir de los DBA del MEN del curso. Es un contrato nuevo entre el producto y el
AI Engine (AGENTS.md lo exige en un ADR) y hay que decidir tres cosas:

1. Cómo garantizar que, al proponer el año, cada DBA del grado quede en algún tema (RN-04).
2. Qué hace el motor con los códigos de DBA que el modelo invente o tome de otro periodo (RN-01).
3. Si la propuesta se guarda en algún lado antes de que el docente la acepte (RN-02).

## Decisión

**Reparto determinista de los DBA en la web, una llamada al LLM por periodo y propuesta solo en
memoria hasta que el docente la acepta.**

1. **Reparto de DBA (RN-04).** La web ordena los DBA del curso por número y los divide en bloques
   seguidos, uno por periodo, del tamaño más parejo posible (`splitDbaByPeriod` en
   `modules/planning`). Es una función pura y probada.
   - Cada periodo recibe sus DBA (`dbaCodes`) y los que todavía debe cubrir (`mustCover`): los de
     su bloque que no están ya en un tema u objetivo del curso.
   - Al proponer temas de una unidad, se envían todos los DBA del curso y `mustCover` va vacío.
   - El modelo solo agrupa y titula. El validador exige que cada código de `mustCover` quede en al
     menos un tema; si no, pide reparación.
2. **Una llamada por periodo**, en orden, con la cadena de modelos de ADR-0007. Los títulos de los
   periodos anteriores van en `titulosUsados` para no repetirse en el año. Si un periodo no logra
   salida válida tras 2 reparaciones, falla toda la propuesta (502).
3. **Códigos ajenos se quitan, no se reparan.** El motor borra de cada tema los códigos que no
   están en `dbaCodes` del periodo, y devuelve cuántos quitó (`droppedCodes`). La web vuelve a
   filtrar contra el catálogo del curso (defensa en profundidad) y marca "Sin DBA" el tema que quede
   sin ninguno. El texto del DBA que se muestra sale siempre de la base.
4. **Validador pedagógico:**
   - unidades y temas en los rangos pedidos;
   - títulos de 3 a 80 caracteres, sin repetir en la propuesta, en lo existente del periodo ni en
     `titulosUsados`;
   - descripción de máximo 200 caracteres;
   - cada tema con al menos un DBA válido cuando el periodo tiene DBA;
   - texto en español.
5. **Nada se guarda antes de aceptar.** El motor no guarda nada. La web devuelve la propuesta a la
   pantalla de revisión y solo deja rastro en `generation_logs` (modelo, versión de prompt,
   intentos, códigos quitados), nunca el texto. Aceptar es otra acción, que revalida todo en el
   servidor y agrega al final de la planeación.
6. **Límite propio.** Las propuestas no descuentan el cupo de recursos: 20 por día y 5 por minuto
   por docente (RN-08).

## Alternativas consideradas

- **Reparto solo con el prompt** — más simple, pero nada garantiza que el modelo no concentre los
  DBA en los primeros periodos, y el error solo se vería al final. Con el reparto previo, la
  cobertura de 12 de 12 es una condición que el validador comprueba periodo por periodo.
- **Una sola llamada para el año** — una salida de 50 a 60 temas pasa del cupo de tokens por
  minuto del plan gratuito de Groq y, si falla, se repite todo. Por periodo, cada llamada es chica
  y la reparación solo toca ese periodo.
- **Pedir reparación por códigos inventados** — cuesta una llamada más para algo que se corrige
  de forma determinista y sin perder información útil.
- **Guardar la propuesta como borrador en la base** — permitiría retomarla, pero agrega una tabla y
  estados que el docente no pidió. Hoy la revisión dura segundos.

## Consecuencias

- Positivas:
  - La cobertura del año es verificable y no depende de que el modelo "se acuerde".
  - Un error del modelo en un periodo no obliga a repetir los demás.
- Negativas / costos:
  - Proponer el año son 4 llamadas seguidas (unos 10 a 20 s con Groq). La pantalla muestra el
    progreso y la llamada tiene un tiempo máximo de 240 s, por debajo de `maxDuration`.
  - El reparto por bloques seguidos sigue el orden del catálogo, que no siempre es el orden en que
    un docente enseña. El docente puede mover temas después.
- Queda prohibido o restringido:
  - Mostrar un DBA con texto que venga del modelo.
  - Guardar unidades, temas u objetivos sin que el docente pulse "Agregar a la planeación".
  - Enviar al motor datos de personas: la petición no admite campos de más (`extra="forbid"`).
