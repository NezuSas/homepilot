# Tareas — Conector Edge para HomePilot Cloud de dominio único V1

**Base:** `specs/cloud-gateway-edge-connector-v1.md`  
**Issue:** NezuSas/homepilot#7.

## 1. Dominio y seguridad

- [ ] Definir contrato versionado de mensajes relay y allowlist de operaciones.
- [ ] Modelar identidad local de Edge, pairing, rotación y deduplicación de `requestId`.
- [ ] Definir principal gateway de mínimo privilegio sin mezclar sesiones locales.

## 2. Red e integración local

- [ ] Implementar cliente saliente WSS con heartbeats, reconnect y backpressure.
- [ ] Crear adaptador de relay a casos de uso locales permitidos.
- [ ] Exponer diagnóstico de conectividad sin revelar hostnames, secretos o payloads.

## 3. Calidad

- [ ] Pruebas TDD de firma, identidad, replay, timeout, reconexión y hogar cruzado.
- [ ] Pruebas de regresión para API local, Home Assistant, MQTT y control de dispositivos.
- [ ] Ejecutar matriz de calidad, build Docker y prueba integrada autorizada antes de QA.
