# SPEC: Energy Management V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17

## 1. Declaración del Problema

El operador necesita visualizar métricas energéticas disponibles sin convertir la consola en fuente de verdad ni acoplarla al proveedor de datos.

## 2. Alcance

- Consultar y presentar snapshots locales de energía en consola y dashboard.
- Mantener estados de carga, vacío y error sin ocultar datos previos.
- Integrar métricas importadas como datos HomePilot, no como llamadas directas desde UI a Home Assistant.

## 3. Fuera de Alcance

- Facturación, predicción de consumo o control de cargas por tarifa.

## 4. Requisitos Funcionales

- **REQ-01:** La vista muestra únicamente métricas disponibles y su unidad.
- **REQ-02:** Una actualización conserva el último snapshot hasta recibir el nuevo.
- **REQ-03:** El widget energético se configura desde el dashboard y respeta su responsive layout.

## 5. Requisitos No Funcionales

- **NFR-01:** Las cadenas visibles usan i18n ES/EN.
- **NFR-02:** La UI no contiene cálculo de negocio de energía.

## 6. Criterios de Aceptación

- [x] AC1: Una métrica disponible se visualiza con valor y unidad.
- [x] AC2: Ausencia de datos muestra estado vacío sin romper tablero.
- [x] AC3: Refrescar no elimina el último dato válido.

## 7. Notas Técnicas y Arquitectura

- La representación reside en `EnergyView`, `useEnergyStore` y `EnergySnapshotWidget`.
- El origen se trata como dispositivo o snapshot importado por HomePilot.

## 8. Preguntas Abiertas y TODOs

- TODO: Definir modelo de histórico y retención energética local.
