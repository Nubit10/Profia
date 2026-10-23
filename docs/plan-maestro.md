# Plan Maestro — Plataforma Educativa con IA

> Spec-Driven Development · Arquitectura · IA propia · Agentes · Roadmap
>
> Transcripción en Markdown de `Plan_Maestro_Plataforma_Educativa_IA_Spec_Driven.docx`.
> **Fuente de verdad de producto y arquitectura**, junto con las specs (`docs/specs/`) y los ADR (`docs/adr/`).
> Si este archivo y el `.docx` difieren, manda el `.docx`. Cualquier cambio de dirección se registra como ADR, no editando este archivo en silencio.

| Elemento        | Decisión                                                             |
| --------------- | -------------------------------------------------------------------- |
| Producto        | Plataforma de gestión y producción pedagógica asistida por IA        |
| Mercado inicial | Docentes e instituciones educativas, con enfoque inicial en Colombia |
| Arquitectura    | Monolito modular para producto + AI Engine independiente             |
| IA              | Modelos open-weight autoalojados + RAG + tools + memoria pedagógica  |
| Desarrollo      | Spec-Driven Development con Claude Code y agentes especializados     |
| Principio       | La IA asiste; el docente conserva el control pedagógico              |

## 1. Visión del producto

No construir otro chatbot que genera talleres. Construir un sistema donde la IA trabaja dentro de una estructura pedagógica persistente.

```
CURRÍCULO
   ↓
PLANIFICACIÓN
   ↓
UNIDAD → TEMA → OBJETIVO
   ↓
ACTIVIDAD / MATERIAL
   ↓
EVALUACIÓN → RESULTADOS
   ↓
DIFICULTADES → REFUERZO → NUEVA EVALUACIÓN
```

### 1.1 Problema

- La IA genérica produce materiales aislados y depende de prompts libres.
- El docente pierde tiempo organizando, corrigiendo, adaptando y archivando materiales.
- Se pierde la alineación con el currículo y la planificación real.
- Hay poca trazabilidad entre planificar, enseñar, evaluar y reforzar.
- La diferenciación suele hacerse a mano.

### 1.2 Propuesta

- Contexto pedagógico persistente.
- Generación mediante blueprints, no solo prompts.
- Currículo recuperable mediante RAG.
- Memoria pedagógica de grupos y materiales.
- Evaluación conectada con objetivos y resultados.
- Versiones diferenciadas vinculadas al original.
- Exportación DOCX/PDF.
- Recomendaciones de próximos pasos con decisión final del docente.

## 2. Principios rectores

1. **Teacher-in-control:** la IA propone; el docente revisa y decide.
2. **Structured generation:** cada generador importante usa un blueprint.
3. **Traceability first:** todo recurso conserva su contexto.
4. **Server is source of truth:** permisos, resultados y estados críticos no dependen del cliente.
5. **AI is a subsystem:** el producto no depende de un único proveedor.
6. **Open-model first:** producción debe poder funcionar con modelos open-weight.
7. **Provider abstraction:** cambiar modelo/proveedor sin reescribir el dominio.
8. **Privacy by design:** minimizar datos personales y sensibles.
9. **No diagnosis:** la IA no diagnostica estudiantes.
10. **Evidence over hallucination:** recuperar fuentes antes de afirmar contenido curricular.
11. **Human-readable outputs:** documentos listos para uso docente.
12. **Incremental architecture:** evitar microservicios prematuros.

## 3. Stack tecnológico

| Capa        | Tecnología                         | Uso                                           |
| ----------- | ---------------------------------- | --------------------------------------------- |
| Frontend    | Next.js + TypeScript               | Aplicación web / App Router                   |
| UI          | Tailwind + shadcn/ui               | Sistema visual                                |
| Iconos      | React Icons                        | Iconografía                                   |
| Estado      | Zustand                            | UI/filtros/selección; **no** fuente de verdad |
| Formularios | React Hook Form                    | Formularios                                   |
| Toasts      | Sileo                              | Notificaciones                                |
| Auth        | NextAuth                           | Autenticación/sesiones                        |
| DB          | PostgreSQL                         | Fuente transaccional                          |
| ORM         | Prisma                             | Persistencia/migraciones                      |
| Multimedia  | Cloudinary                         | Imágenes/recursos                             |
| Email       | Nodemailer                         | Correos                                       |
| Push        | Firebase FCM                       | Notificaciones                                |
| AI API      | FastAPI + Python                   | AI Engine                                     |
| Inferencia  | vLLM                               | Producción GPU                                |
| IA local    | Ollama                             | Desarrollo                                    |
| LLM         | Open-weight, elegido por benchmark | Generación                                    |
| Vector DB   | Qdrant                             | RAG/búsqueda                                  |
| Embeddings  | Modelo open-source multilingüe     | Vectores                                      |
| Reranker    | Modelo open-source                 | Reordenamiento                                |
| Jobs        | Redis + workers                    | Procesamiento asíncrono                       |
| Documentos  | DOCX + PDF                         | Material imprimible                           |
| Tests       | Vitest + Playwright                | Unit/E2E                                      |
| CI/CD       | GitHub Actions                     | Calidad/despliegue                            |
| Infra       | Docker                             | Reproducibilidad                              |

## 4. Arquitectura

El producto principal será un monolito modular. El AI Engine será independiente por necesidades de Python, GPU, inferencia y escalamiento.

```
                     ┌──────────────────────┐
                     │      Next.js Web     │
                     │ UI + App Router/API  │
                     └──────────┬───────────┘
                                │
                     ┌──────────▼───────────┐
                     │   Application Core   │
                     │ Auth · Curriculum    │
                     │ Planning · Groups    │
                     │ Library · Assessment │
                     │ Documents · Analytics│
                     └──────┬────────┬──────┘
                            │        │
                      PostgreSQL   Cloudinary
                       + Prisma
                            │
                            ▼
                     ┌───────────────┐
                     │   AI Gateway  │
                     │    FastAPI    │
                     └───────┬───────┘
                             │
                ┌────────────┼─────────────┐
                ▼            ▼             ▼
              vLLM         Qdrant       Workers
                │            │
                ▼            ▼
          Open-weight LLM  RAG/Hybrid
```

## 5. Estructura del repositorio

```
educational-ai-platform/
├── app/ (public, auth, dashboard, curriculum, planning, library, assessments, students, institutions, api)
├── components/
├── modules/ (auth, institutions, teachers, groups, students, curriculum, planning, resources,
│             assessments, analytics, documents, notifications, audit)
├── lib/ (db, auth, permissions, storage, documents, validation, observability)
├── prisma/
├── docs/ (specs, adr, architecture, curriculum, ai, security, testing)
├── tests/
├── .claude/
├── AGENTS.md
├── CLAUDE.md
└── README.md

ai-engine/
├── app/ (api, domain, retrieval, generation, tools, validation, providers, workers)
├── tests/
├── prompts/
├── configs/
├── Dockerfile
└── README.md
```

## 6. Modelo de dominio

```
Institution
 ├── Campus
 ├── Membership
 └── Teacher
      ├── Subject
      └── Group
           ├── Student
           └── LearningSupportProfile

Curriculum
 ├── Area
 ├── Grade
 ├── Standard
 ├── DBA
 ├── Guideline
 └── SourceDocument

AcademicPeriod
 └── Unit
      └── Topic
           ├── Objective
           ├── Competency
           ├── Lesson
           ├── Resource
           ├── Assessment
           └── LearningEvidence

Resource
 ├── Version
 ├── Blueprint
 ├── CurriculumLink
 ├── DifferentiatedVersion
 └── Document
```

## 7. AI Engine

```
Teacher request
      ↓
AI Gateway
      ↓
Load context
 ┌────┼───────────────┬──────────────┐
 ▼    ▼               ▼              ▼
DB  Curriculum      Qdrant       Pedagogical Memory
 └────┴───────────────┴──────────────┘
                    ↓
              Context builder
                    ↓
              LLM / Tool calling
                    ↓
             Structured output
                    ↓
          Pedagogical Validator
             ┌──────┴──────┐
             ▼             ▼
           valid        invalid
             │             │
             ▼             ▼
           Save       repair/regenerate
             │
             ▼
       Document generator
```

### 7.1 Provider abstraction

```
AIProvider
 ├── generate()
 ├── stream()
 ├── embed()
 └── rerank()

LocalVLLMProvider
OptionalExternalProvider
MockAIProvider
```

El proveedor local es el camino principal. Un proveedor externo puede existir como fallback o benchmark, pero nunca debe quedar acoplado al dominio.

## 8. Curriculum Engine + RAG

```
Fuente oficial/autorizada
        ↓
Ingesta → extracción → limpieza → chunking
        ↓
Metadata + embeddings
        ↓
Qdrant
        ↓
Hybrid retrieval → reranking
        ↓
Context package
        ↓
LLM
```

- Guardar fuente, título, versión, fecha y referencia.
- Filtrar por área, grado y metadata relevante.
- Separar fuentes oficiales de contenido generado por usuarios.
- No presentar inferencias del modelo como citas oficiales.
- Versionar el conocimiento curricular.

## 9. Generación estructurada

```
ResourceBlueprint
 ├── subject
 ├── grade
 ├── group
 ├── period / unit / topic
 ├── objective
 ├── competencies
 ├── standards / dba
 ├── resourceType
 ├── duration
 ├── difficulty
 ├── questionCount
 └── cognitiveDistribution
```

Tipos de recurso: clase/guía docente · taller · quiz · examen · actividad didáctica · lectura · rúbrica · clave de respuestas · refuerzo · guion de presentación.

## 10. Memoria pedagógica

```
Teacher ↓ Group ↓ Academic period ↓ Unit ↓ Topic ↓ Lessons
        ↓ Resources ↓ Assessments ↓ Results ↓ Difficulties ↓ Reinforcement
```

La memoria será una combinación de relaciones estructuradas en PostgreSQL y recuperación semántica de materiales relevantes; no un historial textual indiscriminado.

## 11. Diferenciación

```
Original Resource
 ├── Standard Version
 ├── Support Version
 └── Enrichment Version
```

- Instrucciones cortas
- Actividad segmentada
- Apoyo visual
- Pasos numerados
- Carga textual reducida
- Tiempo adicional definido por el docente
- Mayor complejidad para enriquecimiento

El MVP debe usar **perfiles de apoyo pedagógico**. La IA no diagnostica condiciones clínicas. Si se manejan datos de salud o diagnósticos, deberán existir controles reforzados de privacidad, acceso, finalidad y autorización.

## 12. Assessment Engine

```
AssessmentBlueprint
 ├── totalQuestions
 ├── questionTypes
 ├── points
 ├── difficultyDistribution
 ├── cognitiveLevels
 ├── competencies
 ├── objectives
 └── standards / dba
```

- Preguntas estructuradas
- Validación de respuestas
- Distribución de dificultad
- Rúbricas
- Resultados por estudiante/grupo
- Detección de dificultades
- Generación de refuerzo bajo aprobación docente

## 13. Agentes Claude Code

| Agente        | Responsabilidad                                   |
| ------------- | ------------------------------------------------- |
| architect     | Arquitectura, ADR y límites de módulos            |
| product       | Specs, casos de uso y aceptación                  |
| domain        | Dominio, reglas y edge cases                      |
| frontend      | UI, componentes y UX                              |
| backend       | Servicios, APIs, validación y transacciones       |
| database      | Prisma, PostgreSQL, índices y migraciones         |
| auth-security | Auth, RBAC, tenancy, seguridad                    |
| ai-engine     | FastAPI, vLLM, providers, tools y contratos       |
| rag           | Ingesta, embeddings, Qdrant, retrieval, reranking |
| curriculum    | Modelo curricular y fuentes                       |
| assessment    | Blueprints, preguntas, rúbricas y resultados      |
| documents     | DOCX/PDF y plantillas                             |
| privacy       | Minimización, retención y datos sensibles         |
| qa            | Tests, regresión y E2E                            |
| devops        | Docker, CI/CD, observabilidad y backups           |
| reviewer      | Verificación contra spec y arquitectura           |

## 14. Spec-Driven Development

```
IDEA → SPEC → ACCEPTANCE CRITERIA → ADR
 → TASKS → AGENT → IMPLEMENTATION
 → TESTS → REVIEW → SPEC VALIDATION
 → DOCUMENTATION → COMMIT
```

- No implementar features importantes sin spec mínima.
- Cada feature declara objetivo, actores, reglas, entradas, salidas, errores y aceptación.
- Cada cambio arquitectónico relevante tiene ADR.
- Los tests forman parte de la feature.
- El reviewer valida cumplimiento de spec, no solo compilación.

## 15. Archivos de control

```
.claude/
├── agents/
├── skills/
├── commands/
└── settings.json

docs/
├── specs/
├── adr/
├── architecture/
├── curriculum/
├── ai/
├── security/
└── testing/

AGENTS.md
CLAUDE.md
```

AGENTS.md contiene reglas globales. CLAUDE.md resume arquitectura, comandos, convenciones, límites y workflow. Las specs y ADR son la fuente de verdad por feature.

## 16. Roadmap

| Fase                 | Objetivo                                                         |
| -------------------- | ---------------------------------------------------------------- |
| 0 · Discovery        | Validar con docentes y benchmark de modelos/casos reales.        |
| 1 · Foundation       | Next.js, DB, Prisma, Auth, estructura, testing y CI.             |
| 2 · Identity         | Instituciones, docentes, grupos, roles y aislamiento.            |
| 3 · Curriculum       | Fuentes, estándares/DBA, versionado y primer RAG.                |
| 4 · Planning         | Periodos, unidades, temas, objetivos y secuencias.               |
| 5 · AI Engine        | FastAPI, provider abstraction, Ollama, vLLM y structured output. |
| 6 · Generation       | Talleres, clases, actividades, quizzes, exámenes y biblioteca.   |
| 7 · Documents        | DOCX/PDF, plantillas, versiones y claves.                        |
| 8 · Assessment       | Blueprints, preguntas, resultados y analítica.                   |
| 9 · Memory           | Historial, dificultades y recomendaciones.                       |
| 10 · Differentiation | Perfiles de apoyo y versiones diferenciadas.                     |
| 11 · Institutional   | Coordinación, biblioteca compartida y analytics.                 |
| 12 · Scale           | Fine-tuning experimental, optimización GPU y escalamiento.       |

## 17. MVP

```
DOCENTE
 ↓ PERFIL → ASIGNATURAS → GRUPOS
 ↓ PLANIFICACIÓN → TEMA
 ↓ BLUEPRINT
 ↓ IA
 ↓ TALLER / QUIZ / CLASE / EVALUACIÓN
 ↓ DOCX / PDF
 ↓ BIBLIOTECA
```

> **Milestone MVP:** un docente crea un grupo, selecciona asignatura y tema, vincula contexto curricular, configura un blueprint, genera un recurso con IA, lo revisa, lo exporta a DOCX/PDF y lo recupera después con toda su trazabilidad.

## 18. Seguridad y privacidad

- RBAC server-side
- Aislamiento por institución
- Ownership validation
- Auditoría
- Secretos fuera del repositorio
- Rate limiting de IA
- Protección contra prompt injection
- Separación de instrucciones y contenido recuperado
- No enviar datos innecesarios al modelo
- No usar datos clínicos como requisito del MVP
- Retención/eliminación
- Backups
- Logs sin datos sensibles

## 19. Seguridad de RAG y agentes

- Los documentos recuperados son datos, no instrucciones privilegiadas.
- Tool calling usa allowlist explícita.
- Cada tool valida autorización independientemente del LLM.
- No permitir SQL arbitrario generado por el modelo.
- Registrar tool calls críticos.
- Validar salidas con schemas antes de persistir.

## 20. Observabilidad y evaluación de IA

Métricas: latencia · tiempo de retrieval · documentos recuperados · errores de schema · regeneraciones · fallos de tools · feedback docente · calidad documental · tasa de aceptación/edición.

Crear un benchmark versionado de casos reales. Cambios de modelo, prompt o retrieval deben poder compararse contra ese conjunto.

## 21. No construir inicialmente

- Entrenar un LLM desde cero
- App móvil nativa antes de validar web
- Microservicios para todo
- Diagnóstico clínico
- Red social educativa
- Marketplace
- 3D/AR
- Automatización total de decisiones pedagógicas
- Dependencia rígida de un proveedor externo
- Chatbot genérico sin dominio

## 22. Criterios de aceptación globales

1. Compila y pasa lint/typecheck/tests.
2. Las features críticas tienen unit/integration/E2E.
3. No existe acceso cruzado entre instituciones.
4. Todo recurso conserva contexto pedagógico.
5. La IA devuelve estructuras validadas antes de persistir.
6. RAG conserva fuentes y metadata.
7. El modelo puede cambiarse sin modificar el dominio.
8. DOCX/PDF son utilizables e imprimibles.
9. El docente puede revisar antes de finalizar.
10. El sistema puede operar con proveedor local.
11. Las decisiones arquitectónicas están documentadas.

## 23. Definition of Done

- Spec aprobada
- Criterios cubiertos
- Código implementado
- Permisos server-side
- Tests agregados
- Lint/typecheck/build sin errores
- Docs actualizados
- ADR actualizado cuando corresponda
- Revisión del agente reviewer
- Sin TODO críticos ocultos

## 24. Arquitectura objetivo

```
                    EDUCATIONAL PLATFORM
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
       PRODUCT PLATFORM                AI PLATFORM
          Next.js                    FastAPI / Python
             │                             │
      PostgreSQL/Prisma              Model Gateway
      Cloudinary                     ┌─────┼─────┐
      Redis                          ▼     ▼     ▼
                                   vLLM  Qdrant Workers
                                     │     │
                                     └──┬──┘
                                        ▼
                            PEDAGOGICAL INTELLIGENCE
                                        │
                     ┌──────────────────┼──────────────────┐
                     ▼                  ▼                  ▼
                Curriculum           Memory           Assessment
                     └──────────────────┼──────────────────┘
                                        ▼
                                 Recommendation
                                        ▼
                                  Teacher Control
```

## 25. Resultado esperado

La plataforma debe evolucionar desde una herramienta de generación de materiales hacia un sistema de inteligencia pedagógica: comprende contexto curricular, conserva memoria del trabajo docente, genera recursos estructurados, permite evaluar, identifica necesidades de refuerzo y ayuda a planificar los siguientes pasos.

> **Regla estratégica:** no competir solamente por quién genera el mejor documento. El activo central debe ser el contexto pedagógico estructurado, la trazabilidad, la memoria, la evaluación y el motor de inteligencia que conecta todo el ciclo.

## 26. Instrucción maestra para Claude Code

Usar este documento como referencia maestra de producto y arquitectura. Antes de implementar una funcionalidad relevante, crear o actualizar su spec, definir criterios de aceptación, identificar el módulo responsable y seleccionar el agente adecuado. No introducir tecnologías nuevas sin justificar la decisión. Mantener el producto como monolito modular y el AI Engine como servicio separado. Priorizar seguridad, trazabilidad, pruebas y mantenibilidad sobre velocidad de implementación.
