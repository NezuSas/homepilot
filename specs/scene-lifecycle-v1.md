# SPEC: Scene Lifecycle V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17  
**Código trazado:** `apps/api/routes/SceneRoutes.ts`, `packages/automation`, `apps/operator-console/src/views/ScenesView.tsx`, `apps/operator-console/src/views/SceneBuilderModal.tsx`

## 1. Declaración del Problema

Una escena debe encapsular un conjunto nombrado de acciones sobre dispositivos para que un usuario pueda ejecutarlas de forma consistente desde la consola, automatizaciones o el asistente. El comportamiento debe ser local, auditable y no depender de Home Assistant una vez importados los dispositivos.

## 2. Alcance

- Crear, consultar, editar, eliminar y ejecutar escenas locales.
- Definir acciones por dispositivo usando las capacidades que HomePilot conoce.
- Marcar escenas favoritas para su uso en Inicio y exponerlas a automatizaciones y al asistente.
- Registrar ejecución y propagar los cambios de estado resultantes a los consumidores de tiempo real.

## 3. Fuera de Alcance

- Importar o modificar escenas remotas de Home Assistant.
- Ejecución parcial silenciosa: cada fallo debe quedar registrado.
- Programación temporal; corresponde a Automatizaciones.

## 4. Requisitos Funcionales

- **REQ-01:** Solo usuarios autorizados pueden administrar escenas; usuarios permitidos pueden ejecutarlas.
- **REQ-02:** Una escena debe tener nombre, hogar propietario y al menos una acción válida antes de guardarse.
- **REQ-03:** Cada acción debe validarse contra las capacidades del dispositivo antes de persistirse o ejecutarse.
- **REQ-04:** La ejecución debe devolver un resultado por acción y registrar el evento con actor, origen y marca de tiempo.
- **REQ-05:** La UI debe conservar el estado anterior durante refrescos y actualizar estados de dispositivos por eventos en tiempo real.

## 5. Requisitos No Funcionales

- **NFR-01:** Las rutas permanecen en `SceneRoutes` mediante el contrato `RouteHandler`.
- **NFR-02:** La escena no almacena secretos de integraciones.
- **NFR-03:** La UI debe tener traducciones ES/EN para cada etiqueta y error visible.

## 6. Criterios de Aceptación

- [x] AC1: Se puede crear una escena con acciones compatibles y verla al recargar.
- [x] AC2: Una acción incompatible se rechaza antes de ejecutarse.
- [x] AC3: Ejecutar una escena registra ejecución y sincroniza el estado visible de los dispositivos.
- [x] AC4: Eliminar una escena impide que aparezca en favoritos, automatizaciones y selectores.
- [x] AC5: Un usuario no autorizado no puede administrar escenas ajenas.

## 7. Notas Técnicas y Arquitectura

- API: `/api/v1/scenes/*` gestionada exclusivamente por `SceneRoutes`.
- Persistencia y reglas residen en el contexto de automatización; la consola solo compone formularios y consume contratos.
- Las acciones deben usar el mismo validador semántico que los comandos de dispositivo.

## 8. Preguntas Abiertas y TODOs

- TODO: Definir versionado de escenas compartidas entre hogares cuando exista Cloud.
