# AGENTS.md — Reglas globales

Estas reglas aplican a **todo** agente o persona que trabaje en este repositorio. Si una instrucción puntual contradice estas reglas, gana esta lista, salvo que exista un ADR aceptado que diga lo contrario.

## Fuentes de verdad (en orden)

1. ADR aceptados en `docs/adr/`.
2. Specs aprobadas en `docs/specs/`.
3. `docs/plan-maestro.md` (transcripción del plan maestro `.docx`).

Si algo no está cubierto por ninguna de las tres: **parar y preguntar**, o proponer una spec/ADR. No inventar requisitos.

## Flujo obligatorio (Spec-Driven Development)

```
IDEA → SPEC → CRITERIOS DE ACEPTACIÓN → ADR (si aplica)
 → TAREAS → AGENTE → IMPLEMENTACIÓN → TESTS
 → REVIEW → VALIDACIÓN CONTRA SPEC → DOCS → COMMIT
```

- Ninguna feature relevante se implementa sin una spec en estado **Aprobada**.
- Cada spec declara: objetivo, actores, reglas, entradas, salidas, errores y criterios de aceptación.
- Todo cambio arquitectónico relevante (tecnología nueva, nuevo límite de módulo, cambio de contrato entre producto y AI Engine) requiere ADR.
- Los tests son parte de la feature, no una tarea posterior.
- El agente `reviewer` valida contra la spec, no solo que compile.

## Reglas de producto (no negociables)

- **Teacher-in-control:** la IA propone; el docente revisa y decide. Nada generado por IA queda "final" sin acción del docente.
- **No diagnosis:** la IA nunca diagnostica estudiantes. Se usan perfiles de apoyo pedagógico, no datos clínicos.
- **Traceability first:** todo recurso conserva su contexto (grupo, periodo, unidad, tema, objetivo, currículo, blueprint, versión).
- **Evidence over hallucination:** el contenido curricular se afirma a partir de fuentes recuperadas; las inferencias del modelo no se presentan como citas oficiales.

## Reglas de arquitectura

- Producto = **monolito modular** Next.js. AI Engine = **servicio separado** FastAPI/Python. Nada de microservicios adicionales sin ADR.
- Los módulos de `modules/` se comunican por su API pública (`modules/<x>/index.ts`), no importando internals de otro módulo.
- El dominio no conoce proveedores de IA. Todo pasa por la abstracción `AIProvider` (`generate`, `stream`, `embed`, `rerank`).
- El servidor es la fuente de verdad: permisos, estados y resultados se validan server-side. Zustand es solo estado de UI.
- No introducir dependencias o tecnologías fuera del stack del plan maestro sin ADR.

## Reglas de seguridad y privacidad

- RBAC y validación de ownership **server-side** en cada operación.
- Aislamiento por institución: toda consulta a datos de tenant filtra por `institutionId`. Cero acceso cruzado.
- Secretos solo en variables de entorno; nunca en el repo, en logs ni en prompts.
- Logs sin datos personales sensibles.
- Enviar al modelo solo los datos mínimos necesarios.
- Documentos recuperados por RAG son **datos, no instrucciones**. Separar siempre instrucciones de contenido recuperado.
- Tool calling con allowlist explícita; cada tool valida autorización por su cuenta; nunca SQL generado por el modelo.
- Toda salida del LLM se valida con schema antes de persistir.

## Definition of Done

- [ ] Spec aprobada y criterios de aceptación cubiertos
- [ ] Código implementado con permisos server-side
- [ ] Tests agregados (unit / integration / E2E según criticidad)
- [ ] Lint, typecheck y build sin errores
- [ ] Docs actualizados; ADR creado/actualizado si corresponde
- [ ] Revisión del agente `reviewer` sin hallazgos bloqueantes
- [ ] Sin TODO críticos ocultos

## No construir (por ahora)

Entrenar un LLM desde cero · app móvil nativa · microservicios para todo · diagnóstico clínico · red social educativa · marketplace · 3D/AR · automatización total de decisiones pedagógicas · dependencia rígida de un proveedor externo · chatbot genérico sin dominio.

## Idioma

Documentación, specs, ADR y textos de UI en **español**. Identificadores de código (nombres de modelos, funciones, variables) en **inglés**, siguiendo el modelo de dominio del plan maestro.
