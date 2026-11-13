
Enfoque DUA (Diseño Universal para el Aprendizaje). El docente pidió este taller con enfoque DUA: el taller se diseña desde el inicio para que todos los estudiantes del grupo puedan aprender, con opciones según los tres principios del DUA. Cumple además estas reglas:

DUA-1. Cada actividad trae un objeto "udl" con:
   - "representation": 2 o 3 formas de presentar el contenido de la actividad (por ejemplo: texto corto, imagen o esquema, material concreto, explicación oral, video o audio, demostración). Cada una es una frase concreta para esta actividad, no una categoría.
   - "expression": 2 o 3 formas en que el estudiante puede responder o mostrar lo aprendido, entre las que elige (por ejemplo: escribir, dibujar o hacer un esquema, explicar en voz alta, construir con material, dramatizar). Todas deben permitir lograr el "expectedOutcome".
   - "engagement": una frase que conecta la actividad con la vida, el entorno o los intereses del estudiante y le da algo para elegir.
   - "supports": de 1 a 3 apoyos graduados para quien lo necesite (por ejemplo: una pista, un ejemplo resuelto, un organizador gráfico, un banco de palabras).
   - "challenge": un reto corto para quien termina antes, o una cadena vacía.
DUA-2. El taller trae un objeto "udlGuide" con:
   - "barriers": de 2 a 5 objetos {"barrier": "…", "support": "…"}: barreras que el grupo puede encontrar en este taller (por ejemplo, textos largos, vocabulario nuevo, atención sostenida, motricidad fina) y el apoyo que el docente puede ofrecer. Describe barreras del entorno o de la tarea para el grupo, nunca de un estudiante concreto, y nunca diagnósticos.
   - "selfAssessment": de 2 a 4 frases cortas que el estudiante marca al final, en primera persona y en presente ("Puedo…", "Entiendo…").
DUA-3. Lenguaje respetuoso y desde las fortalezas. No incluyas nombres, diagnósticos ni datos personales.
DUA-4. En el JSON de respuesta, "udl" va dentro de cada actividad y "udlGuide" al nivel del taller:
    {"…": "…", "moments": [{"name": "…", "activities": [{"title": "…", "…": "…", "udl": {"representation": ["…", "…"], "expression": ["…", "…"], "engagement": "…", "supports": ["…"], "challenge": "…"}}]}], "udlGuide": {"barriers": [{"barrier": "…", "support": "…"}], "selfAssessment": ["Puedo …"]}}
    Si te piden reescribir una sola actividad, devuelve su "udl" completo dentro de la actividad.
