# SPEC: Visualizacion de camaras Home Assistant V1

**Estado:** Implementado
**Fecha:** 2026-06-26

## 1. Problema

Las entidades `camera.*` importadas desde Home Assistant se muestran como dispositivos genericos y no exponen su imagen en vivo. El operador necesita reconocerlas como camaras, ver el stream dentro de Inicio y ampliarlo sin abandonar HomePilot.

## 2. Alcance

- Perfil y capability modular `camera` para entidades Home Assistant.
- Compatibilidad con camaras importadas antes de esta version mediante el dominio de `externalId`.
- Sesion de medios autenticada para obtener URLs limitadas a una camara.
- Proxy local de snapshot JPEG y stream MJPEG sin exponer el token administrativo de Home Assistant.
- Tarjeta responsive con estados de conexion, error e indisponibilidad.
- Visor de camara en pantalla completa con cierre por boton, fondo o tecla Escape.

## 3. Requisitos funcionales

- **REQ-01:** `camera.*` debe resolverse como capability `camera`, sin comandos de encendido o apagado.
- **REQ-02:** La UI debe seleccionar una tarjeta especializada cuando el dispositivo tenga capability `camera`.
- **REQ-03:** El backend debe consultar el estado actual de la entidad antes de entregar una sesion de medios.
- **REQ-04:** El navegador no debe recibir el token de acceso de larga duracion de Home Assistant; el proxy debe validar el token limitado de la entidad antes de usar su credencial interna.
- **REQ-05:** El stream debe pasar por HomePilot y conservar el `Content-Type` entregado por Home Assistant.
- **REQ-06:** Una camara `unavailable` debe conservar una tarjeta legible y permitir reintentar sin ocultar el resto del dashboard.
- **REQ-07:** Al abrir el visor, la tarjeta debe liberar su stream para evitar dos conexiones simultaneas a la misma camara.

## 4. Requisitos no funcionales

- **NFR-01:** El componente debe reutilizar tokens, radios, tipografia y estados del design system existente.
- **NFR-02:** Debe funcionar en celular, tablet y escritorio con una relacion visual `16:9`.
- **NFR-03:** El proxy debe cancelar la solicitud upstream cuando el navegador cierre la conexion.
- **NFR-04:** Las respuestas de camara deben usar `Cache-Control: no-store`.

## 5. Criterios de aceptacion

- [x] AC1: El catalogo de perfiles y el resolver identifican `ha:camera.*` como `camera`.
- [x] AC2: Una camara nueva se importa con `type: camera`.
- [x] AC3: Inicio muestra video MJPEG para camaras disponibles y no ofrece controles de power.
- [x] AC4: Presionar la tarjeta abre un visor completo y accesible.
- [x] AC5: Error, carga e indisponibilidad se representan sin romper el layout.
- [x] AC6: El token administrativo de Home Assistant permanece solamente en el backend.
