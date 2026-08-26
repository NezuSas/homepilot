# SPEC: Rutinas condicionadas conversacionales V1

**Estado:** Implementado  
**Fecha:** 2026-08-25

## Alcance

- Reconocer una condición de cambio de estado de un dispositivo autorizado y una acción sobre otro dispositivo autorizado.
- Crear un borrador de automatización que requiera confirmación antes de activarse.
- Soportar español e inglés con acciones de encendido y apagado.

## Fuera de alcance

- Condiciones compuestas, sensores numéricos, horarios, varias acciones o destinos ambiguos.

## Requisitos

- **REQ-01:** El dispositivo que dispara y el dispositivo objetivo deben identificarse de forma exacta entre los dispositivos autorizados del mismo hogar.
- **REQ-02:** El dispositivo objetivo debe soportar el comando solicitado.
- **REQ-03:** Nunca se crea una automatización si el origen y destino son el mismo dispositivo.
- **REQ-04:** La regla se conserva como borrador hasta la confirmación explícita del usuario.

## Criterios de aceptación

- [x] **AC1:** `Cuando se encienda Luz Sala, apaga Luz Entrada` prepara un borrador con disparador `device_state_changed` y acción `turn_off`.
- [x] **AC2:** `When Desk Lamp turns off, turn on Hall Light` prepara el borrador equivalente en inglés.
- [x] **AC3:** No se ejecuta ningún comando al preparar la rutina.
- [x] **AC4:** Un origen y destino iguales se rechazan de forma segura.
