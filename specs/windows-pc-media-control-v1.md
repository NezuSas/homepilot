# Control multimedia de PC Windows v1

**Estado:** Implementado

## Objetivo

Exponer una PC Windows que ya ejecuta HASS.Agent como un reproductor multimedia de Home Assistant, para que HomePilot pueda importar y controlar la sesión multimedia local.

## Alcance

- Instalar y configurar la integración HASS.Agent compatible con la instancia local de Home Assistant.
- Ejecutar un broker MQTT local, accesible solo desde esta PC y la red interna de Docker.
- Descubrir la PC como entidad `media_player` a través de HASS.Agent.
- Importar la entidad existente a HomePilot para mostrar los metadatos y controles que Home Assistant publique: encendido/apagado, reproducción, pausa, pista anterior/siguiente y volumen.

## Fuera de alcance

- Buscar, seleccionar o reproducir una canción específica en YouTube.
- Automatizar el navegador, capturar su pantalla o crear una extensión de navegador.
- Añadir comandos de apagado, reinicio o suspensión de Windows.

## Criterios de aceptación

1. Home Assistant descubre la PC de HASS.Agent como un reproductor multimedia disponible.
1.1. El broker MQTT no se expone a la red LAN; HASS.Agent se conecta mediante `localhost` y Home Assistant mediante la red interna de Docker.
2. Con una sesión de YouTube activa en Edge, Home Assistant recibe el estado y los metadatos que HASS.Agent exponga.
3. Los controles multimedia publicados por la entidad se ejecutan desde Home Assistant.
4. La entidad puede importarse en HomePilot sin modificar contratos de API ni crear un store global.
5. Si HASS.Agent no publica portada, HomePilot conserva el fondo de reserva existente y no inventa una imagen.

## Encendido remoto por Wake-on-LAN

En la instalación de producción, HomePilot y Home Assistant se ejecutarán en una mini-PC independiente que permanecerá encendida. Esa mini-PC enviará Wake-on-LAN a las computadoras objetivo mediante su MAC Ethernet.

- Cada computadora objetivo requiere una MAC Ethernet, una reserva DHCP o IP estable y Wake-on-LAN habilitado en BIOS/UEFI y en el controlador de red.
- Esta instalación de prueba usa la PC `OSCAR` con MAC `18:C0:4D:DA:41:C2` e IP `192.168.1.36`.
- No se promete encendido remoto cuando la mini-PC emisora y la computadora objetivo son el mismo equipo.

Criterios adicionales:

6. Home Assistant expone `switch.encender_pc_oscar` y envía un paquete Wake-on-LAN a la MAC de la PC objetivo.
7. La integración no expone servicios a Internet; el paquete se envía solo dentro de la LAN.
