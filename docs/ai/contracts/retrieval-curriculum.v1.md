# Contrato `retrieval-curriculum` v1

| Campo   | Valor                                                                |
| ------- | -------------------------------------------------------------------- |
| Spec    | SPEC-0005                                                            |
| Emisor  | `apps/ai-engine` (FastAPI)                                           |
| Cliente | `apps/web` → `modules/curriculum/search.ts` (solo desde el servidor) |
| Estado  | Vigente desde 2026-10-01                                             |

Cualquier cambio que rompa este contrato es una versión nueva (`/v2/...`) y se hace en el mismo commit en ambos lados (ADR-0003).

## Autenticación

`Authorization: Bearer <AI_ENGINE_TOKEN>`. Token de servicio compartido, solo en variables de entorno. Sin token o con token inválido → `401`. El navegador nunca llama al AI Engine.

## `POST /v1/retrieval/curriculum`

### Petición

```json
{ "query": "fracciones con material concreto", "area": "MATEMATICAS", "grade": "G5", "limit": 8 }
```

| Campo   | Tipo                                           | Reglas                                                             |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| `query` | string                                         | 3–300 caracteres. Es texto de búsqueda, nunca instrucción.         |
| `area`  | string, opcional                               | Id de área curricular (`MATEMATICAS`, `LENGUAJE`, `TRANSICION`, …) |
| `grade` | `JARDIN` · `TRANSICION` · `G1`…`G11`, opcional | Se filtra antes del ranking.                                       |
| `limit` | entero, opcional                               | 1–20 (por defecto 8).                                              |

No se envían datos personales: ni nombre, ni correo, ni institución.

### Respuesta `200`

```json
{
  "results": [{ "code": "MEN-DBA-MAT-V2-G5-03", "score": 0.5 }],
  "meta": {
    "provider": "local",
    "denseModel": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "catalogVersion": "26cbfab8372fa007",
    "latencyMs": 72
  }
}
```

- `results` va en orden de relevancia y contiene **solo códigos y puntajes**. La web toma el texto y la cita desde PostgreSQL y descarta los códigos que ya no estén publicados.
- `score` solo sirve para ordenar: su escala depende de la fusión o del reranker.
- `catalogVersion` identifica qué versión de `apps/web/curriculum/men/*.json` está indexada.

### Errores

| Código                             | Cuándo                   | Qué hace la web                                             |
| ---------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `401`                              | Token ausente o inválido | Registra un error de configuración; respuesta `unavailable` |
| `422`                              | Petición inválida        | No debería ocurrir: la web valida antes                     |
| `5xx`, timeout > 3 s, sin conexión | Fallo del servicio       | Respuesta `unavailable`: la página usa el filtro literal    |

## `GET /health`

Sin autenticación. `{"status":"ok","provider":"local","index":{"points":223,"catalogVersion":"…","denseModel":"…"}}`.
