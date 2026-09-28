# Controles efectivos de pizarras Android en HomePilot V1

**Estado:** Implementado

## Alcance

La consola obtiene las acciones efectivas de un Device autenticado mediante `GET /api/v1/devices/:id/effective-actions`. El endpoint comprueba pertenencia al hogar y responde solo `deviceId` y datos de control necesarios. No expone identidad comercial, tokens ni configuración de infraestructura.

En `POST /api/v1/devices/:id/command`, todo dispositivo `integrationSource=android-display` requiere que `semanticAction` esté en `EffectiveActionsProvider`, además de la validación local existente. La fuente de integración gobierna el driver; así la política no se elude si el tipo cambia por error. Otros dispositivos conservan su comportamiento. Los controles visibles de la consola se basan en la respuesta efectiva; `navigate_home`, `navigate_back` y `volume_set` usan el endpoint de comandos actual. Volumen envía un entero 0–100 únicamente al confirmar, no durante el arrastre.

La UI identifica la pantalla y su conexión desde el estado local del Device. La vista de control remoto inmediato de esta fase fue sustituida por el catálogo informativo y las tarjetas Dashboard definidos en `smart-display-control-catalog-v1.md`. La autorización HTTP y el pipeline Android de esta fase permanecen vigentes.

## Criterios de aceptación

- [x] La consulta exige autenticación y ownership antes de llamar al provider.
- [x] La respuesta no contiene datos comerciales ni secretos.
- [x] La ejecución HTTP de un Smart Display se deniega cuando la acción no es efectiva; los otros dispositivos no cambian.
- [x] La pizarra se clasifica y presenta como pantalla con conexión real.
- [x] La interfaz posterior presenta únicamente la disponibilidad autorizada, con estados de carga y error; no ejecuta desde el Gestor.
- [x] La ejecución cotidiana se traslada a Dashboard usando `actionKey` y el pipeline existente.

Pruebas escritas pero no ejecutadas por restricción expresa de esta tarea.
