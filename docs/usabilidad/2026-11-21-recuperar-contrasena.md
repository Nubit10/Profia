# Prueba de usabilidad: recuperar la contraseña y ver la contraseña (2026-11-21)

Vistas de SPEC-0035: inicio de sesión, "¿Olvidaste tu contraseña?", "Revisa tu correo", el correo,
"Crea tu contraseña nueva" y "Este enlace ya no sirve". Capturas en
[`docs/design/capturas/spec-0035/`](../design/capturas/spec-0035/) (escritorio 1280 × 800 y celular iPhone 13).

## Cómo se probó

Se recorrió la tarea de una docente que **no recuerda su contraseña**: escribe su correo en el login,
intenta una contraseña, la mira con el ojo, toca "¿Olvidaste tu contraseña?", pide el enlace, lo abre
desde el correo, escribe la nueva y entra. Se repitió en el computador y en el celular, con un build de
producción y el correo guardado como archivo (sin servidor SMTP). Además: axe (WCAG 2.1 AA), desborde
lateral a 390 px y tamaño de las áreas táctiles, dentro de las e2e `spec-0035.spec.ts` y
`spec-0035.movil.spec.ts`.

## Resultado

| Medida                                            | Computador | Celular    |
| ------------------------------------------------- | ---------- | ---------- |
| Toques, del login a estar adentro (con el correo) | 4          | 4          |
| Campos para escribir                              | 3          | 3          |
| Fallas de accesibilidad (axe) en las 4 pantallas  | 0          | 0          |
| Desborde lateral                                  | no         | no         |
| Botón de ver la contraseña                        | 44 × 40 px | 44 × 44 px |

Los 4 toques: "¿Olvidaste tu contraseña?", "Enviarme el enlace", el botón del correo y "Guardar y
entrar". El correo no se vuelve a escribir: el enlace del login lo lleva.

## Lo que funciona

- **Ver la contraseña** en el login, el registro y la contraseña nueva: el ojo está dentro del campo, cambia
  a "ojo tachado" y el lector de pantalla dice "Mostrar/Ocultar contraseña". Cada campo se muestra por
  separado.
- **"¿Olvidaste tu contraseña?"** está justo debajo del campo de contraseña, donde se busca cuando falla.
- **"Revisa tu correo"** muestra a qué correo se envió (si está mal escrito se nota) y qué hacer si no llega
  (spam). No dice si la cuenta existe (seguridad), pero no confunde.
- **El correo** es corto, con el nombre, un solo botón grande y el enlace de respaldo para copiar.
- **Al guardar entra directo** a Profe; no hay que volver a escribir la contraseña en el login.
- **Enlace vencido o usado:** un mensaje claro y un solo botón, "Pedir un enlace nuevo".
- Se corrigió durante la prueba: los títulos de estas pantallas (y de login y registro) no eran
  encabezados para los lectores de pantalla; ahora sí.

## Recomendaciones (no hechas: decide el usuario)

1. **Quitar "Confirmar contraseña"** del registro y de la contraseña nueva. Con el ojo, el docente ya
   puede revisar lo que escribió; el campo repetido es un paso más en el celular. Baja el registro de 4 a
   3 campos.
2. **Tras un intento fallido de inicio de sesión**, decir en el mismo mensaje "¿Olvidaste tu contraseña?"
   con el enlace (hoy está debajo del campo, pero el aviso rojo llama más la atención).
3. **Avisar del remitente** en "Revisa tu correo" ("te llega de Profe <…>"), cuando se sepa el correo de
   producción, para que lo encuentren en la bandeja.
4. Probar con un servidor SMTP real que el correo no caiga en spam en Gmail, Outlook y Hotmail (los
   correos institucionales de colegios suelen ser Outlook).
5. Si el docente abre el enlace desde la app de Gmail en el celular, entra en el navegador interno de
   Gmail, no en Profe instalado. Es normal; se puede explicar en "Primeros pasos" si confunde.
