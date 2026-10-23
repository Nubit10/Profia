# Despliegue del MVP (sin costo)

Guía para poner Profe en producción **sin pagar nada** y sin tarjeta de crédito. La decisión y sus razones están en [ADR-0011](../adr/0011-despliegue-del-mvp.md).

```
Docentes ──► Vercel Hobby (apps/web) ──► Supabase Free (PostgreSQL)
                    │
                    └─HTTP + token─► Hugging Face Space (AI Engine, Docker) ──► Groq Free (LLM)

UptimeRobot Free: visita /health de la web y del motor cada 30 min, para que nada se duerma.
```

Orden: **GitHub → Supabase → Hugging Face → Vercel → UptimeRobot → verificación**. Cada paso usa datos del anterior. Nada se construye en tu PC: no necesitas Docker ni espacio en disco para desplegar.

## 0. Lo que da cada plan gratuito y sus condiciones

| Servicio                | Para qué           | Condiciones del plan gratuito                                                                                                       |
| ----------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| GitHub                  | Código             | Repositorio privado sin límite.                                                                                                      |
| Supabase Free           | PostgreSQL         | 500 MB. **Se pausa tras 7 días sin actividad** (el monitor lo evita). Sin respaldos descargables: haz los tuyos (paso 8).             |
| Hugging Face Space      | AI Engine          | CPU de 2 núcleos y 16 GB de RAM. **Se duerme tras 48 h sin visitas** (el monitor lo evita). El Space es **público**: se ven el código del motor, los prompts y el catálogo, que es público. Nunca las claves ni datos de usuarios. |
| Vercel Hobby            | Web                | Funciones de hasta 300 s, suficiente para Profe. Sus términos lo limitan a **uso personal o no comercial**: sirve para un piloto sin cobro; cuando les cobres a tus clientes, pasa a Pro. |
| Groq Free               | Modelo de lenguaje | Cupo diario por modelo. Con dos clientes alcanza. Revisa los límites en https://console.groq.com/settings/limits.                    |
| UptimeRobot Free        | Monitor            | 50 monitores. Te avisa por correo si algo se cae.                                                                                    |

## 1. Subir el código a GitHub

La carpeta todavía no es un repositorio de git. Desde la raíz del proyecto, en PowerShell:

```powershell
git init -b main
git add .
git status   # revisa que NO aparezca ningún archivo .env (el .gitignore los excluye)
git commit -m "MVP listo para despliegue"
```

Crea un repositorio **privado** en GitHub (sin README) y súbelo:

```powershell
git remote add origin https://github.com/<tu-usuario>/profe.git
git push -u origin main
```

## 2. Supabase (base de datos)

1. Crea un proyecto en https://supabase.com/dashboard:
   - **Región:** East US (North Virginia), la misma de las funciones de Vercel (`iad1`). Cada página hace varias consultas; con la base cerca de la web responde mucho más rápido.
   - Guarda la contraseña de la base. Usa solo letras y números: los caracteres especiales (`@ # / ? %`) rompen la URL si no se codifican.
2. **Apaga la Data API.** Supabase expone por defecto las tablas del esquema `public` por HTTP, y Profe no la usa: el acceso a los datos pasa siempre por el servidor, con sus permisos. Ve a *Project Settings → Data API* (o *Integrations → Data API*) y desactívala. Si no la apagas, cualquiera con la clave `anon` del proyecto podría leer las tablas.
3. En **Connect** (botón superior), copia dos cadenas de conexión:
   - **Transaction pooler** (puerto **6543**): la usa la web.
   - **Session pooler** (puerto **5432**): sirve para las migraciones.
4. Arma las dos URL con los parámetros de SSL:

   ```text
   # Web (Vercel) y carga del catálogo
   postgresql://postgres.<ref>:<clave>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&uselibpqcompat=true

   # Migraciones
   postgresql://postgres.<ref>:<clave>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
   ```

   `uselibpqcompat=true` hace que la conexión vaya cifrada sin exigir que el certificado de Supabase esté entre las CA de Node. Sin él, la web falla con `self-signed certificate in certificate chain`.

5. Crea las tablas y carga el catálogo de DBA desde tu PC, en `apps/web`. Las variables definidas en la terminal tienen prioridad sobre tu `.env` local, que no se modifica:

   ```powershell
   cd apps/web
   $env:DATABASE_URL = "<URL de migraciones, puerto 5432>"
   npx prisma migrate deploy
   $env:DATABASE_URL = "<URL de la web, puerto 6543>"
   npm run curriculum:import
   Remove-Item Env:DATABASE_URL
   ```

   - `migrate deploy` debe terminar con *All migrations have been successfully applied*.
   - El import debe reportar los archivos de Matemáticas, Lenguaje y Transición. Es idempotente: si lo repites, no duplica nada.
   - **No corras `npm run db:seed`** contra Supabase: es para desarrollo.

## 3. Hugging Face (AI Engine)

1. Crea una cuenta gratuita en https://huggingface.co (no pide tarjeta).
2. Crea el Space en https://huggingface.co/new-space:
   - **Name:** `profe-ai-engine`;
   - **SDK:** Docker, plantilla *Blank*;
   - **Hardware:** CPU basic (gratis);
   - **Visibility:** Public. Un Space privado exige el token de Hugging Face en cada llamada y choca con el token del motor.
3. En el Space, en **Settings → Variables and secrets**, agrega:

   | Tipo     | Nombre            | Valor                                                       |
   | -------- | ----------------- | ----------------------------------------------------------- |
   | Secret   | `AI_ENGINE_TOKEN` | Un token nuevo (ver abajo). El mismo va luego en Vercel.    |
   | Secret   | `GROQ_API_KEY`    | Tu clave de https://console.groq.com/keys                   |
   | Variable | `PROVIDER`        | `local`                                                     |
   | Variable | `LLM_CHAIN`       | `["groq-qwen","groq-gptoss"]` (en producción no hay Ollama) |

   Genera el token con `python -c "import secrets; print(secrets.token_urlsafe(32))"`. **No reutilices** el de desarrollo. Los *Secrets* no se ven en el repositorio público del Space.

4. Crea un token de Hugging Face con permiso **Write** en https://huggingface.co/settings/tokens. Lo pide git la primera vez que publicas.
5. Publica el motor desde la raíz del proyecto:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/publish-ai-engine-hf.ps1 -Space <tu-usuario>/profe-ai-engine
   ```

   - Si git pide credenciales: el usuario es tu usuario de Hugging Face y la contraseña es el token del paso 4.
   - El script sube **solo** el código del motor, sus prompts y el catálogo oficial. Nada de la web ni de tus `.env`.

6. Hugging Face construye la imagen en sus servidores: unos 10 minutos la primera vez, porque descarga el modelo de embeddings (~1 GB). Sigue el avance en la pestaña *Logs* del Space. Al arrancar, el motor indexa el catálogo en memoria (menos de un minuto).
7. Comprueba que responde. La URL del motor es `https://<tu-usuario>-profe-ai-engine.hf.space`:

   ```powershell
   curl.exe https://<tu-usuario>-profe-ai-engine.hf.space/health
   ```

   Debe responder `"status":"ok"` con `"provider":"local"` y un índice con ítems.

## 4. Vercel (web)

1. En https://vercel.com/new importa el repositorio de GitHub con una cuenta Hobby (gratis):
   - **Root Directory:** `apps/web`. Vercel detecta el monorepo e instala desde la raíz; `postinstall` genera el cliente de Prisma.
   - **Framework:** Next.js (detectado).
2. **Environment Variables:**

   | Variable          | Valor                                                                                            |
   | ----------------- | ------------------------------------------------------------------------------------------------ |
   | `DATABASE_URL`    | La URL de la web de Supabase (puerto **6543**, con `sslmode=require&uselibpqcompat=true`)          |
   | `AUTH_SECRET`     | Uno nuevo: `npx auth secret` (o 32+ caracteres aleatorios). **No reutilices** el de desarrollo.   |
   | `AI_ENGINE_URL`   | `https://<tu-usuario>-profe-ai-engine.hf.space` (sin `/` al final)                               |
   | `AI_ENGINE_TOKEN` | El mismo token que pusiste en el Space                                                           |

3. Revisa estos ajustes en **Settings**:
   - *Build and Deployment → Node.js Version*: **24.x**.
   - *Functions → Function Region*: **Washington, D.C. (iad1)**, la misma región de Supabase.
   - *Functions → Fluid Compute*: activado (viene así por defecto). El área de trabajo declara `maxDuration = 300` para las generaciones en segundo plano (ADR-0008, ADR-0011), y ese es el máximo de Hobby.
4. Despliega. Tu URL queda como `https://<proyecto>.vercel.app`. Si después cambias una variable, vuelve a desplegar (*Deployments → Redeploy*): las variables se leen en el despliegue.

## 5. UptimeRobot (que nada se duerma)

En https://uptimerobot.com (cuenta gratuita), crea dos monitores **HTTP(s)** con intervalo de **30 minutos**:

| Monitor   | URL                                                      | Qué evita                                           |
| --------- | -------------------------------------------------------- | --------------------------------------------------- |
| Profe web | `https://<proyecto>.vercel.app/api/health`               | Que Supabase pause el proyecto: la ruta consulta la base. |
| Profe IA  | `https://<tu-usuario>-profe-ai-engine.hf.space/health`   | Que el Space se duerma a las 48 h.                  |

Además te avisa por correo si algo se cae. Si el Space se duerme de todas formas (por ejemplo, por mantenimiento de Hugging Face), abre su página y se despierta en uno o dos minutos.

## 6. Verificación (antes de dar acceso a los clientes)

Con una cuenta de prueba en la URL de Vercel:

1. Crear una cuenta como docente independiente y entrar.
2. Crear un curso (por ejemplo Matemáticas 6°) y ver que **el catálogo de DBA aparece**. Si no aparece, falta el paso 2.5.
3. En la planeación, crear un periodo, una unidad y un tema. Probar **"Sugerir objetivos con IA"**: confirma que la web llega al motor y que Groq responde.
4. Crear un **quiz** y un **taller**. Deben pasar de "Generando" a listo en 1–2 minutos.
5. Crear un **examen** con dos temas. Debe quedar listo en menos de 3 minutos.
6. Descargar el Word y el PDF del quiz, la clave y la hoja de respuestas del examen.
7. Subir un formato de taller en Word y el logo, y generar un taller con ese formato.
8. Crear un colegio, invitar a un docente y entrar con el enlace de invitación desde una ventana de incógnito.

Si una generación falla: en el Space → *Logs* aparece `generation.<tipo>` con el error, y en Vercel → *Logs*, el error del lado de la web.

## 7. Dar acceso a los clientes

- **Docente independiente:** se registra en la URL y elige "Docente independiente".
- **Colegio:**
  1. Un directivo se registra y crea el colegio con sus sedes.
  2. Desde *Colegio → Miembros*, invita a los docentes; cada invitación genera un enlace.
  3. El directivo envía el enlace por WhatsApp o correo (Profe no envía correos).
- **Cupo:** cada docente tiene **10 generaciones al día**, y un examen cuenta como 2. Si Groq agota su cupo diario, la generación falla con un mensaje y no gasta cupo del docente.
- **Retroalimentación:** cada recurso generado tiene su evaluación docente (SPEC-0008). Con `npm run metrics:resources -w @profe/web`, apuntando `DATABASE_URL` a Supabase como en el paso 2.5, ves la calidad por versión de prompt.

## 8. Actualizaciones y respaldos

- **Web:** `git push` a `main` despliega solo en Vercel.
- **Motor:** **no** se actualiza con el push. Si cambias algo en `apps/ai-engine` o en el catálogo, vuelve a correr `scripts/publish-ai-engine-hf.ps1`.
- **Migraciones nuevas:** corre `npx prisma migrate deploy` contra Supabase (paso 2.5) **antes** de hacer push del código que las usa.
- **Catálogo:** si cambian los JSON de `curriculum/men`, corre `npm run curriculum:import` contra Supabase y vuelve a publicar el motor.
- **Respaldos** (el plan gratuito no los da): una vez por semana, con el Postgres de Docker que ya usas en desarrollo:

  ```powershell
  docker exec profe-postgres-1 pg_dump "<URL de migraciones>" -Fc -f /tmp/profe.dump
  docker cp profe-postgres-1:/tmp/profe.dump D:\respaldos\profe-AAAAMMDD.dump
  ```

  No uses `>` para guardar el respaldo: PowerShell 5.1 convierte la salida a texto y el archivo queda dañado.

## 9. Cuando haya presupuesto

En este orden, porque cada uno quita el riesgo más grande que queda:

1. **Vercel Pro** (USD 20 al mes) en cuanto les cobres a tus clientes, por los términos de uso.
2. **Supabase Pro** (USD 25 al mes): respaldos diarios y ninguna pausa.
3. **Groq Developer** (pago por uso) si el cupo gratuito se queda corto.
4. **Motor en Railway** (del orden de USD 10–20 al mes): el código del motor deja de ser público y ya no depende del monitor. La misma imagen sirve sin cambios: `RAILWAY_DOCKERFILE_PATH=apps/ai-engine/Dockerfile` con las mismas variables del paso 3.

## 10. Límites conocidos del MVP

- Una generación no puede pasar de 300 s, el límite de Vercel. El examen falla con su mensaje a los 280 s; en el benchmark tardó como máximo 145 s.
- El límite de intentos de inicio de sesión vive en memoria de cada instancia de Vercel. Sigue protegiendo, pero cada instancia lleva su propia cuenta.
- Si el motor se cae o está dormido, la web sigue funcionando: la búsqueda curricular degrada y las generaciones fallan con un mensaje, sin gastar cupo.
