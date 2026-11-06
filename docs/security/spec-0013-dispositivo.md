# Revisión de seguridad y privacidad — SPEC-0013 (T20)

Alcance: lo que SPEC-0013 guarda o hace en el dispositivo del docente. Es decir, las notificaciones
del navegador (RN-15, parte 4) y los recursos sin conexión (RN-14, parte 5), con el service worker
de ADR-0012. Fecha: 2026-11-06. Revisores: agentes `auth-security` y `privacy`.

## Qué datos salen del servidor y a dónde

| Dato                                 | Dónde queda                                          | Datos personales                                                                             |
| ------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Suscripción push (endpoint y claves) | `push_subscriptions`, por usuario e instalación      | No identifica a la persona; el endpoint no se registra en logs                               |
| Texto del aviso                      | Servicio push del navegador (Google, Apple, Mozilla) | Solo el tipo y el título del recurso, que escribe el docente. Ningún dato de estudiantes     |
| Word y PDF de los recursos           | Cache Storage del dispositivo, una caché por cuenta  | Nombre del docente, institución y logo (como cualquier descarga). Ningún dato de estudiantes |
| Índice de lo guardado                | IndexedDB del dispositivo                            | Títulos de recursos y cursos                                                                 |
| Preferencias e id de instalación     | `localStorage`                                       | No; el id es aleatorio                                                                       |

## Controles verificados

**Acceso (RBAC y tenancy, ADR-0004)**

- La lista para guardar sin conexión sale de `listMyResources`, filtrada por `institutionId` y
  `membershipId`. Cada archivo se baja por la ruta de descarga de siempre, con `requireTenant()`
  y `exportResource`: mismo permiso de docente y 404 para lo ajeno. Pruebas: CA-0013-42
  (integración) y CA-0013-16 (E2E).
- Registrar, consultar o quitar un dispositivo exige sesión (`requireUser`), y solo el dueño quita
  el suyo. Registrar un dispositivo compartido lo pasa a quien tiene la sesión. Prueba: CA-0013-32.
- El aviso le llega solo a quien pidió el recurso: el `userId` sale del trabajo de generación, no
  del cliente. Otro docente del mismo colegio no lo recibe. Pruebas: CA-0013-35, y CA-0013-12 para
  el aviso dentro de la app.
- Un recurso archivado o de un espacio al que el docente ya no pertenece se borra del dispositivo
  en la siguiente sincronización. Prueba: CA-0013-39.

**Entradas y abuso**

- La suscripción se valida con Zod y con un CHECK en la base: endpoint HTTPS, largos acotados e id
  de instalación de 16 a 64 caracteres.
- Las suscripciones vencidas (404/410) se borran. Prueba: CA-0013-36.
- Descargas para guardar sin conexión: máximo 30 por minuto por docente (responde 429). La
  sincronización baja de a un archivo.
- El service worker solo abre rutas del mismo sitio al tocar un aviso y no guarda páginas ni
  respuestas de acciones. Prueba: CA-0013-30.

**Privacidad (minimización y eliminación)**

- Ningún dato de estudiantes viaja en los avisos ni queda en el dispositivo: los recursos de
  SPEC-0008/0009 no contienen datos de estudiantes.
- En el navegador, guardar sin conexión **requiere aceptar** (computadores compartidos). En la
  app instalada viene encendido y se puede apagar. Prueba: CA-0013-41.
- Al cerrar sesión se borran los archivos, el índice y la suscripción push de ese dispositivo.
  Si entra otra cuenta, se borra lo de la anterior antes de sincronizar. Prueba: CA-0013-40.
- Las descargas para guardar no se registran como `resource.exported` (no inflan métricas ni
  cuentan como "primera descarga"). Se audita una vez por sincronización
  (`resource.cached_offline`, con el número de archivos). Prueba: CA-0013-42.
- Los logs nunca llevan endpoint, claves ni contenido del aviso.

## Riesgos aceptados

1. **La sesión vence sin cerrar sesión.** Lo guardado sigue en el dispositivo hasta que alguien
   inicie sesión (si es otra cuenta, se borra) o el docente cierre sesión. Es lo que pide RN-14:
   usarlo sin señal. Si el dispositivo es compartido, la opción en el navegador es voluntaria y lo
   advierte.
2. **Descargas hechas sin señal.** No se pueden auditar: no llegan al servidor.
3. **Servicio push de terceros.** El texto del aviso pasa cifrado (Web Push con VAPID) por el
   servicio del navegador. Solo lleva el tipo y el título.
4. **Primera sincronización con muchos recursos.** Genera muchos documentos en el servidor. Lo
   limitan 30 archivos por minuto, y la sincronización sigue en la próxima visita.

## Hallazgos corregidos durante la revisión

- Con `loading.tsx`, Next empezaba a responder antes de saber si la ruta existía. Una ruta ajena
  respondía 200 en vez de 404 (parte 2). Se quitó de las rutas que pueden responder 404 y de sus
  padres.
- La pantalla "Sin conexión" no habría podido listar lo guardado si su JavaScript no estaba en
  caché. El service worker lo guarda al instalarse (solo archivos estáticos con huella).

Sin hallazgos bloqueantes.
