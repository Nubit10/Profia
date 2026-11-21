# SPEC-0031 — Compartir por WhatsApp e imprimir directo

| Campo                    | Valor                                                                        |
| ------------------------ | ---------------------------------------------------------------------------- |
| Estado                   | Implementada                                                                 |
| Fase del roadmap         | Transversal de usabilidad (7 · Documents)                                    |
| Módulo(s) responsable(s) | página del recurso · ruta `export`                                           |
| Agentes                  | product, frontend, qa                                                        |
| ADR relacionados         | ADR-0009                                                                     |
| Autor / Fecha            | product / 2026-11-21 (aprobada por el usuario: "lo demás, tu recomendación") |

## 1. Objetivo

Lo que el docente hace con el material es mandarlo al grupo de WhatsApp o imprimirlo. Bloque 5 de
[usabilidad/proximos-pasos.md](../usabilidad/proximos-pasos.md).

## 2. Reglas de negocio

- **RN-01 — Compartir (celular).** Ícono en la barra del recurso que comparte la hoja del estudiante
  en PDF con la Web Share API (abre WhatsApp u otra app). El PDF se prepara al abrir la página
  (`purpose=share`, sin auditoría de descarga ni efecto en "Primeros pasos") porque Safari solo deja
  compartir justo después del toque. El botón aparece solo si el navegador comparte archivos; si
  compartir falla, se descarga como siempre.
- **RN-02 — Imprimir (computador).** "Imprimir" abre el PDF de la hoja en el navegador
  (`inline=1`, `content-disposition: inline`), listo para imprimir.
- **RN-03:** las mismas reglas de acceso de la ruta `export` (404 a lo ajeno) y su límite por minuto.

## 3. Criterios de aceptación

- **CA-0031-01:** "Imprimir" abre `…/export?doc=student&format=pdf&inline=1` y el servidor responde
  `inline`.
- **CA-0031-02:** en un navegador sin `navigator.canShare` para archivos no aparece "Compartir".

Pendiente: validación manual en un iPhone y un Android reales (el contenedor de pruebas no comparte
archivos).
