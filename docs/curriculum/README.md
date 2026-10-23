# Catálogo curricular

Fuentes oficiales del MEN cargadas en Profe (ADR-0005, SPEC-0004).

| Fuente                     | Ítems | Estado de revisión            |
| -------------------------- | ----- | ----------------------------- |
| DBA Matemáticas V.2 (2016) | 119   | Pendiente de revisión docente |
| DBA Lenguaje V.2 (2016)    | 88    | Pendiente de revisión docente |
| DBA Transición V.1 (2016)  | 16    | Pendiente de revisión docente |

- Archivos de datos: `apps/web/curriculum/men/*.json` (fuente de verdad, versionados en git).
- Herramientas: `apps/web/curriculum/tools/` (extracción desde el PDF, correcciones documentadas, verificación).
- Guía para la revisión docente: [revision-dba.md](revision-dba.md).

## Flujo para agregar o actualizar una fuente

1. Descargar el PDF oficial en `apps/web/curriculum/sources/` (ignorado por git) y extraer el texto: `pdftotext -enc UTF-8 <pdf> <archivo>.raw.txt`.
2. Extraer el borrador (`tools/extract_dba.py` o un extractor nuevo si la estructura cambia).
3. Registrar la fuente en `tools/sources.json` y las correcciones con su motivo en `tools/fixes/`.
4. `python curriculum/tools/build_sources.py` y `npm run curriculum:verify`: debe salir todo OK.
5. Revisión docente de una muestra, y luego `review.status: "APPROVED"`.
6. `npm run curriculum:import` en cada entorno (idempotente).

Una versión nueva de un documento usa una clave nueva (`…-V3`): la anterior queda reemplazada, sin borrar sus ítems.
