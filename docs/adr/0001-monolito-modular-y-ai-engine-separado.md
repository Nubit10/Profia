# ADR-0001 — Monolito modular para el producto + AI Engine separado

| Campo              | Valor                                      |
| ------------------ | ------------------------------------------ |
| Estado             | **Aceptado** (decidido en el plan maestro) |
| Fecha              | 2026-10-01                                 |
| Specs relacionadas | SPEC-0001                                  |

## Contexto

El producto necesita iterar rápido sobre un dominio pedagógico rico (instituciones, grupos, currículo, planificación, recursos, evaluación) con un equipo pequeño. La parte de IA tiene otras necesidades: Python, GPU, inferencia con vLLM, embeddings, Qdrant y escalado independiente.

## Decisión

- El **producto** es un **monolito modular** en Next.js + TypeScript. Los módulos viven en `modules/<nombre>/` y solo se usan a través de su API pública (`modules/<nombre>/index.ts`).
- El **AI Engine** es un **servicio separado** en FastAPI/Python (`ai-engine/`), con su propio despliegue y escalado.
- La comunicación producto → AI Engine es por HTTP con contratos versionados (schemas compartidos documentados en `docs/ai/`).
- El AI Engine no escribe directamente en la base transaccional del producto: devuelve salidas estructuradas y validadas; el producto decide qué se persiste.

## Alternativas consideradas

- **Microservicios por módulo:** costo operativo prematuro; contradice el principio _Incremental architecture_.
- **IA dentro de Next.js (todo en TypeScript):** el ecosistema de inferencia, RAG y GPU es Python-first; acoplaría el escalado de la web al de la inferencia.

## Consecuencias

- Positivas: un solo despliegue de producto, transacciones simples, límites de módulo claros que permiten extraer servicios después si hace falta.
- Negativas: hay que mantener contratos entre dos lenguajes y versionarlos.
- Prohibido: crear nuevos servicios desplegables sin ADR; importar internals entre módulos; que el dominio dependa de un proveedor de IA concreto.
