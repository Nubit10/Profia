# ADR-0005 — Catálogo curricular oficial global y versionado en el repositorio

| Campo              | Valor        |
| ------------------ | ------------ |
| Estado             | **Aceptado** |
| Fecha              | 2026-10-01   |
| Specs relacionadas | SPEC-0004    |

## Contexto

El plan maestro (§8) pide guardar fuente, título, versión, fecha y referencia del conocimiento curricular, separar las fuentes oficiales del contenido de los usuarios y versionar ese conocimiento. Los referentes del MEN (DBA, Estándares Básicos de Competencias) son iguales para todos los colegios del país y se publican como PDF, no como datos estructurados.

## Decisión

1. **El catálogo oficial es global, no de tenant.** Las tablas `curriculum_sources`, `curriculum_areas` y `curriculum_items` no llevan `institutionId`. Los usuarios solo las leen; ningún usuario de la plataforma puede editarlas.
2. **La fuente de verdad del catálogo son archivos de datos en el repositorio** (`apps/web/curriculum/men/*.json`), uno por documento oficial y versión. Cada archivo declara la fuente (emisor, título, versión, año, URL, nota de uso) y sus ítems con referencia de página.
3. **Cargar o actualizar el catálogo es un comando** (`npm run curriculum:import`) idempotente, que valida cada archivo con un schema Zod antes de escribir. Un cambio en el catálogo es un PR revisable, como el código.
4. **Versionado:** un documento nuevo (por ejemplo, DBA Matemáticas v3) se carga como una **fuente nueva**. La anterior pasa a `SUPERSEDED`, pero sus ítems no se borran: lo que ya está vinculado a esos ítems conserva su referencia exacta (trazabilidad).
5. **Identificadores estables:** cada ítem tiene un `code` legible y estable dentro de su fuente (por ejemplo `MEN-DBA-MAT-V2-G6-03`).
6. **Transcripción con revisión humana:** los textos se extraen de los PDF oficiales y una persona los revisa contra el original antes de publicarlos. Ningún texto del catálogo se genera con IA.

## Alternativas consideradas

- **Pantalla de administración para cargar el catálogo:** exige un rol de superadministrador de plataforma y deja los cambios sin revisión de código. Se descarta para el MVP.
- **Indexar los PDF directamente en RAG, sin estructura:** rápido, pero no permite filtrar por área y grado, ni citar el DBA exacto, ni vincular un objetivo a un DBA concreto.
- **Copiar el catálogo dentro de cada institución:** multiplica los datos y complica las actualizaciones del MEN.

## Consecuencias

- Positivas: catálogo auditable (historial de git), reproducible en cualquier entorno, con citas exactas.
- Negativas: transcribir y revisar los documentos del MEN es trabajo manual de contenido.
- Prohibido: editar ítems oficiales desde la aplicación; presentar texto generado como si fuera del catálogo oficial.
