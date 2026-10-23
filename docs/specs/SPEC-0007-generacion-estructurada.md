# SPEC-0007 — AI Engine: generación estructurada y primera sugerencia con IA

| Campo                    | Valor                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Estado                   | **Implementada** (2026-10-01)                                                           |
| Fase del roadmap         | 5 · AI Engine                                                                           |
| Módulo(s) responsable(s) | `apps/ai-engine` (providers, generation, validation, prompts), `modules/planning` (uso) |
| Agentes                  | ai-engine, architect, privacy, backend, frontend, qa, reviewer                          |
| ADR relacionados         | ADR-0001, ADR-0006, **ADR-0007**                                                        |
| Depende de               | SPEC-0005, SPEC-0006                                                                    |
| Autor / Fecha            | Claude, aprobada por el product owner / 2026-10-01                                      |

## 1. Objetivo

Dejar lista la **generación con LLM** en el AI Engine, con salidas estructuradas y validadas antes de llegar al producto (plan maestro §7), y probarla con una primera funcionalidad pequeña y útil: **sugerir objetivos de aprendizaje** para un tema de la planeación, a partir de los DBA del curso. El profesor acepta, edita o descarta cada sugerencia (_teacher-in-control_) y puede calificarla: es el primer paso del ciclo "el profesor evalúa cada producción y el sistema mejora".

## 2. Alcance

**Incluye:**

- `AIProvider.generate()` y `stream()` con una implementación **`OpenAICompatibleProvider`**, que sirve igual para Ollama, vLLM y API de modelos abiertos (ADR-0007), más `MockAIProvider` para tests y CI.
- **Cadena de respaldo** configurable: Groq `qwen/qwen3.8-27b` → Groq `openai/gpt-oss-120b` → Ollama local (ADR-0007). Si un proveedor falla, está caído o llegó a su límite (429), se pasa al siguiente; cada respuesta indica qué proveedor la generó.
- **Pipeline de generación estructurada:** constructor de contexto → LLM → schema Pydantic → validador pedagógico → reparación (máximo 2 intentos) → respuesta o error.
- **Separación de instrucciones y datos:** el contexto (curso, tema, objetivos existentes, DBA) va como datos delimitados; el texto del profesor nunca se interpreta como instrucción.
- **Prompts versionados** en `apps/ai-engine/prompts/` (cada respuesta indica la versión del prompt y el modelo).
- **Contrato** `POST /v1/generation/objective-suggestions` (v1) con token de servicio, timeout y respuesta solo validada.
- **Validador pedagógico** de esta tarea: de 1 a 5 objetivos, verbos observables, en español, sin repetir objetivos existentes, y **cada objetivo cita solo DBA que estaban en el contexto** (sin códigos inventados).
- **En la planeación:** botón "Sugerir objetivos con IA" en cada tema → lista de sugerencias con su DBA → Aceptar (crea el objetivo vinculado), Editar antes de aceptar, o Descartar.
- **Registro de generación** en la web (tabla `generation_logs`): tarea, modelo, versión de prompt, latencia, intentos, resultado; y por sugerencia: aceptada, editada o descartada, más calificación opcional (👍/👎 y comentario).
- **Límites:** 20 generaciones por profesor por hora y tope configurable por espacio; timeout de 90 s.
- **Benchmark de generación** versionado: casos (tema + DBA) con chequeos automáticos (schema válido, códigos válidos, cantidad, idioma) y reporte de tasa de validez y latencia.

**No incluye (explícitamente):**

- Generar talleres, quices, exámenes o planes de aula (Fase 6).
- Colas y workers con Redis (llegan cuando la generación larga lo exija, Fase 6).
- Fine-tuning (Fase 12).
- Configurar el servidor con GPU o contratar la API: es una decisión del product owner (ADR-0007). Esta spec deja ambos listos por configuración.

## 3. Actores y permisos

| Actor                    | Puede                                                                                | No puede                                             |
| ------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Profesor dueño del curso | Pedir sugerencias para sus temas; aceptarlas, editarlas, descartarlas y calificarlas | Pedir sugerencias para cursos ajenos                 |
| Web (servidor)           | Llamar al AI Engine con el token de servicio                                         | Exponer el AI Engine o la clave del LLM al navegador |
| AI Engine                | Llamar al LLM configurado                                                            | Escribir en la base del producto (ADR-0001)          |

## 4. Reglas de negocio

- **RN-01:** Ninguna sugerencia se guarda como objetivo sin una acción explícita del profesor.
- **RN-02:** Al LLM solo llega contexto pedagógico: asignatura, grado, título y descripción del tema, objetivos existentes y DBA del curso. Nunca nombres, correos, institución ni datos de estudiantes.
- **RN-03:** Toda salida pasa por el schema y el validador. Si falla, se intenta reparar (máximo 2 veces); si sigue fallando, el profesor ve "No pudimos generar sugerencias válidas" y nada se muestra a medias.
- **RN-04:** Un objetivo sugerido solo puede vincular DBA que estaban en el contexto enviado (_evidence over hallucination_); un código desconocido invalida la sugerencia.
- **RN-05:** El modelo, el proveedor y la versión del prompt se registran con cada generación (trazabilidad, plan maestro §20).
- **RN-06:** Las calificaciones y los cambios del profesor quedan ligados a la generación, al modelo y al prompt, para alimentar el benchmark y la mejora.
- **RN-07:** Si el AI Engine o el LLM no están disponibles, la planeación sigue funcionando y el botón informa que la sugerencia no está disponible.

## 5. Entradas

- **Web → AI Engine:** `{ subject, grade, topic: { title, description }, existingObjectives: string[], dba: [{ code, statement, evidences[] }], count (1–5) }`.
- **Profesor:** `topicId`, `count` (por defecto 3); luego, por sugerencia: aceptar (con texto editado opcional), descartar, calificar (`up` · `down`, comentario ≤ 500).

## 6. Salidas

- **AI Engine → web:** `{ suggestions: [{ statement, dbaCodes[] }], meta: { provider, model, promptVersion, attempts, latencyMs } }`.
- Tabla `generation_logs` y `generation_feedback` en la web.
- Contrato `docs/ai/contracts/generation-objective-suggestions.v1.md`.

## 7. Errores y casos límite

| Caso                                               | Comportamiento esperado                                     |
| -------------------------------------------------- | ----------------------------------------------------------- |
| El LLM devuelve JSON inválido                      | Reparación con el error; tras 2 intentos, error controlado  |
| Sugerencia con un DBA que no estaba en el contexto | Se descarta y se repara; nunca se muestra                   |
| Tema con texto tipo "ignora tus instrucciones…"    | Se trata como dato; la salida sigue el schema               |
| LLM lento (> 90 s) o caído                         | "La sugerencia no está disponible en este momento"          |
| Límite de generaciones alcanzado                   | "Alcanzaste el límite de sugerencias por hora"              |
| Curso sin área o sin DBA                           | Se sugieren objetivos sin DBA, con el aviso correspondiente |

## 8. Criterios de aceptación

- **CA-0007-01:** Con `MockAIProvider`, el pipeline completo (contexto → schema → validador → respuesta) funciona en CI, sin red ni modelos.
- **CA-0007-02:** Cambiar entre Ollama, vLLM y una API compatible es solo configuración (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`); hay un test que lo demuestra contra un servidor OpenAI-compatible simulado.
- **CA-0007-03:** Una salida inválida se repara; tras 2 intentos fallidos, la respuesta es un error controlado y no se muestra nada al profesor.
- **CA-0007-04:** Ninguna sugerencia mostrada contiene un código de DBA ausente del contexto.
- **CA-0007-05:** Lo que se envía al LLM no contiene nombre, correo ni institución del profesor (test sobre el prompt construido).
- **CA-0007-06:** Aceptar una sugerencia crea el objetivo vinculado a sus DBA; descartarla no crea nada; ambas quedan registradas con su generación.
- **CA-0007-07:** Calificar una sugerencia guarda la calificación ligada al modelo y la versión del prompt.
- **CA-0007-08:** Con el AI Engine apagado, la planeación funciona y el botón muestra el aviso.
- **CA-0007-09:** El benchmark de generación reporta la tasa de salidas válidas y la latencia, y su resultado queda versionado.
- **CA-0007-10:** Un profesor no puede pedir sugerencias para un tema ajeno (404).

## 9. Seguridad y privacidad

- Clave del proveedor (`LLM_API_KEY`) solo en el entorno del AI Engine; la web no la conoce.
- Prompt con instrucciones fijas en el rol de sistema y contexto como datos JSON delimitados; tests de inyección.
- Rate limiting por profesor y tope por espacio; los logs guardan métricas, no el texto generado ni el contexto.
- Si se usa un proveedor externo (ADR-0007, opción C), antes del lanzamiento comercial se revisan sus términos y la Ley 1581.

## 10. Tareas

- [x] T1 — `OpenAICompatibleProvider` (generate, stream, JSON) y Mock; configuración — `ai-engine`
- [x] T2 — Pipeline: contexto, schema Pydantic, validador, reparación; prompts versionados — `ai-engine`
- [x] T3 — Endpoint y contrato v1; tests (simulador OpenAI-compatible, inyección, privacidad) — `ai-engine` / `qa`
- [x] T4 — Ollama en desarrollo (modelo pequeño) y benchmark de generación — `ai-engine` / `devops`
- [x] T5 — Web: cliente con timeout, `generation_logs`/`generation_feedback`, límites — `backend` / `database`
- [x] T6 — UI en la planeación: sugerir, aceptar, editar, descartar, calificar — `frontend`
- [x] T7 — Revisión de privacidad y contra spec — `privacy` / `reviewer`

## 11. Decisiones del product owner (2026-10-01)

- Plan por etapas aprobado (ADR-0007), con **Groq** como proveedor de la Etapa 0 y Ollama de respaldo.
- Primera funcionalidad: **sugerir objetivos con IA**. Después, talleres y quices (Fase 6).
- La clave de Groq la crea el product owner. Mientras tanto, desarrollo y tests con Ollama y `MockAIProvider`.

## 12. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado   | Evidencia                                                                                                      |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| CA-0007-01 | Cumplido | `tests/test_generation.py` (endpoint con `MockLLM`); E2E de punta a punta con el AI Engine de prueba           |
| CA-0007-02 | Cumplido | Tests contra un servidor OpenAI-compatible simulado: Groq, Ollama y vLLM cambian solo por configuración        |
| CA-0007-03 | Cumplido | Reparación con los errores concretos; tras 2 reparaciones, `GenerationInvalidError` → 502 → mensaje controlado |
| CA-0007-04 | Cumplido | Validador del AI Engine (códigos fuera del contexto invalidan) y filtro en la web (defensa en profundidad)     |
| CA-0007-05 | Cumplido | Contrato con `extra="forbid"` (422 con nombre, correo o institución) y test sobre la petición que arma la web  |
| CA-0007-06 | Cumplido | Integración (aceptar, editar, descartar, doble clic) y E2E                                                     |
| CA-0007-07 | Cumplido | Integración (calificación ligada a modelo y versión de prompt) y E2E (👎 con comentario)                       |
| CA-0007-08 | Cumplido | Integración: AI Engine caído, 503 y 502 → respuesta controlada y registro `UNAVAILABLE`/`INVALID`              |
| CA-0007-09 | Cumplido | `benchmarks/results/2026-10-01-generation-qwen3.8-27b.json` (Groq) y la corrida con Ollama local               |
| CA-0007-10 | Cumplido | Integración: tema o sugerencia ajenos → NOT_FOUND sin llamar a la IA                                           |

**Benchmark con Ollama (Qwen3 1.7B, CPU del equipo de desarrollo, con la máquina ocupada en otras pruebas):** 0.625 de salidas válidas, mediana de 175 s por sugerencia; 2 de 8 casos superaron el timeout. En una prueba aislada, la misma sugerencia salió válida al primer intento en 66 s. Confirma lo que dice ADR-0007: el modelo local sirve para desarrollar y como respaldo; el servicio real va por Groq.

**Hallazgos corregidos durante la implementación:**

- Al aceptar una sugerencia, el refresco de la página volvía a pedir sugerencias nuevas (y gastaba cupo del proveedor): el panel ya no depende de la identidad de las acciones.
- Crear un tema sin "sesiones estimadas" fallaba ("expected number to be >=1"): el campo opcional convertía `null` en 0. Era un error de SPEC-0006 que los E2E no cubrían; ahora sí.
- Prettier reformateaba los prompts versionados: quedaron excluidos.

**Benchmark con Groq (`qwen/qwen3.8-27b`, 8 casos seguidos):** 8/8 salidas válidas, todas al primer intento. Una sugerencia aislada tarda ~1 s; en la corrida seguida la mediana fue 10 s y el máximo 21 s, porque el benchmark agota el cupo de 8K tokens por minuto y el AI Engine espera lo que indica Groq. Los objetivos revisados a mano (Transición a 11°) tienen buena calidad.

**Hallazgos corregidos al activar Groq:**

- Con el cupo por minuto agotado, Groq responde 429 y la cadena caía al modelo local (minutos por sugerencia). Ahora, si el 429 trae `Retry-After` ≤ 20 s, el AI Engine espera y reintenta el mismo modelo (máximo 2 veces); si no trae la cabecera o la espera es mayor, pasa al siguiente modelo.
- Los tests del AI Engine leían el `.env` real (con la clave de Groq) y llamaban al proveedor de verdad: todos los `Settings` de prueba usan `_env_file=None`.

**Términos de Groq revisados (2026-10-01):** el [Services Agreement](https://console.groq.com/docs/legal/services-agreement) permite integrar la API en una aplicación propia y ofrecerla a usuarios finales; Groq no usa entradas ni salidas para entrenar; por defecto no retiene datos de inferencia, salvo hasta 30 días para fiabilidad y abuso ([Your data](https://console.groq.com/docs/your-data)), y se puede activar retención cero en la consola. El servicio gratuito no tiene indemnización por propiedad intelectual. Como Profe no envía datos personales (RN-02), es apto para los dos colegios piloto.

**Capacidad del plan gratuito:** 8K tokens/min por modelo ≈ 5 sugerencias por minuto en toda la plataforma, y ~130 al día con el primer modelo (más ~130 con gpt-oss). Es suficiente para el piloto; los talleres y quices (~5.500 tokens cada uno) deben diseñarse con este límite en mente (Fase 6).
