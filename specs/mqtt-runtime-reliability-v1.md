# Spec: MQTT Runtime Reliability V1

**Estado:** Aprobado  
**Seguimiento:** GitHub Issue #2

## Objetivo

Mantener disponible el broker MQTT local de HomePilot tras arranques, actualizaciones y recreaciones de Docker Compose, tanto en Docker Desktop/Windows como en Linux, y proporcionar una detección y recuperación no destructiva cuando no esté disponible.

## Contexto

En OSCAR, Docker Desktop dejó `homepilot-mqtt` detenido antes de iniciar por un conflicto de montaje archivo/directorio sobre `mosquitto.conf`. HASS.Agent conservó su configuración local `localhost:1883`, pero quedó en estado `conectando`; Home Assistant retuvo entidades descubiertas como obsoletas.

La configuración local de desarrollo usa MQTT anónimo limitado a `127.0.0.1`. Los despliegues de agentes remotos usan el overlay seguro existente y credenciales/ACL específicas. Esta iniciativa no mezcla ambos modelos ni expone el broker local a la red.

## Alcance

- Usar un montaje de directorio de configuración MQTT que sea estable en Docker Desktop y Linux.
- Declarar salud real del broker y ordenar el inicio de Home Assistant después de MQTT.
- Verificar de forma automatizada la configuración estática y la conectividad TCP de una instancia local ya iniciada.
- Documentar diagnóstico y recuperación de un solo servicio que no elimine datos, volúmenes, Home Assistant ni HASS.Agent.
- Mantener la seguridad: el perfil local seguirá limitado a loopback; los agentes LAN deberán usar el perfil seguro y credenciales por dispositivo existentes.

## Fuera de alcance

- Cambiar credenciales, tokens o la configuración de HASS.Agent.
- Exponer MQTT a Internet o convertir el perfil anónimo local en un perfil de cliente.
- Eliminar entidades antiguas de Home Assistant automáticamente.
- Cambiar bases de datos, sesiones o automatizaciones.

## Criterios de aceptación

1. El perfil base monta `./mosquitto/config` como directorio de solo lectura y no monta `mosquitto.conf` como archivo individual.
2. `homepilot-mqtt` declara healthcheck que verifica una suscripción local al broker sin revelar ni requerir secretos.
3. Home Assistant espera un broker saludable en un arranque limpio de Compose.
4. `npm run check:docker-profiles` falla si se pierde cualquiera de estas garantías.
5. `npm run verify:mqtt-runtime -- --desktop` comprueba que el contenedor está saludable y que `127.0.0.1:1883` acepta TCP; el modo Linux usa el Compose base.
6. La guía de soporte identifica el síntoma HASS.Agent `conectando`, conserva la configuración existente y da un comando de recuperación no destructivo.
7. La recuperación del incidente de OSCAR deja MQTT saludable y HASS.Agent puede reconectar sin reconfigurar sus credenciales.

## Seguridad y reversión

- No se modifican secretos ni volúmenes de credenciales.
- El broker local continúa enlazado exclusivamente a `127.0.0.1`.
- Para revertir el cambio de código se restaura la revisión anterior y se recrea solamente `homepilot-mqtt`; nunca se usan `down -v` ni borrado de `ha-config`, `data/` o `homepilot-mqtt-credentials`.
