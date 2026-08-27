# Instalador de computadoras Wake-on-LAN v1

## Objetivo

Permitir que un técnico configure desde terminal las computadoras que una mini-PC HomePilot siempre encendida podrá encender dentro de la LAN.

## Alcance

- Proveer `scripts/configure-wol-devices.sh` con un menú interactivo para registrar, listar y eliminar computadoras objetivo.
- Solicitar por cada equipo su nombre, sistema operativo, MAC Ethernet, IP reservada o estable y dirección broadcast.
- Mostrar comandos concretos para localizar la MAC en Windows y Linux.
- Mantener un registro local de dispositivos y regenerar un archivo YAML incluido por Home Assistant.
- Configurar Home Assistant para cargar solo el archivo administrado por el instalador.

## Fuera de alcance

- Instalar HASS.Agent, MQTT o software remoto en las computadoras objetivo.
- Encender una PC cuando HomePilot y la PC objetivo son la misma máquina.
- Modificar BIOS/UEFI, controladores de red o el router automáticamente.

## Criterios de aceptación

1. El menú permite agregar uno o más equipos en una sola ejecución.
2. Windows y Linux muestran instrucciones diferenciadas para localizar la MAC Ethernet y habilitar Wake-on-LAN.
3. Una MAC, IP o broadcast inválidos no se guardan.
4. La lista persistente se transforma en interruptores `wake_on_lan` válidos para Home Assistant.
5. El menú permite eliminar un equipo sin editar YAML manualmente.
6. El script no instala ni expone MQTT; Wake-on-LAN permanece limitado a la LAN.
7. La configuración Home Assistant carga el archivo generado sin sobrescribir otros archivos de automatización.
## Aplicación de cambios

- El menú incluye una opción para validar la configuración y reiniciar exclusivamente Home Assistant cuando el técnico decida aplicar los equipos registrados.
- Si una instalación nueva no posee el enlace al YAML administrado y no tiene otros switch: configurados, el asistente crea dicho enlace. Si ya existe un bloque switch:, se detiene para evitar sobrescribirlo.
