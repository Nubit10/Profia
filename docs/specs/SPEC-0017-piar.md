# SPEC-0017 — PIAR: Plan Individual de Ajustes Razonables, privado y cifrado

| Campo                    | Valor                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                                                      |
| Fase del roadmap         | 6 · Generation (transversal: privacidad)                                                                          |
| Módulo(s) responsable(s) | `modules/piar` (nuevo), `modules/generation` (contrato), `modules/documents` (Word y PDF), `apps/ai-engine`       |
| Agentes                  | product, privacy, auth-security, database, ai-engine, backend, frontend, documents, qa, reviewer                  |
| ADR relacionados         | **ADR-0015: datos sensibles de estudiantes cifrados en la aplicación**. Se apoya en ADR-0004 (tenancy) y ADR-0007 |
| Autor / Fecha            | product + privacy / 2026-11-13. Aprobada por el usuario el mismo día, con las decisiones de §11                   |

## 1. Objetivo

Cuando la planeación con DUA (SPEC-0016) no basta para un estudiante, el Decreto 1421 de 2017 pide
un **PIAR**: el plan con los apoyos y ajustes razonables que ese estudiante necesita, por área y
por periodo. Profe ayuda al docente a escribirlo, a proponer los ajustes con IA y a descargarlo en
Word o PDF para firmarlo.

El PIAR trae **datos personales de un menor de edad**, y algunos son sensibles (Ley 1581 de 2012,
art. 5 y 7). Por eso todo en esta spec parte de la privacidad: se guarda lo mínimo, cifrado, lo ve
solo quien lo creó, nunca va a la IA nada que identifique al estudiante y siempre se avisa que los
datos son privados.

## 2. Alcance

**Incluye:**

- "PIAR" en el menú lateral (Mi trabajo): lista de los PIAR del docente y "Nuevo PIAR".
- Crear un PIAR para un estudiante de uno de sus cursos, con la confirmación de que tiene la
  autorización del acudiente y del colegio.
- Secciones: estudiante; cómo aprende (fortalezas e intereses); barreras para aprender en la
  asignatura; ajustes razonables por periodo (propósito, ajustes curriculares, didácticos y de
  evaluación, seguimiento); recomendaciones para la familia.
- "Proponer ajustes con IA" por periodo, a partir de la asignatura, el grado, los temas del periodo
  y las barreras escritas por el docente. El docente revisa antes de agregar.
- Word y PDF con espacio para las firmas del docente, el acudiente y el directivo.
- Borrar un PIAR (con confirmación) y borrado automático al vencer.
- Aviso de privacidad en todas las pantallas del PIAR y en los documentos.

**No incluye (explícitamente):**

- Diagnóstico médico (decisión 3): solo si hay valoración o soporte externo y quién lo emitió.
- Compartir el PIAR con coordinación, orientación u otros docentes (decisión 4): queda para otra spec.
- Datos de contacto del estudiante o la familia, documento de identidad, dirección o fotos.
- El PIAR consolidado de todas las áreas del colegio: este PIAR es el del docente para su asignatura.

## 3. Actores y permisos

| Actor                           | Puede                                           | No puede                                        |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Docente que lo creó             | Crear, ver, editar, descargar y borrar sus PIAR | —                                               |
| Otro docente o el administrador | —                                               | Ver, saber que existe, editar ni borrar el PIAR |

## 4. Reglas de negocio

- **RN-01 — Solo el docente que lo creó.** Todas las operaciones filtran por `institutionId` y por
  la membresía del docente. Un PIAR ajeno responde "no encontrado", también para el administrador
  del colegio.
- **RN-02 — Lo mínimo.** Se guarda: nombre del estudiante, edad (opcional), si tiene valoración o
  soporte externo y quién lo emitió, fortalezas e intereses, cómo aprende mejor, barreras, ajustes
  por periodo y recomendaciones para la familia. Nada más.
- **RN-03 — Cifrado.** Todo el contenido del PIAR se guarda cifrado (AES-256-GCM, ADR-0015). En
  claro quedan solo: el curso, el año, las fechas y el vencimiento. Sin la clave
  `PIAR_ENCRYPTION_KEY`, Profe no ofrece el PIAR y lo explica.
- **RN-04 — Autorización.** Para crear un PIAR, el docente confirma que tiene la autorización del
  acudiente y del colegio para registrar estos datos (Ley 1581 de 2012). Se guarda la fecha.
- **RN-05 — IA sin datos personales.** A la IA van solo la asignatura, el grado, el periodo, los
  temas del periodo y las barreras descritas por el docente. Antes de enviar:
  - se quita el nombre del estudiante de las barreras;
  - se quitan correos y teléfonos.

  Nunca van la edad, la valoración ni las fortalezas. La respuesta se valida en el AI Engine y queda
  en `generation_logs`, sin el contenido.

- **RN-06 — Aviso de privacidad siempre.** Cada pantalla del PIAR muestra: "Datos privados de un
  menor de edad. Solo tú los ves y se guardan cifrados", y la fecha en que se borran. Los documentos
  dicen "Confidencial: contiene datos personales de un menor de edad" en el pie.
- **RN-07 — Vencimiento.** Un PIAR vence el 31 de diciembre del año siguiente a su año lectivo y se
  borra solo. El docente lo puede borrar antes.
- **RN-08 — Auditoría sin contenido.** Crear, editar, descargar y borrar quedan en la auditoría con
  el id, nunca con el nombre ni el contenido. Los logs tampoco llevan contenido.
- **RN-09 — Límite.** "Proponer ajustes con IA" comparte el límite de propuestas de SPEC-0014
  (20 al día, 5 por minuto) y no gasta el cupo de recursos.

## 5. Entradas

- Crear: curso del docente, nombre del estudiante (1–120 caracteres) y la confirmación de RN-04.
- Guardar: el contenido completo, validado con el schema `piarContentSchema` (`modules/piar/schemas.ts`).
- `POST /v1/generation/piar-adjustments` (contrato `generation-piar.v1`): asignatura, grado,
  periodo, temas (máx. 12) y barreras (máx. 1500 caracteres, ya sin datos personales).

## 6. Salidas

- Tabla `piars` con el contenido cifrado (`ciphertext`, `iv`, `tag`, `keyVersion`).
- Propuesta de ajustes: listas de ajustes curriculares, didácticos y de evaluación (1 a 3 cada una)
  y una sugerencia de seguimiento.
- Documento Word o PDF del PIAR.

## 7. Errores y casos límite

| Caso                                  | Comportamiento                                                    |
| ------------------------------------- | ----------------------------------------------------------------- |
| Falta `PIAR_ENCRYPTION_KEY`           | La página explica que el PIAR no está configurado; nada se guarda |
| El contenido cifrado no se puede leer | Error claro y registro sin contenido; nunca se muestra basura     |
| AI Engine caído                       | "No pudimos proponer ajustes; escríbelos tú"; el PIAR funciona    |
| Barreras vacías                       | No se ofrece la propuesta con IA hasta que el docente las escriba |

## 8. Criterios de aceptación

- **CA-0017-01:** Dado un docente con un curso, cuando crea un PIAR confirmando la autorización,
  llena sus secciones y guarda, entonces lo encuentra en "PIAR" y lo puede seguir editando.
- **CA-0017-02:** Dado un PIAR guardado, cuando se lee la tabla `piars` directamente, entonces ni el
  nombre ni las barreras aparecen en claro; un contenido alterado no se descifra.
- **CA-0017-03:** Dado otro docente del colegio o el administrador, cuando intenta ver, editar,
  descargar o borrar el PIAR, entonces recibe "no encontrado" y no lo ve en ninguna lista.
- **CA-0017-04:** Dadas las barreras con el nombre del estudiante y un teléfono, cuando el docente
  pide "Proponer ajustes con IA", entonces la petición al AI Engine no trae el nombre, el teléfono,
  la edad ni las fortalezas, y la propuesta se puede agregar al periodo.
- **CA-0017-05:** Dada cualquier pantalla del PIAR, cuando se mira, entonces se ve el aviso de
  privacidad con la fecha de borrado; y el Word y el PDF llevan el aviso de confidencialidad y los
  espacios para las firmas.
- **CA-0017-06:** Dado un PIAR vencido, cuando el docente abre "PIAR", entonces ya no existe en la
  base. Dado un PIAR que el docente borra, entonces desaparece.
- **CA-0017-07:** Dada la auditoría, cuando se crea, edita, descarga o borra un PIAR, entonces queda
  el evento sin nombre ni contenido.
- **CA-0017-08:** Dado el AI Engine, cuando recibe una petición con campos de más (p. ej.
  `studentName`), entonces la rechaza; y una salida sin los tres tipos de ajuste se repara.
- **CA-0017-09:** Dadas las pantallas del PIAR, cuando se analizan con axe a 360 px, entonces no hay
  violaciones WCAG 2.1 AA ni scroll horizontal.

## 9. Seguridad y privacidad

- Ley 1581 de 2012: datos de niños, niñas y adolescentes (art. 7) y datos sensibles (art. 5). Se
  tratan con autorización (RN-04), finalidad educativa, mínimo necesario (RN-02), seguridad
  (RN-03) y supresión (RN-07).
- La clave de cifrado vive solo en las variables de entorno del servidor, nunca en el repositorio
  ni en el navegador.
- Las páginas del PIAR no se guardan para usar sin conexión (el service worker de ADR-0012 no las
  cachea) y no se indexan.

## 10. Tareas

- [x] T1 — ADR-0015, tabla `piars` y cifrado (`lib/crypto`) — privacy + database + auth-security
- [x] T2 — Módulo `piar`: servicio, permisos, vencimiento, auditoría — backend
- [x] T3 — AI Engine: contrato `generation-piar.v1`, prompt, validador, mock — ai-engine
- [x] T4 — UI: lista, nuevo, editor con aviso de privacidad y propuesta con IA — frontend
- [x] T5 — Word y PDF con firmas y aviso — documents
- [x] T6 — Pruebas por CA (incluye acceso cruzado y cifrado) y revisión — qa + reviewer

## 11. Decisiones (del usuario, 2026-11-13)

1. **Se guarda, protegido:** cifrado, solo el docente lo ve, borrado manual y automático.
2. **La IA ayuda sin datos personales:** grado, asignatura, temas y barreras; nunca nombre,
   documento ni diagnóstico.
3. **Sin diagnóstico:** solo barreras y apoyos; si hay soporte externo, quién lo emitió.
4. **Solo el docente que lo creó** en esta primera versión.

## 12. Implementación (2026-11-13)

- Base: tabla `piars` (migración `20261113120000_piar`) con `ciphertext`, `iv`, `tag`,
  `keyVersion`, `consentAt` y `expiresAt`; FK compuestas al curso y a la membresía.
- Cifrado: `lib/crypto` (AES-256-GCM, AAD `piar:<id>:<institutionId>`). La clave es
  `PIAR_ENCRYPTION_KEY` (opcional en `lib/env-schema.ts`; documentada en `.env.example` y en la
  guía de despliegue).
- Módulo `piar`:
  - `service.ts`: crear, listar con barrido de vencidos, leer, guardar, borrar, exportar y
    `proposeAdjustments`;
  - `withoutStudentName` quita el nombre (sin importar tildes ni mayúsculas) y los datos de
    contacto antes de la IA;
  - `schemas.ts` y `actions.ts`.
- IA: `modules/generation/piar.ts` (límite de propuestas, registro sin contenido); en el AI Engine,
  `app/generation/piar.py`, `prompts/piar.v1.md` y `/v1/generation/piar-adjustments`; contrato en
  `docs/ai/contracts/generation-piar.v1.md`.
- UI:
  - `/piar` (lista y "Nuevo PIAR" con la autorización) y `/piar/[piarId]` (editor por secciones,
    propuesta por periodo, guardar, PDF, Word y borrar), siempre con `PrivacyNotice`;
  - "PIAR" en el menú lateral, con candado;
  - el título de la pestaña y el nombre del archivo no llevan el nombre del estudiante (solo sus
    iniciales en el archivo).
- Documentos: `modules/documents/build-piar.ts` y la ruta `/piar/[piarId]/export` (`no-store`).
- Pruebas:
  - `tests/integration/spec-0017.test.ts` (8): cifrado en la base, contenido alterado o copiado,
    acceso cruzado (otro docente y administrador), IA sin datos personales, vencimiento,
    auditoría;
  - `apps/ai-engine/tests/test_piar.py` (10);
  - `tests/e2e/spec-0017.spec.ts` (2, axe a 360 px);
  - el PIAR también en `tests/e2e/auditoria.movil.spec.ts`.
- Revisión (reviewer): sin hallazgos bloqueantes. Pendiente fuera del código: que el colegio
  defina su política de datos (Ley 1581) y la autorización de los acudientes; la rotación de la
  clave (`keyVersion`) queda lista para cuando haga falta.
