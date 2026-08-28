# Tasks — MQTT Runtime Reliability V1

- [x] Registrar el incidente y el alcance en una Issue real de GitHub. Evidencia: `NezuSas/homepilot#2`. [id: 1.1]
- [x] Definir contrato de fiabilidad, seguridad y reversión. Evidencia: `specs/mqtt-runtime-reliability-v1.md`. [id: 1.2]
- [x] Sustituir el montaje de archivo por un montaje de directorio estable y declarar healthcheck MQTT. Evidencia: `docker-compose.yml`. [id: 2.1]
- [x] Hacer que Home Assistant espere un broker MQTT saludable en arranque limpio. Evidencia: `docker-compose.yml`. [id: 2.2]
- [x] Añadir verificaciones estática y de runtime sin secretos. Evidencia: `scripts/check-docker-profiles.mjs`, `scripts/verify-mqtt-runtime.mjs`, `package.json`. [id: 3.1]
- [x] Documentar diagnóstico y recuperación segura para soporte Windows y Linux. Evidencia: `docs/pc-integration-deployment-guide.md`. [id: 4.1]
- [x] Recuperar OSCAR y ejecutar regresiones de Docker/configuración. Evidencia: Docker Desktop: `homepilot-mqtt` saludable y `127.0.0.1:1883` accesible. [id: 5.1]
- [ ] Ejecutar la verificación de runtime en la miniPC Linux antes de publicar. Evidencia: `npm run verify:mqtt-runtime` y estado saludable de `homepilot-mqtt`. [id: 5.2]
