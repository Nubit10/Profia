# ADR-0010 — Imágenes pequeñas (logos) guardadas en PostgreSQL

| Campo              | Valor        |
| ------------------ | ------------ |
| Estado             | **Aceptado** |
| Fecha              | 2026-10-01   |
| Specs relacionadas | SPEC-0010    |

## Contexto

SPEC-0010 agrega el logo o escudo de la institución en el encabezado de los documentos. Es el primer archivo binario que guarda Profe. El plan maestro menciona Cloudinary para imágenes, pero hoy hay una imagen por institución, dos colegios piloto y presupuesto cero (ADR-0007).

## Decisión

**El logo se guarda en PostgreSQL, en una columna `bytea` de la tabla `institution_logos` (una fila por institución), con su tipo, ancho y alto.**

- Solo PNG o JPEG, validados por sus bytes iniciales (no por la extensión), máximo 500 KB y 2.000 px por lado. SVG se rechaza: puede llevar scripts.
- Se lee solo en el servidor, al generar un documento; no se sirve por una URL pública.
- Entra en los respaldos de la base sin configuración adicional.

## Alternativas consideradas

- **Disco del servidor:** simple, pero se pierde al redeployar en contenedores y no entra en los respaldos de la base.
- **Cloudinary o un bucket S3:** es lo que corresponde para muchos archivos o archivos grandes, pero suma un servicio, credenciales y costos que hoy no se justifican.

## Consecuencias

- Positivas: cero infraestructura nueva; tenancy y respaldos iguales que el resto de los datos.
- Negativas / costos: la base crece ~500 KB por institución como máximo; no sirve para archivos grandes.
- Se revisa esta decisión (y se pasa a almacenamiento de objetos) cuando haya que guardar archivos de más de 1 MB o más de unos cientos por institución, por ejemplo imágenes dentro de los recursos o los archivos originales de los formatos.
