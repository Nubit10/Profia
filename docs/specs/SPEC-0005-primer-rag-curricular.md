# SPEC-0005 — Primer RAG: búsqueda semántica en el currículo

| Campo                    | Valor                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| Estado                   | **Implementada** (2026-10-01)                                           |
| Fase del roadmap         | 3 · Curriculum                                                          |
| Módulo(s) responsable(s) | `apps/ai-engine` (retrieval, providers), `modules/curriculum` (cliente) |
| Agentes                  | ai-engine, rag, curriculum, devops, backend, frontend, qa, reviewer     |
| ADR relacionados         | ADR-0001, ADR-0005, ADR-0006                                            |
| Depende de               | SPEC-0004                                                               |
| Autor / Fecha            | Claude, aprobada por el product owner / 2026-10-01                      |

## 1. Objetivo

Que el docente encuentre los referentes oficiales escribiendo en sus palabras ("fracciones equivalentes con material concreto", "leer textos argumentativos"), filtrando por área y grado y viendo siempre la fuente. Es la base del retrieval que usará la generación con IA (Fase 6): _evidence over hallucination_.

## 2. Alcance

**Incluye:**

- `apps/ai-engine` mínimo: FastAPI con `/health` y `/v1/retrieval/curriculum`, configuración por variables de entorno, tests con pytest y Dockerfile.
- `AIProvider` con `embed()` y `rerank()`, en dos implementaciones: `LocalProvider` (modelos de ADR-0006) y `MockAIProvider` (tests y CI, determinista, sin descargar modelos).
- **Indexación** de los ítems publicados del catálogo en Qdrant: un fragmento por ítem (enunciado + evidencias), con metadatos (`code`, área, grados, fuente, versión, página).
- **Búsqueda híbrida** (densa + BM25, fusión RRF) con filtros de área y grado. La etapa de reranking está en el pipeline, pero desactivada por defecto (ADR-0006: no hay reranker multilingüe con licencia comercial en FastEmbed). Devuelve ítems del catálogo con puntaje, nunca texto generado.
- En la página del curso, un cuadro **"Buscar en el currículo"** que llama al AI Engine desde el servidor.
- Reindexado por comando cuando cambia el catálogo; el índice registra qué versión del catálogo contiene.
- Benchmark mínimo versionado (≥ 30 consultas con el DBA esperado) y métrica de _recall@5_.

**No incluye (explícitamente):**

- Generación de texto con LLM (Fases 5 y 6).
- Indexar materiales de los docentes (memoria pedagógica, Fase 9).
- GPU, vLLM, workers o colas.

## 3. Actores y permisos

| Actor          | Puede                                         | No puede                                            |
| -------------- | --------------------------------------------- | --------------------------------------------------- |
| Docente        | Buscar referentes desde la página de su curso | Llamar al AI Engine directamente desde el navegador |
| Web (servidor) | Llamar al AI Engine con un token de servicio  | —                                                   |
| AI Engine      | Leer el catálogo publicado e indexarlo        | Escribir en la base transaccional (ADR-0001)        |

## 4. Reglas de negocio

- **RN-01:** El AI Engine solo es accesible desde el servidor web, con un token de servicio compartido (`AI_ENGINE_TOKEN`). No se expone al navegador.
- **RN-02:** Los resultados son siempre ítems del catálogo con su `code` y su cita; el texto mostrado sale de PostgreSQL, no del índice.
- **RN-03:** Los filtros de área y grado se aplican **antes** del ranking: nunca se devuelve un DBA de otro grado como si fuera del grado pedido.
- **RN-04:** La consulta del docente es un dato, no una instrucción, y no se guarda con datos personales; los logs registran latencia y cantidad de resultados, no el texto.
- **RN-05:** Si el AI Engine no responde, la página del curso sigue funcionando con el filtro literal de SPEC-0004 y un aviso.
- **RN-06:** Cambiar un modelo exige reindexar y correr el benchmark; el resultado queda en `apps/ai-engine/benchmarks/results/`.
- **RN-07:** Límite de búsquedas por usuario (30 por minuto).

## 5. Entradas

- `POST /v1/retrieval/curriculum` con `query` (3–300 caracteres), `area` (opcional), `grade` (opcional) y `limit` (1–20).
- Comando de indexación: lee los ítems publicados (vía exportación desde la web o lectura de solo lectura de la base, a decidir en el diseño).

## 6. Salidas

- Respuesta del AI Engine: `[{ code, score }]` más metadatos de la búsqueda (modelo, versión del índice, latencia).
- La web completa cada resultado con el ítem y su cita desde PostgreSQL.
- Contrato versionado en `docs/ai/contracts/retrieval-curriculum.v1.md` (y el OpenAPI generado por FastAPI).

## 7. Errores y casos límite

| Caso                                          | Comportamiento esperado                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| AI Engine caído o lento (> 3 s)               | Aviso "La búsqueda inteligente no está disponible" y filtro literal |
| Token de servicio inválido                    | 401 en el AI Engine; la web lo registra como error de configuración |
| Índice desactualizado frente al catálogo      | La web muestra solo ítems que siguen publicados                     |
| Consulta vacía o demasiado larga              | Error de validación                                                 |
| Texto con intentos de instrucción ("ignora…") | Se trata como texto de búsqueda; no cambia el comportamiento        |

## 8. Criterios de aceptación

- **CA-0005-01:** Dado el catálogo importado, cuando se indexa, entonces Qdrant tiene un punto por ítem publicado, con sus metadatos y la versión del catálogo.
- **CA-0005-02:** Dada una búsqueda con área y grado, entonces todos los resultados son de esa área y ese grado (o de un rango que lo incluya).
- **CA-0005-03:** Dado el benchmark, _recall@5_ ≥ 0,8 con los modelos de ADR-0006, y el resultado queda registrado.
- **CA-0005-04:** Dado el AI Engine apagado, la página del curso carga y ofrece el filtro literal con un aviso.
- **CA-0005-05:** Una llamada al AI Engine sin token o con token inválido recibe 401.
- **CA-0005-06:** En CI, los tests del AI Engine corren con `MockAIProvider`, sin descargar modelos.
- **CA-0005-07:** Los resultados mostrados al docente incluyen siempre la cita de la fuente.

## 9. Seguridad y privacidad

- Token de servicio solo en variables de entorno; AI Engine en red interna (sin puerto público en producción).
- No se envían datos personales al AI Engine: solo la consulta y los filtros.
- Sin tool calling ni generación en esta spec.

## 10. Tareas

- [x] T1 — ADR-0006 aceptado; Qdrant y ai-engine en Docker Compose — `devops`
- [x] T2 — Esqueleto FastAPI, configuración, `AIProvider` (Local + Mock), tests — `ai-engine`
- [x] T3 — Indexación del catálogo (fragmentos, metadatos, versión) — `rag`
- [x] T4 — Búsqueda híbrida con filtros y reranking — `rag`
- [x] T5 — Contrato v1 y cliente en `modules/curriculum` con timeout y fallback — `backend`
- [x] T6 — Cuadro "Buscar en el currículo" en la página del curso — `frontend`
- [x] T7 — Benchmark (≥ 30 consultas) y reporte de recall@5 — `rag` / `curriculum`
- [x] T8 — CI del AI Engine (Ruff, pytest) — `devops`
- [x] T9 — Revisión contra spec y DoD — `reviewer`

## 11. Decisiones del product owner (2026-10-01)

- Se implementa justo después de SPEC-0004.
- **Hardware:** el equipo de desarrollo no tiene GPU (Intel HD 4600, i7-4702MQ, 12 GB). Todo corre en CPU. Si la latencia del reranker supera ~1,5 s por consulta en ese equipo, se prueba un reranker más liviano y el benchmark decide (ADR-0006).

## 12. Revisión (reviewer, 2026-10-01)

| Criterio   | Estado   | Evidencia                                                                                                                   |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| CA-0005-01 | Cumplido | `tests/test_retrieval.py`: 223 puntos, uno por ítem, con área, grados, fuente y versión del catálogo; índice real con mpnet |
| CA-0005-02 | Cumplido | pytest (filtros por área y grado, también con texto de "instrucciones"); E2E: todos los resultados son del curso            |
| CA-0005-03 | Cumplido | `benchmarks/results/`: recall@5 = 1,00 con mpnet y con MiniLM (meta ≥ 0,8); recall@1 0,92 y 0,89                            |
| CA-0005-04 | Cumplido | Integración web: error 500, 401, respuesta inválida, sin conexión, timeout y sin configuración → `unavailable` sin romper   |
| CA-0005-05 | Cumplido | pytest: sin token, token inválido y sin "Bearer" → 401; comparación en tiempo constante                                     |
| CA-0005-06 | Cumplido | pytest y el job de CI usan `MockAIProvider` y Qdrant en memoria; el E2E levanta el AI Engine con el proveedor de prueba     |
| CA-0005-07 | Cumplido | Integración web (texto y cita desde PostgreSQL, sin ítems reemplazados) y E2E                                               |

**Mediciones en el equipo de desarrollo (CPU, sin GPU):** indexar 223 ítems con mpnet tarda 2 minutos; cada búsqueda en el AI Engine tarda 50–230 ms, y el viaje completo desde la web, ~0,9 s. La primera búsqueda tardaba 2,1 s por la carga del modelo: se corrigió calentando los modelos al arrancar.

**Hallazgos durante la implementación:** el único reranker multilingüe disponible en FastEmbed (Jina v2) tiene licencia no comercial, así que el reranking queda desactivado (ADR-0006). Se corrigió además un test de SPEC-0002 que podía dejar rechazos de promesas sin manejar.

**No verificado todavía:** la construcción de la imagen Docker del AI Engine (`docker compose --profile ai build`) y el primer CI en GitHub (falta conectar el repositorio).

**Límite conocido:** el benchmark tiene 36 consultas redactadas por Claude y el filtro de grado deja pocos candidatos, así que es un benchmark fácil. Debe crecer con consultas reales de docentes durante la validación (Fase 0).

**Veredicto:** Aprobado.
