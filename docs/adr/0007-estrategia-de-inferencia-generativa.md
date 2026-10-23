# ADR-0007 — Estrategia de inferencia generativa (LLM)

| Campo              | Valor        |
| ------------------ | ------------ |
| Estado             | **Aceptado** |
| Fecha              | 2026-10-01   |
| Specs relacionadas | SPEC-0007    |

## Contexto

Desde la Fase 6, Profe generará planes de aula, talleres, quices, exámenes y temas. El plan maestro pide modelos **open-weight** autoalojados (vLLM en GPU para producción, Ollama para desarrollo) y que el proveedor se pueda cambiar sin tocar el dominio. El equipo de desarrollo no tiene GPU (i7-4702MQ de 2013, 12 GB RAM, ver medición abajo). Hay que decidir dónde corre el modelo en desarrollo, en los pilotos con docentes y en producción.

Supuesto de consumo por recurso generado (p. ej. un taller): ~3.000 tokens de entrada (curso, tema, objetivos, DBA) y ~2.500 de salida.

## Opciones y costos (precios consultados el 2026-10-01; cambian con frecuencia)

### A. Servidor propio con GPU + vLLM (lo que pide el plan para producción)

| Proveedor y máquina                                   | Precio                                         | Modelo que soporta bien                   |
| ----------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| **Hetzner GEX44** · RTX 4000 SFF Ada 20 GB (dedicado) | ~€184–234/mes + €114 de instalación            | Hasta ~14B (24B cuantizado, justo)        |
| **RunPod** · L40S 48 GB (por hora, pausable)          | US$0,79–0,99/h → ~US$580–720/mes si corre 24/7 | 32B cuantizado (Qwen3 32B, Mistral Small) |
| **RunPod** · A100 80 GB                               | US$1,19–1,39/h → ~US$870–1.000/mes 24/7        | 70B cuantizado                            |
| **Vast.ai** · A100 80 GB (marketplace)                | US$0,50–1,80/h, variable según el anfitrión    | 70B cuantizado                            |
| **Lambda** · A100 / H100                              | US$1,99–2,79/h · US$2,49–3,99/h                | 70B                                       |

Ventajas: control total, ningún dato sale de nuestra infraestructura, costo fijo. Desventajas: operar el servidor (actualizaciones, monitoreo, respaldos); con poco uso, se paga capacidad ociosa.

### B. Ollama en el equipo de desarrollo

Costo cero. Medido en el equipo de desarrollo (i7-4702MQ, sin GPU): **Qwen3 1.7B genera ~9 tokens/s**. Unos objetivos (~150 tokens) salen en ~20 s, pero un taller completo (~2.500 tokens más el contexto) tardaría ~6 minutos. Sirve para desarrollar y como respaldo, no para el servicio diario.

### C. API de modelos abiertos (los mismos modelos open-weight, servidos por un tercero)

| Proveedor · modelo            | Entrada / salida por millón de tokens | Costo estimado por recurso | 10.000 recursos/mes |
| ----------------------------- | ------------------------------------- | -------------------------- | ------------------- |
| DeepInfra · Mistral Small 24B | US$0,05 / 0,075                       | ~US$0,0003                 | ~US$3               |
| DeepInfra · Qwen3 32B         | US$0,08 / 0,29                        | ~US$0,001                  | ~US$10              |
| DeepInfra · Llama 3.3 70B     | US$0,23 / 0,40                        | ~US$0,0017                 | ~US$17              |
| Groq · Llama 3.3 70B (rápido) | US$0,59 / 0,79                        | ~US$0,0037                 | ~US$37              |

Ventajas: costo casi nulo con poco volumen, sin operar servidores, modelos grandes desde el día uno. Desventajas: el contenido (no datos personales) viaja a un tercero, en Estados Unidos; dependencia operativa; el plan lo admite solo como respaldo "nunca acoplado al dominio".

**Punto de equilibrio aproximado:** un GEX44 (~€200/mes) equivale a unos 200.000 recursos/mes en la API de Qwen3 32B. Al inicio, el servidor propio se justifica por control y privacidad, no por costo.

## Decisión del product owner (2026-10-01)

Se aprueba el plan por etapas con **Groq** como proveedor de la Etapa 0. Cadena inicial, verificada en la documentación de Groq:

| Orden | Proveedor      | Modelo                | Licencia   | Límites del plan gratuito (por modelo)                   |
| ----- | -------------- | --------------------- | ---------- | -------------------------------------------------------- |
| 1     | Groq           | `qwen/qwen3.8-27b`    | Apache-2.0 | 30 pet./min · 1.000 pet./día · 8K tok/min · 200K tok/día |
| 2     | Groq           | `openai/gpt-oss-120b` | Apache-2.0 | 30 pet./min · 1.000 pet./día · 8K tok/min · 200K tok/día |
| 3     | Ollama (local) | `qwen3:1.7b`          | Apache-2.0 | Sin límite; ~9 tok/s en el equipo de desarrollo          |

Una sugerencia de objetivos usa ~1.500 tokens (~130 al día con el primer modelo). El límite que más pesa es el de tokens por minuto: ~5 sugerencias por minuto por modelo en toda la plataforma; un taller o quiz (~5.500 tokens) cabe ~1 por minuto y ~35 al día por modelo. Para la Fase 6 hace falta una cola o Cerebras como eslabón adicional. Medido en SPEC-0008: un quiz o taller usa ~2.000 tokens (no 5.500), unos 100 al día por modelo; la web genera en segundo plano con un semáforo de 2 (ADR-0008) y el AI Engine espera hasta 60 s el cupo por minuto. Cerebras queda como opción para agregar después. Fuentes: [Groq — razonamiento](https://console.groq.com/docs/reasoning), [Groq — límites](https://console.groq.com/docs/rate-limits), [Qwen3.8-27B en Hugging Face](https://huggingface.co/Qwen/Qwen3.8-27B).

## Decisión propuesta (revisada el 2026-10-01: presupuesto inicial US$0)

El product owner tiene dos clientes y no puede asumir costos de infraestructura todavía. La estrategia avanza por **etapas**, y el código es el mismo en todas: pasar de una a otra es configuración.

**Base técnica (todas las etapas):** un solo `OpenAICompatibleProvider` (Ollama, vLLM y casi todos los proveedores de API hablan la misma API) con una **cadena de respaldo**: si el primer proveedor falla o llega a su límite, se intenta el siguiente. Además, `MockAIProvider` para tests.

### Etapa 0 — Ahora (US$0)

| Orden | Proveedor (plan gratuito)                       | Modelo                    | Límites del plan gratuito                                          |
| ----- | ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| 1     | **Cerebras**                                    | Qwen3 32B o Llama 3.3 70B | ~1.000.000 tokens/día, 30.000 tokens/min, contexto de 8.192 tokens |
| 2     | **Groq**                                        | Qwen3 32B                 | 30 peticiones/min, 6.000 tokens/min, 14.400 peticiones/día         |
| 3     | **Ollama** en el equipo (respaldo y desarrollo) | Qwen3 1.7B                | Sin límite; ~9 tokens/s medidos en el equipo de desarrollo         |

Con ~5.500 tokens por recurso, Cerebras alcanza para ~180 recursos al día y Groq agrega unos cuantos por minuto: suficiente para dos colegios piloto. Son los mismos modelos open-weight del plan, así que lo aprendido sirve después en el servidor propio.

Groq no pide tarjeta; Cerebras puede pedir un medio de pago para liberar el cupo completo, sin cobrar dentro del plan gratuito. Si no se registra tarjeta, la cadena empieza en Groq.

Descartados en esta etapa: **Gemini gratis** (sus términos prohíben el uso comercial en el plan gratuito y usan las entradas para entrenar) y los modelos **`:free` de OpenRouter** (50 peticiones/día sin compra previa).

### Etapa 1 — Con ingresos regulares (centavos al mes)

API de pago por uso de modelos abiertos (p. ej. DeepInfra, Qwen3 32B a ~US$0,001 por recurso), con recarga prepagada y tope mensual, como primer eslabón de la cadena. Los planes gratuitos quedan de respaldo. Disparador: cuando los límites gratuitos empiecen a frenar a los docentes, o un cliente pida garantías de servicio.

### Etapa 2 — Arquitectura paga con GPU propia

Servidor con GPU y vLLM (Hetzner GEX44, ~€200/mes, o RunPod L40S por horas) como primer eslabón; la API y los planes gratuitos, de respaldo. Disparadores, cualquiera de estos:

- un cliente institucional exige que el contenido no salga de nuestra infraestructura;
- el gasto de API se acerca al costo del servidor;
- los ingresos mensuales cubren holgadamente el servidor.

Como el proveedor es compatible con OpenAI, esta etapa no cambia código: se instala vLLM, se apunta `LLM_BASE_URL` al servidor y se corre el benchmark de generación antes de cambiar.

### Siempre

- **El modelo concreto** se elige con el benchmark de generación versionado y con la calificación de los docentes (feedback de la Fase 6).
- **Antes de usar un plan gratuito con clientes reales**, se revisan sus términos de uso comercial y de retención de datos. Groq: revisado el 2026-10-01 (permite uso comercial con usuarios finales, no entrena con los datos, retención máxima de 30 días o cero si se activa ZDR; ver SPEC-0007 §12). Cerebras: pendiente.

## Consecuencias

- Toda petición al LLM pasa por el AI Engine: la web nunca habla con el proveedor.
- Nunca se envían datos personales al modelo (plan maestro §18): solo contexto pedagógico (curso, tema, objetivos, DBA).
- La opción C exige un ADR de seguimiento antes del lanzamiento comercial, con revisión de términos del proveedor y la Ley 1581 de 2012 (aunque no se envíen datos personales).
- Licencias: se verifica la licencia de cada modelo antes de adoptarlo (Qwen3 y Mistral Small: Apache-2.0; Llama: licencia comunitaria de Meta, con condiciones).

## Fuentes de precios

- RunPod, Vast.ai y Lambda: [spheron.network — comparación 2026](https://www.spheron.network/blog/gpu-cloud-pricing-comparison-2026/), [flexprice.io — precios de RunPod](https://flexprice.io/blog/runprod-pricing-guide-with-gpu-costs)
- Hetzner: [effloow.com — Hetzner GPU 2026](https://effloow.com/articles/hetzner-cloud-ai-gpu-server-guide-2026), [nota de prensa de Hetzner](https://www.hetzner.com/de/pressroom/new-gpu-server/)
- API: [pricepertoken.com — DeepInfra](https://pricepertoken.com/endpoints/deepinfra), [costbench.com — DeepInfra vs Groq](https://costbench.com/compare/deepinfra-vs-groq/)
- Planes gratuitos: [Cerebras (costbench)](https://costbench.com/software/llm-api-providers/cerebras-inference/free-plan/), [Groq (tokenmix)](https://tokenmix.ai/blog/groq-free-tier-limits-2026), [OpenRouter (klymentiev)](https://klymentiev.com/blog/openrouter-free-tier), [Gemini (pasqualepillitteri)](https://pasqualepillitteri.it/en/news/6683/gemini-2-5-flash-free-1m-tokens)
- Velocidad de Ollama: medida en el equipo de desarrollo el 2026-10-01 (Qwen3 1.7B: 9,2 tokens/s de salida, 36 tokens/s de lectura del prompt).
