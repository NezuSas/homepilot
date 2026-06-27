# SPEC: Visualizacion de camaras Home Assistant V1

**Estado:** Implementado
**Fecha:** 2026-06-26

## 1. Problema

Las entidades `camera.*` importadas desde Home Assistant se muestran como dispositivos genericos y no exponen su imagen en vivo. El operador necesita reconocerlas como camaras, ver el stream dentro de Inicio y ampliarlo sin abandonar HomePilot.

## 2. Alcance

- Perfil y capability modular `camera` para entidades Home Assistant.
- Compatibilidad con camaras importadas antes de esta version mediante el dominio de `externalId`.
- Sesion de medios autenticada para obtener URLs limitadas a una camara.
- Proxy local de snapshot JPEG, stream MJPEG y HLS sin exponer el token administrativo de Home Assistant.
- Fallback automatico a snapshots periodicos para camaras que entregan imagen pero no un stream utilizable.
- Tarjeta responsive con estados de conexion, error e indisponibilidad.
- Visor de camara en pantalla completa con cierre por boton, fondo o tecla Escape.

## 3. Requisitos funcionales

- **REQ-01:** `camera.*` debe resolverse como capability `camera`, sin comandos de encendido o apagado.
- **REQ-02:** La UI debe seleccionar una tarjeta especializada cuando el dispositivo tenga capability `camera`.
- **REQ-03:** El backend debe consultar el estado actual de la entidad antes de entregar una sesion de medios.
- **REQ-04:** El navegador no debe recibir el token de acceso de larga duracion de Home Assistant; el proxy debe validar un token corto firmado por HomePilot antes de usar su credencial interna.
- **REQ-05:** El stream debe pasar por HomePilot y conservar el `Content-Type` entregado por Home Assistant.
- **REQ-06:** Una camara `unavailable` debe conservar una tarjeta legible y permitir reintentar sin ocultar el resto del dashboard.
- **REQ-07:** Al abrir el visor, la tarjeta debe liberar su stream para evitar dos conexiones simultaneas a la misma camara.
- **REQ-08:** Si el stream termina sin entregar imagen, la UI debe cambiar automaticamente al snapshot y actualizarlo periodicamente sin mostrar la camara como averiada.
- **REQ-09:** La UI debe identificar visualmente una vista por snapshots como actualizada, sin etiquetarla como video en vivo.
- **REQ-10:** Cuando Home Assistant anuncie un stream HLS, HomePilot debe usarlo antes de intentar MJPEG o snapshots.
- **REQ-11:** Los manifiestos y segmentos HLS deben pasar por HomePilot mediante rutas temporales; la URL HLS interna y la credencial de Home Assistant no deben llegar al navegador.

## 4. Requisitos no funcionales

- **NFR-01:** El componente debe reutilizar tokens, radios, tipografia y estados del design system existente.
- **NFR-02:** Debe funcionar en celular, tablet y escritorio con una relacion visual `16:9`.
- **NFR-03:** El proxy debe cancelar la solicitud upstream cuando el navegador cierre la conexion.
- **NFR-04:** Las respuestas de camara deben usar `Cache-Control: no-store`.
- **NFR-05:** El fallback debe conservar la ultima imagen valida durante cada actualizacion para evitar parpadeos.
- **NFR-06:** El reproductor debe liberar HLS y sus conexiones cuando la tarjeta deje de estar activa o se cierre el visor.

## 5. Criterios de aceptacion

- [x] AC1: El catalogo de perfiles y el resolver identifican `ha:camera.*` como `camera`.
- [x] AC2: Una camara nueva se importa con `type: camera`.
- [x] AC3: Inicio muestra video MJPEG para camaras disponibles y no ofrece controles de power.
- [x] AC4: Presionar la tarjeta abre un visor completo y accesible.
- [x] AC5: Error, carga e indisponibilidad se representan sin romper el layout.
- [x] AC6: El token administrativo de Home Assistant permanece solamente en el backend.
- [x] AC7: Una camara sin stream utilizable pero con snapshot valido permanece operativa mediante actualizaciones periodicas.
- [x] AC8: El visor completo utiliza el mismo fallback modular que la tarjeta.
- [x] AC9: Una camara RTSP generica que Home Assistant reproduce como HLS se muestra como video en HomePilot.
- [x] AC10: Si HLS falla, la UI intenta MJPEG y finalmente snapshots sin romper la tarjeta.
