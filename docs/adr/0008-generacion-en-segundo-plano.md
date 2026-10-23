# ADR-0008 — Generación de recursos en segundo plano (sin cola externa por ahora)

| Campo              | Valor        |
| ------------------ | ------------ |
| Estado             | **Aceptado** |
| Fecha              | 2026-10-01   |
| Specs relacionadas | SPEC-0008    |

## Contexto

Un taller o un quiz usa ~4–6K tokens. Con el plan gratuito de Groq (8K tokens/min por modelo, ADR-0007) una generación tarda de 5 a 60 s, según si hay que esperar cupo, y con el modelo local varios minutos. Una petición que espera todo ese tiempo se pierde si el docente cierra la página, y SPEC-0008 RN-05 pide que la generación no bloquee al docente.

El plan maestro prevé Redis + workers para trabajos asíncronos, pero hoy hay dos colegios piloto, un solo servidor y presupuesto cero: otro servicio que operar no se justifica todavía.

## Decisión

**La generación corre en el mismo proceso de la web, después de responder, con el estado en PostgreSQL.**

1. La server action valida el blueprint y el cupo, crea el `Resource` en estado `GENERATING` y responde de inmediato.
2. Con `after()` de Next.js se llama al AI Engine. Al terminar se guarda la versión generada (`DRAFT`) o el error (`FAILED`), y siempre el `GenerationLog`.
3. La página del recurso consulta el estado cada pocos segundos mientras esté en `GENERATING`.
4. **Concurrencia:** un semáforo en memoria permite como máximo 2 generaciones de recursos a la vez por proceso; el resto espera su turno. Así no se dispara el límite de tokens por minuto de Groq.
5. **Recuperación:** un recurso que lleva más de 5 minutos en `GENERATING` se marca `FAILED` ("se interrumpió, reintenta") cuando alguien abre la biblioteca o el recurso. Cubre los reinicios del servidor.
6. La lógica de "generar y guardar" vive en una función del módulo `resources` que no depende de `after()`, para moverla a un worker sin cambiar el dominio.

## Alternativas consideradas

- **Petición síncrona (como en SPEC-0007)**: simple, pero el docente espera hasta un minuto, y si cierra la página se pierde el trabajo y el cupo gastado.
- **Redis + BullMQ / RQ con workers**: es la solución del plan maestro y la que se adoptará al crecer, pero hoy agrega un servicio, despliegue y monitoreo sin necesidad real.
- **Cola en PostgreSQL con un proceso worker aparte** (p. ej. pg-boss): menos piezas que Redis, pero sigue siendo un proceso más que operar. Queda como paso intermedio si `after()` no alcanza.

## Consecuencias

- Positivas: cero infraestructura nueva; el docente puede salir de la página; el estado queda en la base y es auditable.
- Negativas / costos: un reinicio del servidor corta las generaciones en curso (se marcan `FAILED` y el docente reintenta; el cupo no se descuenta por las fallidas). El semáforo es por proceso: con varias instancias de la web el límite se multiplica.
- Se revisa este ADR (y se pasa a una cola con workers) cuando haya **más de una instancia de la web**, **más de ~20 generaciones simultáneas** o se adopte un despliegue serverless con duración máxima por petición menor que la de una generación.
- Queda prohibido llamar al AI Engine para generar recursos desde el navegador o de forma síncrona en una server action.

## Nota (2026-10-10, SPEC-0011): exámenes por secciones

El examen se genera **por secciones**: una llamada al modelo por sección (RN-10 de SPEC-0011), porque un examen de 40 preguntas no cabe en el límite por minuto de Groq gratuito. Lo confirmó el benchmark de CA-0011-14. Para la web sigue siendo **una sola generación en segundo plano**, con estas diferencias:

- Ocupa un solo turno del semáforo mientras corre.
- Deja una fila de `generation_logs` por sección.
- El timeout del cliente es de 280 s, por debajo del `maxDuration` de 300 s de la función en Vercel (ADR-0011). Si se pasa, el examen falla con su mensaje en vez de quedar cortado.
- Se marca como interrumpido a los **6 minutos** sin terminar, no a los 5. Así una generación que todavía puede llegar no se descarta.

El resto de este ADR no cambia.
