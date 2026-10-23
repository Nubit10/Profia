# Revisión docente del catálogo de DBA

**Para:** la persona del equipo con criterio docente que valida el catálogo antes de marcarlo como revisado (SPEC-0004, ADR-0005).
**Tiempo estimado:** 45–60 minutos.

## Qué ya está verificado automáticamente

Los textos se extrajeron de los PDF oficiales del MEN y `npm run curriculum:verify` comprueba que:

- cada enunciado y cada evidencia del catálogo aparece **literalmente** en el PDF (no hay texto inventado ni reescrito);
- cada viñeta de evidencia del PDF está en el catálogo (no falta ninguna);
- los DBA de cada grado van numerados sin saltos.

Lo que una máquina **no** puede asegurar es que cada evidencia quedó bajo **el DBA correcto**: en las páginas a dos columnas, el texto del PDF sale desordenado. Eso es lo que necesitamos que revises.

## 1. Las 9 evidencias que movimos (Matemáticas) — obligatorio

Para cada fila, abre el PDF en la página indicada y confirma que la evidencia pertenece al DBA de destino.

| Grado | Evidencia (empieza con…)                                                      | La movimos del DBA → al DBA | Pág. | ¿Correcto? |
| ----- | ----------------------------------------------------------------------------- | --------------------------- | ---- | ---------- |
| 4°    | «Argumenta sobre la importancia y necesidad de medir…»                        | 3 → 4                       | 32   |            |
| 5°    | «Reconoce diferentes distribuciones de plantillas de un cuerpo…»              | 5 → 6                       | 40   |            |
| 6°    | «Compara las características de dos o más poblaciones…»                       | 10 → 11                     | 51   |            |
| 6°    | «Describe el comportamiento de las características de dos o más poblaciones…» | 10 → 11                     | 51   |            |
| 8°    | «Identifica y enumera los resultados favorables…»                             | 11 → 12                     | 65   |            |
| 8°    | «Asigna la probabilidad de la ocurrencia de un evento…»                       | 11 → 12                     | 65   |            |
| 8°    | «Reconoce cuando dos eventos son o no mutuamente excluyentes…»                | 11 → 12                     | 65   |            |
| 9°    | «Valida las conjeturas y explica sus conclusiones.»                           | 8 → 9                       | 71   |            |
| 9°    | «Interpreta expresiones numéricas y toma decisiones…»                         | 8 → 9                       | 71   |            |

Documento: [DBA Matemáticas V.2](https://www.colombiaaprende.edu.co/sites/default/files/files_public/2026-06/dba_matematicas-min.pdf)

## 2. Muestra aleatoria — compara contra el PDF

Para cada código, compara en la aplicación (página del curso de ese grado) o en `apps/web/curriculum/men/*.json` el enunciado y **todas** sus evidencias con el PDF.

**Matemáticas** ([PDF](https://www.colombiaaprende.edu.co/sites/default/files/files_public/2026-06/dba_matematicas-min.pdf)): 1° DBA 7 (pág. 11) · 1° DBA 10 (pág. 13) · 2° DBA 10 (pág. 20) · 4° DBA 10 (pág. 36) · 5° DBA 8 (pág. 41) · 7° DBA 2 (pág. 53) · 8° DBA 8 (pág. 63) · 10° DBA 7 (pág. 77)

**Lenguaje** ([PDF](https://www.colombiaaprende.edu.co/sites/default/files/files_public/2026-05/dba_lenguaje-min.pdf)): 1° DBA 5 (pág. 10) · 1° DBA 8 (pág. 11) · 2° DBA 4 (pág. 13) · 2° DBA 5 (pág. 14) · 4° DBA 4 (pág. 21) · 6° DBA 7 (pág. 31) · 9° DBA 1 (pág. 40) · 10° DBA 3 (pág. 45)

**Transición** ([PDF](https://www.colombiaaprende.edu.co/sites/default/files/files_public/2026-06/dba_transicion-min_0.pdf)): DBA 2 (pág. 11) · DBA 4 (pág. 12) · DBA 7 (pág. 14) · DBA 14 (pág. 17)

Revisa en cada uno: que el texto sea idéntico, que no falten ni sobren evidencias y que no haya palabras cortadas.

## 3. Decisiones de contenido que conviene confirmar

- **Los ejemplos no se transcriben.** Contienen tablas y figuras que no se pueden copiar fielmente. Cada DBA enlaza a su página del PDF para verlos.
- **Transición** usa su propio documento (no dividido por áreas) y aparece en cualquier curso de Transición.
- **Ciencias Naturales, Ciencias Sociales, Inglés y los Estándares** se cargan en una siguiente etapa.

## Cómo reportar el resultado

Responde con: (1) la tabla de la sección 1 con Sí/No, (2) cualquier diferencia de la muestra (código y qué cambia) y (3) nombre de quien revisó. Con eso, Claude actualiza los archivos (`review.status: "APPROVED"`, `reviewedBy`, `reviewedAt`) y reimporta. La aplicación deja de mostrar el aviso «pendiente de revisión docente».
