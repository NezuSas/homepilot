# SPEC: Rutinas programadas conversacionales V1

**Estado:** Implementado
**Fecha:** 2026-08-25

## Problema

El asistente podía preparar una rutina desde una conversación, pero su borrador no respetaba el contrato de `AutomationRule`: el disparador horario no tenía `timeLocal`, `timezone` ni `timeUTC`, y la acción contenía una lista de dispositivos que el motor no sabe ejecutar.

## Alcance

- Crear una rutina conversacional para todos los dispositivos controlables de una estancia.
- Mantener la confirmación explícita antes de persistir recursos activos.
- Al confirmar, crear una escena interna con las acciones solicitadas y una sola regla horaria que ejecuta esa escena.
- Usar la zona horaria configurada en el sistema.
- Ejecutar enteramente en el Edge local.

## Fuera de alcance

- Días de la semana, fechas concretas, amanecer/atardecer y temporizadores relativos.
- Edición conversacional de rutinas ya activas.
- Acciones con dispositivos de varias estancias en la misma solicitud.

## Requisitos

- **REQ-01:** La creación conversacional obtiene la zona horaria mediante `SystemVariableService`.
- **REQ-02:** El borrador conserva un horario local `HH:mm`, una zona IANA y las acciones de escena tipadas.
- **REQ-03:** La activación valida y persiste una `AutomationRule` con un `TimeTrigger` válido y una acción `execute_scene`.
- **REQ-04:** La escena interna incluye todos los dispositivos controlables de la estancia y conserva el comando solicitado.
- **REQ-05:** Un borrador inválido no se marca como activo ni persiste una regla.

## Criterios de aceptación

- [x] **AC1:** «Crea una rutina llamada Buenas noches en Cuarto Master para apagar las luces a las 22:30» genera un borrador programado para las 22:30 en la zona configurada.
- [x] **AC2:** Al confirmar, se persisten una escena interna y una regla con `trigger.type = time`, `timeLocal`, `timezone`, `timeUTC` y `action.type = execute_scene`.
- [x] **AC3:** La regla ejecuta la escena interna, por lo que afecta a todos los dispositivos controlables de la estancia.
- [x] **AC4:** La creación del borrador no despacha comandos ni cambia dispositivos antes de la confirmación.
- [x] **AC5:** Las pruebas cubren la forma del borrador, la activación y la validación de una regla inválida.
