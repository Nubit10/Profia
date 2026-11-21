# SPEC-0034 — Detalles: avisos abajo, letra más grande y "Borrador / Listo"

| Campo                    | Valor                                                                        |
| ------------------------ | ---------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                 |
| Fase del roadmap         | Transversal de usabilidad                                                    |
| Módulo(s) responsable(s) | `components/app-toaster.tsx` · `components/app-shell` · página del recurso   |
| Agentes                  | product, frontend, qa                                                        |
| ADR relacionados         | —                                                                            |
| Autor / Fecha            | product / 2026-11-21 (aprobada por el usuario: "lo demás, tu recomendación") |

## 1. Objetivo

Bloque 8 de [usabilidad/proximos-pasos.md](../usabilidad/proximos-pasos.md).

## 2. Reglas de negocio

- **RN-01 — Avisos abajo en el celular.** Los avisos emergentes salen abajo y centrados, por encima de
  la barra inferior (antes tapaban el título un momento). En escritorio, abajo a la derecha.
- **RN-02 — Letra más grande.** En el menú, "Letra más grande" (Sí/No). Es una preferencia del
  dispositivo (`localStorage`), sube la letra un 12,5 % (todo va en `rem`) y se aplica antes de pintar
  con un script mínimo en el `<head>`.
- **RN-03 — "Borrador" y "Listo".** La primera vez que el docente ve un recurso, una línea explica:
  «Borrador»: lo estás revisando y se descarga con la marca; «Listo»: ya lo revisaste y se descarga
  limpio. "Entendido" la oculta en ese dispositivo.

## 3. Criterios de aceptación

- **CA-0034-01:** la letra más grande se mantiene al recargar.
- **CA-0034-02:** la explicación aparece la primera vez y no vuelve después de "Entendido".

Pruebas: `tests/e2e/usabilidad-bloques.movil.spec.ts`.
