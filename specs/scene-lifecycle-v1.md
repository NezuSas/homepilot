# SPEC: Scene Lifecycle V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17  
**Código trazado:** `apps/api/routes/SceneRoutes.ts`, `packages/automation`, `apps/operator-console/src/views/ScenesView.tsx`, `apps/operator-console/src/views/SceneBuilderModal.tsx`

## 1. Declaración del Problema

Una escena debe encapsular un conjunto nombrado de acciones sobre dispositivos para que un usuario pueda ejecutarlas de forma consistente desde la consola, automatizaciones o el asistente. El comportamiento debe ser local, auditable y no depender de Home Assistant una vez importados los dispositivos.

## 2. Alcance

### Acceso compartido local autorizado

Escenas nuevas e históricas siguen privadas por defecto. El creador puede seleccionar varios usuarios activos de esta instalación para lectura, ejecución y favoritos; solo el creador administra, elimina y cambia accesos. Revocar acceso impide operaciones futuras y oculta favoritos inaccesibles. Se valida pertenencia al hogar y autorización en backend, no solo en UI. Compartir no transfiere ownership ni autoriza editar dispositivos. La ejecución automática continúa bajo identidad del creador.

Persistencia aditiva autorizada: columna JSON `shared_user_ids` con default `[]`, sin reescribir ownership ni acciones. Registros sin creador no se comparten automáticamente. Backup SQLite antes de publicar; reversión recomendada restaurando backup y versión compatible. Pruebas: aislamiento, compartir/revocar, ejecución/favoritos y rechazo de mutaciones por receptor.

- Crear, consultar, editar, eliminar y ejecutar escenas locales.
- Definir acciones por dispositivo usando las capacidades que HomePilot conoce.
- Marcar escenas favoritas para su uso en Inicio y exponerlas a automatizaciones y al asistente.
- Registrar ejecución y propagar los cambios de estado resultantes a los consumidores de tiempo real.
- Componer el acceso de consola dentro de Rutinas, junto a Automatizaciones, sin mezclar sus contratos de dominio.

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
- **REQ-06:** Cada escena nueva pertenece al usuario autenticado que la crea y es privada por defecto. Solo su creador la edita/elimina/administra. Una concesión explícita permite al receptor del mismo hogar listar, ejecutar y marcar favorita; no transfiere ownership. Una escena sin creador no se atribuye automáticamente ni se expone. El asistente mantiene sus permisos restringidos actuales.

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
- [x] AC6: Dos usuarios del mismo hogar permanecen aislados salvo concesión explícita de lectura/ejecución/favoritos. Conocer un ID ajeno no concede acceso. El receptor nunca modifica/elimina/administra; revocar impide futuras ejecuciones/favoritos. El asistente mantiene aislamiento por creador. Las escenas sin creador histórico permanecen inaccesibles, sin atribución automática.

## 7. Notas Técnicas y Arquitectura

- API: `/api/v1/scenes/*` gestionada exclusivamente por `SceneRoutes`.
- Persistencia y reglas residen en el contexto de automatización; la consola solo compone formularios y consume contratos.
- Las acciones deben usar el mismo validador semántico que los comandos de dispositivo.

## 8. Preguntas Abiertas y TODOs

- TODO: Definir versionado de escenas compartidas entre hogares cuando exista Cloud.
