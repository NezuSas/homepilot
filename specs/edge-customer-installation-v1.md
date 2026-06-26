# SPEC: Instalacion de HomePilot Edge con Home Assistant existente V1

**Estado:** Implementado
**Autor:** Codex
**Fecha:** 2026-06-26

## 1. Declaracion del Problema

Una miniPC de cliente puede contener un Home Assistant operativo, servicios Docker de terceros y espacio limitado. El despliegue de HomePilot debe poder prepararse de forma repetible sin crear otro Home Assistant, sin borrar datos ajenos y con visibilidad clara de puertos, disco y configuracion requerida.

## 2. Alcance

- Compose de cliente que despliega solamente API, UI, Ollama, STT y TTS de HomePilot.
- Script de preparacion que inspecciona requisitos, disco, Docker, puertos y Home Assistant existente.
- Limpieza segura y opcional de cache de build e imagenes Docker colgantes.
- Plantilla de variables de entorno completa para una instalacion de cliente.
- Documentacion de ejecucion, acceso LAN y acceso por tunel Cloudflare SSH.
- Salida de consola con identidad visual Nezu/HomePilot, secciones y estados legibles.
- Modo de estado operativo no destructivo para diagnosticar servicios y endpoints de la instalacion.

## 3. Fuera de Alcance

- Crear, actualizar, detener o borrar Home Assistant del cliente.
- Borrar contenedores, volumenes, bases de datos o imagenes Docker en uso.
- Configurar red, Cloudflare, DNS o credenciales de Home Assistant automaticamente.

## 4. Requisitos Funcionales

- **REQ-01:** El compose de cliente no debe declarar un servicio `homeassistant`.
- **REQ-02:** El script debe mostrar espacio de disco disponible y uso de Docker antes de cualquier limpieza.
- **REQ-03:** El script debe detectar un endpoint Home Assistant en `127.0.0.1:8123` y/o un contenedor llamado `homeassistant` sin modificarlo.
- **REQ-04:** La limpieza solo debe ejecutarse por confirmacion explicita o con `--clean`; debe limitarse a `docker builder prune` e `docker image prune`.
- **REQ-05:** Si falta `.env`, el script debe crearla desde una plantilla de cliente sin sobrescribir una existente.
- **REQ-06:** El script debe validar el compose, crear directorios persistentes requeridos y opcionalmente iniciar HomePilot con `--start`.
- **REQ-07:** El script debe presentar una cabecera profesional `NEZU / HOMEPILOT EDGE` y estados visuales, sin codigos ANSI cuando la salida no sea una terminal interactiva.
- **REQ-08:** El script debe ofrecer `--status` para verificar contenedores, healthchecks y endpoints sin crear archivos, limpiar ni iniciar servicios.

## 5. Requisitos No Funcionales

- **NFR-01:** El script debe ser idempotente y ejecutable en Ubuntu mediante Bash.
- **NFR-02:** No debe imprimir tokens ni secretos.
- **NFR-03:** Debe terminar con un resumen accionable de la configuracion, puertos y siguiente comando.

## 6. Criterios de Aceptacion

- [x] AC1: `docker-compose.office.yml` no incluye Home Assistant.
- [x] AC2: `bash scripts/install-edge-office.sh --help` documenta limpieza, arranque y URL publica de API.
- [x] AC3: Sin `.env`, el script crea una copia de `.env.office.example`; con `.env`, la conserva.
- [x] AC4: Sin `--clean`, el script solicita confirmacion antes de limpiar; con `--clean --yes`, ejecuta solo la limpieza permitida.
- [x] AC5: El script falla antes de arrancar cuando Docker, Compose o el compose de cliente no estan disponibles.
- [x] AC6: El script muestra la cabecera de Nezu/HomePilot y conserva salida legible si se redirige a un archivo.
- [x] AC7: `--status` indica el estado de API, UI, Ollama, STT, TTS y Home Assistant; devuelve un codigo distinto de cero si algun componente esperado no esta sano.

## 7. Notas Tecnicas y Arquitectura

`homepilot-api` se conecta al bridge existente mediante `INTERNAL_HA_URL`. Para Home Assistant expuesto por el host de la miniPC se usa `http://host.docker.internal:8123` y el compose agrega `host-gateway`. La URL del navegador se compila en la UI mediante `VITE_API_URL`; por ello el instalador la recibe como parametro explicito y nunca intenta inferir la red del navegador.
