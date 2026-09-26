# Entrega de HomePilot en una MiniPC de cliente

Este checklist es una condición de entrega, no una autorización de despliegue. Se ejecuta en la instalación del cliente solo con su aprobación y con credenciales protegidas. No usar `docker compose down -v` ni reemplazar `data/` o `ha-config/` durante una actualización.

## 1. Definir el perfil

- `bridge_ha`: el cliente ya tiene Home Assistant; HomePilot no lo administra.
- `native_only`: no se instala Home Assistant.
- `ha_companion`: HomePilot instala Home Assistant y MQTT junto con la aplicación.

Registrar el perfil y los puertos elegidos en `.env` local, nunca en el repositorio. En `ha_companion` Linux, la API en red del host llega a Home Assistant por `127.0.0.1:18123`; en Docker Desktop usa `homeassistant:8123`. Si una instalación antigua fijó `INTERNAL_HA_URL` manualmente, comprobarla antes de reiniciar.

## 2. Preparar el equipo y la red

- Confirmar arquitectura, sistema operativo, Docker Compose v2, espacio libre y memoria suficiente para los modelos STT/TTS elegidos. La construcción inicial descarga dependencias e imágenes de voz: verificar conectividad y preparar una copia local de las imágenes si el sitio no tendrá Internet.
- Limitar con el firewall del host el acceso a la API en el puerto 3000 y a la UI al segmento autorizado del cliente. La API usa red del host y escucha en todas las interfaces; no exponerla directamente a Internet. TTS y STT se publican solo en loopback. Revisar por separado el acceso a Home Assistant y al MQTT seguro si se usan.
- No reutilizar credenciales, tokens ni archivos de datos de otra vivienda. Comprobar permisos de `data/`, `backups/`, `ha-config/` y credenciales MQTT.

## 3. Validación antes de entregar

1. Validar el Compose efectivo con `docker compose -f <compose-base> config --quiet`; para el despliegue normal usar `bash scripts/homepilot-maintenance.sh --deploy` para incluir automáticamente el override de cámara compatible.
2. Verificar `bash scripts/homepilot-maintenance.sh --status`, la UI, autenticación, dispositivos del hogar, voz y reproducción HLS de cada cámara. Registrar si usa VAAPI o `libx264`.
3. Comprobar que los servicios regresan saludables tras un reinicio controlado y que la base, usuarios y automatizaciones persisten.
4. Crear una copia desde Diagnósticos y comprobar en un entorno aislado que se abre, pasa `PRAGMA integrity_check` y contiene datos recientes. La aplicación no ejecuta restauración automática. Documentar cómo volver al estado anterior antes de cualquier restauración real.
5. Confirmar que los logs no crecen indefinidamente, que el disco conserva margen y que la CPU/memoria se mantienen aceptables con las cámaras y modelos de voz del cliente.
6. Registrar versiones/digests de las imágenes efectivamente instaladas y conservar un artefacto de reversión. Las etiquetas base actuales son mutables; no reconstruir una entrega antigua suponiendo que recuperará exactamente las mismas capas.

La entrega no está completa hasta ejecutar estas comprobaciones en el hardware y la red del cliente. Una validación de `docker compose config` en desarrollo confirma sintaxis y composición, no comportamiento operativo del appliance.
