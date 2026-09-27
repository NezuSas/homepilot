# Controles efectivos de pizarras Android en HomePilot V1

**Estado:** Implementado

## Alcance

La consola obtiene las acciones efectivas de un Device autenticado mediante `GET /api/v1/devices/:id/effective-actions`. El endpoint comprueba pertenencia al hogar y responde solo `deviceId` y datos de control necesarios. No expone identidad comercial, tokens ni configuración de infraestructura.

En `POST /api/v1/devices/:id/command`, todo dispositivo `integrationSource=android-display` requiere que `semanticAction` esté en `EffectiveActionsProvider`, además de la validación local existente. La fuente de integración gobierna el driver; así la política no se elude si el tipo cambia por error. Otros dispositivos conservan su comportamiento. Los controles visibles de la consola se basan en la respuesta efectiva; `navigate_home`, `navigate_back` y `volume_set` usan el endpoint de comandos actual. Volumen envía un entero 0–100 únicamente al confirmar, no durante el arrastre.

La UI identifica la pantalla y su conexión desde el estado local del Device. No muestra IntentFlow, Directory, claves de manifest ni IDs internos. Si no hay acciones, muestra un estado vacío; fallos de lectura y ejecución muestran recuperación. Esta fase no añade ejecución Android alternativa.

## Criterios de aceptación

- [x] La consulta exige autenticación y ownership antes de llamar al provider.
- [x] La respuesta no contiene datos comerciales ni secretos.
- [x] La ejecución HTTP de un Smart Display se deniega cuando la acción no es efectiva; los otros dispositivos no cambian.
- [x] La pizarra se clasifica y presenta como pantalla con conexión real.
- [x] Solo los controles recibidos y visibles aparecen; un listado vacío tiene estado propio.
- [x] Inicio y Atrás envían los nombres locales existentes; volumen confirma `volume_set` con `{volume}` entero.
- [x] Existen estados de carga, error y operación en curso, con traducciones ES/EN.

Pruebas escritas pero no ejecutadas por restricción expresa de esta tarea.
