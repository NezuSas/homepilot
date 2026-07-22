# SPEC: Rutinas unificadas de consola V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-07-21
**Código trazado:** `apps/operator-console/src/App.tsx`, `apps/operator-console/src/views/RoutinesView.tsx`

## 1. Declaración del Problema

Las escenas y automatizaciones son dos formas complementarias de operar el hogar: las primeras ejecutan acciones manuales agrupadas y las segundas reaccionan de manera autónoma. Presentarlas como destinos independientes fragmenta la navegación del cliente final.

## 2. Alcance

- Exponer una única entrada de navegación denominada **Rutinas**.
- Organizar Escenas y Automatizaciones en pestañas dentro de Rutinas.
- Conservar los contratos, los datos y los permisos existentes de ambos dominios.
- Mantener los enlaces heredados `/scenes` y `/automations` funcionales, resolviéndolos en la pestaña correspondiente de Rutinas.

## 3. Fuera de Alcance

- Fusionar tablas, endpoints, modelos o reglas de ejecución de escenas y automatizaciones.
- Otorgar permisos de automatización a roles que no los tenían previamente.
- Cambiar el comportamiento de creación, edición, ejecución o auditoría existente.

## 4. Requisitos Funcionales

- **REQ-01:** La barra lateral muestra una sola entrada Rutinas a usuarios con control familiar.
- **REQ-02:** Rutinas abre Escenas como sección predeterminada.
- **REQ-03:** La pestaña Automatizaciones solo se muestra a los roles que ya poseen control administrativo.
- **REQ-04:** Los enlaces internos y las URL heredadas de Escenas o Automatizaciones abren la pestaña correspondiente.
- **REQ-05:** Ejecutar una escena desde Rutinas conserva la reconciliación global del estado de dispositivos.

## 5. Requisitos No Funcionales

- **NFR-01:** Todas las etiquetas nuevas disponen de traducciones ES/EN.
- **NFR-02:** El selector de pestañas usa el componente modular `SegmentedControl` y se adapta a móvil, tablet y escritorio.
- **NFR-03:** La unificación es exclusivamente de experiencia de usuario; no altera los límites de los contextos de dominio.

## 6. Criterios de Aceptación

- [x] AC1: Escenas y Automatizaciones ya no aparecen como dos entradas independientes en la barra lateral.
- [x] AC2: Rutinas permite cambiar entre las dos categorías sin recargar la aplicación.
- [x] AC3: Un rol sin gestión administrativa no puede abrir ni ver la pestaña de Automatizaciones mediante la UI.
- [x] AC4: `/scenes`, `/automations`, `/routines/scenes` y `/routines/automations` conservan una ruta funcional.
- [x] AC5: La composición conserva las pantallas y contratos existentes de Escenas y Automatizaciones.
