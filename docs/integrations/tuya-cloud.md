# Integración directa Tuya Cloud

## Objetivo

Este módulo conecta cortinas Tuya directamente con HomePilot. No utiliza Home Assistant como puente: HomePilot conserva una representación local del dispositivo, la importa a su inventario y puede asignarla a una estancia igual que cualquier otro dispositivo.

## Requisitos del proyecto Tuya

1. Crear un proyecto Cloud en [Tuya IoT Platform](https://iot.tuya.com/).
2. Activar las API necesarias para consultar dispositivos y enviar comandos.
3. Vincular y autorizar la cuenta Tuya que contiene las cortinas.
4. Copiar el endpoint regional, el Client ID, el Client Secret y el UID de la cuenta autorizada.

Los endpoints regionales más comunes son `https://openapi.tuyaus.com`, `https://openapi.tuyaeu.com`, `https://openapi.tuyacn.com` e `https://openapi.tuyain.com`. Debe usarse el que corresponde al proyecto creado en Tuya.

## Flujo en HomePilot

1. Un administrador abre **Sistema > Tuya Smart**.
2. Registra las credenciales y prueba la conexión.
3. HomePilot lista únicamente dispositivos compatibles con cortinas.
4. El administrador importa una cortina a un hogar.
5. La cortina aparece en Descubrimiento y se asigna a una estancia desde el flujo normal.

Una cortina ya importada no puede importarse otra vez al mismo hogar: HomePilot usa la clave externa `tuya:<deviceId>` para preservar la idempotencia.

## Seguridad y operación

- El Client Secret no se devuelve a la interfaz y dejar su campo vacío conserva el valor existente.
- Las credenciales se usan solo desde HomePilot para firmar solicitudes al API oficial de Tuya Cloud.
- Una instalación sin Tuya configurado continúa funcionando con Home Assistant, Sonoff y dispositivos locales sin cambios.
- Para retirar una cortina, se elimina únicamente la representación de HomePilot; el dispositivo físico y su cuenta Tuya no se modifican.