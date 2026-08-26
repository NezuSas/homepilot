# SPEC: Temporizadores relativos conversacionales V1

**Estado:** Implementado
**Fecha:** 2026-08-25

## Alcance

- Reconocer cantidades numéricas y expresiones naturales de media o una hora (`en media hora`, `en una hora`, `in half an hour`, `in an hour`) para encender o apagar dispositivos controlables de una estancia.
- Crear, tras confirmación explícita, una regla local con fecha y hora concreta de una sola ejecución.
- Eliminar la regla y la escena interna asociada después de que el motor intente ejecutar el temporizador, evitando que se repita al día siguiente o deje una tarjeta residual en Escenas.
- Consultar los temporizadores activos y el tiempo restante mediante conversación en español o inglés.
- Cancelar un temporizador identificado por su nombre antes de que se ejecute.
- Programar un temporizador para un dispositivo concreto autorizado cuando se lo nombra de forma inequívoca.
- Cancelar todos los temporizadores pendientes con una única confirmación.
- Reprogramar un temporizador pendiente identificado por su nombre, usando un nuevo retraso relativo y confirmación explícita.

## Fuera de alcance

- Editar la acción de un temporizador ya creado.
- Segundos, fechas naturales, amanecer/atardecer y varios destinos en una misma frase.

## Requisitos

- **REQ-01:** El temporizador usa la zona horaria configurada en HomePilot y persiste `dateLocal` y `timeLocal`.
- **REQ-02:** La acción no se ejecuta ni se persiste hasta que el usuario confirme.
- **REQ-03:** El motor solo coincide con la fecha local indicada y elimina la regla tras el intento.
- **REQ-04:** La consulta solo muestra reglas de una ejecución (`dateLocal`) activas y futuras, con su tiempo restante calculado en la zona horaria de la regla.
- **REQ-05:** La cancelación desactiva el temporizador tras confirmación explícita para impedir su ejecución.
- **REQ-06:** Las expresiones naturales de media hora y una hora se convierten a la misma programación local que sus equivalentes numéricos.
- **REQ-07:** Un temporizador de dispositivo utiliza exclusivamente un dispositivo autorizado, controlable y asignado a una estancia; los nombres ambiguos no generan un borrador.
- **REQ-08:** La reprogramación identifica únicamente temporizadores activos de una sola ejecución y sustituye su fecha y hora locales tras confirmación; no modifica rutinas recurrentes.
- **REQ-09:** La consola presenta los temporizadores como acciones únicas, fuera de la lista de rutinas y automatizaciones persistentes; su confirmación conversacional explica que se ejecutarán una sola vez.

## Criterios de aceptación

- [x] **AC1:** `Apaga las luces de Sala en 30 minutos` prepara un borrador con una fecha y hora local futuras.
- [x] **AC2:** `Turn off the Main Bedroom lights in 1 hour` se interpreta en inglés y requiere confirmación.
- [x] **AC3:** Una regla con `dateLocal` se ejecuta solo en dicha fecha y elimina después la regla y su escena interna asociada.
- [x] **AC4:** `¿Qué temporizadores tengo?` y `What timers do I have?` muestran únicamente temporizadores pendientes, con el tiempo restante.
- [x] **AC5:** `Cancela el temporizador [nombre]` solicita confirmación y lo desactiva al confirmarse.
- [x] **AC6:** `Apaga las luces de Sala en media hora` e `Turn off the Living Room lights in an hour` preparan temporizadores correctos antes de activarse.
- [x] **AC7:** `Apaga la TV Smart en una hora` y `Turn off the Desk Lamp in 30 minutes` preparan una regla de una sola ejecución para el dispositivo mencionado, antes de activarse.
- [x] **AC8:** Un temporizador activo solo aparece en la sección de temporizadores, con su tiempo restante y una explicación de una sola ejecución; no se duplica en la lista de rutinas y automatizaciones.