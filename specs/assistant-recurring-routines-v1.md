# SPEC: Rutinas recurrentes conversacionales V1

**Estado:** Implementado
**Fecha:** 2026-08-25

## Problema

Las rutinas horarias conversacionales se ejecutaban diariamente de forma implícita. El usuario no podía expresar ni verificar una recurrencia diaria o de lunes a viernes antes de activarlas.

## Alcance

- Reconocer `todos los días` / `every day` y `de lunes a viernes` / `on weekdays` al crear una rutina horaria.
- Persistir los días en el `TimeTrigger` local.
- Mostrar la recurrencia solicitada en la confirmación antes de activar la rutina.

## Fuera de alcance

- Días individuales, fines de semana, fechas concretas y calendarios complejos.
- Temporizadores relativos.
- Cambiar la recurrencia de una rutina ya activa por conversación.

## Requisitos

- **REQ-01:** `todos los días` y `every day` generan los días `[0,1,2,3,4,5,6]`.
- **REQ-02:** `de lunes a viernes` y `on weekdays` generan los días `[1,2,3,4,5]`, donde 0 representa domingo.
- **REQ-03:** La confirmación muestra la recurrencia detectada en el idioma de la conversación.
- **REQ-04:** La creación mantiene la confirmación explícita y no despacha comandos antes de activarse.

## Criterios de aceptación

- [x] **AC1:** Una rutina en español con `todos los días` crea un borrador con los siete días.
- [x] **AC2:** Una rutina en inglés con `on weekdays` crea un borrador de lunes a viernes.
- [x] **AC3:** La confirmación en español e inglés comunica la recurrencia elegida.
- [x] **AC4:** Al activar la rutina, los días llegan intactos a la regla horaria local.