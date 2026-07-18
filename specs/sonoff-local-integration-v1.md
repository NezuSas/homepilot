# SPEC: Sonoff Local Integration V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17

## 1. Declaración del Problema

Los dispositivos Sonoff compatibles deben descubrirse y controlarse localmente mediante HomePilot, conservando el modelo genérico de capacidades y sin depender de la UI del fabricante.

## 2. Alcance

- Descubrimiento LAN, normalización e importación de entidades Sonoff.
- Driver local y despacho de comandos compatibles.
- Presentación como dispositivo HomePilot asignable a habitación, escena, automatización o dashboard.

## 3. Fuera de Alcance

- Cuenta cloud eWeLink, firmware OTA o administración de red del dispositivo.

## 4. Requisitos Funcionales

- **REQ-01:** Un dispositivo detectado conserva identificador de integración estable para evitar duplicados.
- **REQ-02:** Solo se exponen comandos soportados por capacidades normalizadas.
- **REQ-03:** El estado local se sincroniza y se propaga como cualquier dispositivo HomePilot.

## 5. Requisitos No Funcionales

- **NFR-01:** Ningún secreto se envía al frontend.
- **NFR-02:** El driver está aislado en `packages/integrations/sonoff`.

## 6. Criterios de Aceptación

- [x] AC1: Una entidad Sonoff se puede descubrir e importar sin duplicarla.
- [x] AC2: Un comando soportado actualiza el estado HomePilot visible.
- [x] AC3: Un comando no soportado se rechaza antes de despacharse.

## 7. Notas Técnicas y Arquitectura

- Implementación en `SonoffLanDiscoveryService`, `SonoffCommandDispatcher` y `SonoffDeviceDriver`.
- Sigue los contratos de `packages/devices`; no crea un flujo especial en la consola.

## 8. Preguntas Abiertas y TODOs

- TODO: Catálogo validado de modelos y capacidades Sonoff locales.
