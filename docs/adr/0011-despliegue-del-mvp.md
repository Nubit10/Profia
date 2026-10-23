# ADR-0011 — Despliegue del MVP sin costo: Vercel, Supabase y el AI Engine en un Space de Hugging Face

| Campo              | Valor                                      |
| ------------------ | ------------------------------------------ |
| Estado             | Propuesto                                  |
| Fecha              | 2026-10-10                                 |
| Specs relacionadas | SPEC-0001, SPEC-0005, SPEC-0008, SPEC-0011 |

## Contexto

El MVP pasa a manos de los dos primeros clientes para recibir su retroalimentación. Hay que decidir dónde corre cada pieza, con dos condiciones:

- el usuario eligió **Vercel** para la web y **Supabase** para la base de datos;
- **por ahora no hay presupuesto**: todo debe ser gratuito y sin tarjeta de crédito.

El AI Engine (ADR-0001) no cabe en Vercel:

- carga un modelo de embeddings de ~1 GB (FastEmbed/ONNX, ADR-0006) que necesita ~1,5 GB de RAM;
- arranca indexando el catálogo;
- una generación de examen hace varias llamadas seguidas al LLM (hasta 145 s en el benchmark).

Las funciones de Vercel tienen un límite de tamaño de paquete y no guardan estado entre invocaciones. Los hostings de contenedores con plan gratuito (Render, Koyeb) dan 512 MB de RAM, que no alcanzan para el modelo.

## Decisión

**La web va en Vercel Hobby, la base en Supabase Free y el AI Engine en un Space de Hugging Face con Docker (CPU basic, gratis). Un monitor gratuito (UptimeRobot) visita ambos cada 30 minutos para que no se duerman.**

- **Web (Vercel Hobby):**
  - el proyecto apunta a `apps/web` dentro del monorepo;
  - el área de trabajo declara `maxDuration = 300`, el máximo de Vercel en todos sus planes;
  - las generaciones con `after()` (ADR-0008) corren dentro de ese límite: el cliente espera el examen como máximo 280 s y lo marca como interrumpido a los 6 minutos.
- **Base (Supabase Free):**
  - en ejecución, la web se conecta por el *pooler* en modo transacción (puerto 6543);
  - las migraciones van por el *pooler* en modo sesión (puerto 5432);
  - la conexión va cifrada con `sslmode=require&uselibpqcompat=true`, porque la cadena de certificados de Supabase no está entre las CA públicas de Node;
  - la Data API de Supabase se apaga: Profe no la usa y expondría las tablas por HTTP.
- **AI Engine (Space de Hugging Face, 2 vCPU y 16 GB):**
  - una imagen con los modelos, los prompts y el catálogo ya incluidos (`apps/ai-engine/Dockerfile`, construida desde la raíz);
  - Hugging Face la construye en sus servidores;
  - el catálogo se indexa en memoria al arrancar (`QDRANT_URL=:memory:`): son cientos de ítems, así que no hace falta un servidor de Qdrant;
  - la cadena de LLM en producción es solo Groq gratuito (`groq-qwen`, `groq-gptoss`), sin Ollama;
  - `scripts/publish-ai-engine-hf.ps1` publica en el Space **solo** el código del motor, sus prompts y el catálogo oficial.
- **Monitor (UptimeRobot Free):**
  - visita `/api/health` de la web, que consulta la base: Supabase no se pausa a los 7 días;
  - visita `/health` del motor: el Space no se duerme a las 48 h.
- La imagen sirve en cualquier hosting de contenedores. Cuando haya presupuesto, el motor pasa a Railway sin tocar el código.

## Alternativas consideradas

- **AI Engine como función Python en Vercel:** el modelo supera el límite de tamaño del paquete, y cada arranque en frío lo volvería a cargar.
- **Railway, Fly.io o Render de pago para el AI Engine:** es lo correcto con presupuesto (USD 10–25 al mes). Hoy no lo hay.
- **Render o Koyeb gratis:** 512 MB de RAM no alcanzan para el modelo de embeddings. Cambiar a un modelo más pequeño exigiría repetir el benchmark de búsqueda (SPEC-0005).
- **Google Cloud Run u Oracle Cloud (capa gratuita):** piden tarjeta. En Cloud Run, además, cada arranque en frío volvería a indexar el catálogo.
- **Space privado en Hugging Face:** exige el token de Hugging Face en el encabezado `Authorization` de cada llamada, que ya usa el token del motor.
- **Qdrant Cloud gratuito:** suma un servicio y credenciales, y los clusters gratuitos se suspenden por inactividad. Con cientos de ítems, el índice en memoria basta.

## Consecuencias

- Positivas:
  - costo cero y sin tarjeta;
  - el despliegue no usa el disco de la PC de desarrollo;
  - el AI Engine es una sola imagen portátil y sin servicios extra.
- Negativas / costos:
  - **Vercel Hobby es para uso no comercial.** Sirve para un piloto sin cobro; cuando se les cobre a los clientes, se pasa a Pro.
  - **El Space es público:** se ven el código del motor, sus prompts y el catálogo, que ya es público. Las claves van como *Secrets* y por el motor no pasan datos personales (RN-08 de SPEC-0008 y SPEC-0011).
  - Si el monitor falla, el Space puede dormirse y Supabase pausarse. Mientras tanto, las generaciones fallan con un mensaje y sin gastar cupo.
  - Supabase Free no tiene respaldos descargables: hay que hacerlos a mano con `pg_dump`.
  - El cupo gratuito de Groq puede quedarse corto con uso real (un examen gasta 15.000–30.000 tokens).
  - El límite de intentos de inicio de sesión vive en memoria (SPEC-0001) y en Vercel cada instancia lleva su cuenta. Sigue siendo una protección, pero más débil, hasta que exista Redis.
  - El motor no se despliega con el `git push`: se publica con el script.
- Qué queda restringido a partir de ahora:
  - una generación síncrona o en segundo plano no puede pasar de 300 s en la web;
  - una funcionalidad que necesite más tiempo requiere una cola de trabajos (Fase 5 del plan maestro: Redis + workers) y un ADR nuevo.
