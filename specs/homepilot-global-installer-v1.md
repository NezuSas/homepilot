# HomePilot Global Installer v1

**Estado:** Aprobado

## Objetivo y alcance

`sudo bash scripts/homepilot-install.sh` es el único punto de entrada oficial para preparar una MiniPC Ubuntu HomePilot nueva. El asistente recoge decisiones del cliente, presenta un único resumen y confirmación antes de cambiar el sistema, y delega el despliegue existente en `install-edge-office.sh` y sus librerías. Los comandos históricos siguen disponibles para mantenimiento/compatibilidad. No crea túneles Cloudflare, cambia Directory/IntentFlow, instala releases privadas, administra routers ni realiza rebinding TPM.

## Arquitectura

- Capa de interacción: wizard TTY con salida limpia sin TTY, pasos numerados y secretos por entrada oculta; un adaptador de operaciones permite pruebas sin ejecutar apt, Docker, systemctl, TPM o red reales.
- Capa de sistema: comprueba Linux/Ubuntu, x86_64, sudo, red, espacio, paquetes base y Docker Engine/Compose Plugin; reutiliza instalaciones correctas.
- Capa HomePilot: selecciona `bridge_ha`, `ha_companion` o `native_only`, Compose base más overlays TPM/cámara/Android/MQTT/voz según opciones; delega preparación, build, HACS/SonoffLAN y salud al instalador existente. Cámaras nativas no dependen de Home Assistant.
- Capa de seguridad: TPM 2.0 obligatorio y funcional antes de una instalación nueva; vinculación Directory por el flujo existente de claim, seguida de enrollment explícito una sola vez cuando API, pairing y TPM dentro del contenedor están listos. Cloudflare Tunnel es independiente del pairing.
- Capas opcionales: Android Display usa `android-display-appliance.sh`; MQTT reutiliza Mosquitto seguro y el diagnóstico de contenedor del instalador. `verify:mqtt-runtime` sigue disponible para sus perfiles históricos, pero no se invoca desde el wizard porque asume TCP en loopback y el listener nuevo se vincula a una IP LAN específica. Voz puede quedar deshabilitada sin volver STT/TTS obligatorios para readiness.

## Persistencia e idempotencia

Las elecciones no secretas se guardan en la `.env` existente; no se sobrescriben en una segunda ejecución. Credenciales existentes, datos, cámara y configuración se preservan. El token de Tunnel no se guarda en `.env`, SQLite, logs ni resúmenes: solo se entrega a `cloudflared service install` por su mecanismo oficial. Una instalación existente ofrece diagnóstico, completar pendientes, reparar componentes seleccionados o cancelar; no ejecuta un despliegue nuevo silencioso. Nunca se ejecuta prune global ni `--remove-orphans`.

## Flujo de instalación nueva

1. Información: cliente, instalación y hostname Linux validado; cambiar hostname exige confirmación específica.
2. Sistema base: validar requisitos y preparar dependencias/Docker si faltan.
3. TPM: verificar `/dev/tpmrm0`, versión 2.0, `tpm2_getcap` y `tpm2_getrandom`; fallar cerrado si no funciona; activar `docker-compose.tpm.yml`.
4. Arquitectura: Home Assistant existente/administrado/ninguno, cámaras nativas, Android Display, MQTT, voz y acceso remoto NEZU. HACS/SonoffLAN conservan las condiciones del instalador histórico; nunca se piden credenciales eWeLink.
5. Mostrar Compose elegido y opciones; solicitar una única confirmación general.
6. Preparar/desplegar HomePilot con la lógica existente y verificar API/UI/servicios habilitados.
7. Si se eligió acceso remoto, instalar/reutilizar cloudflared con token oculto y comprobar servicio activo; NEZU crea manualmente Tunnel/Access/DNS.
8. Emparejar Edge con Directory mediante `claim-cloud-pairing.mjs` y código temporal si aún no está emparejado. El Tunnel Token no es credencial Edge.
9. Si aún no está bound, comprobar handle TPM libre, ejecutar `dist/scripts/enroll-edge-device.js` en el runtime, comprobar handle/binding y reiniciar/verificar API; si ya está bound, no enrolar de nuevo.
10. Mostrar resultado sin secretos y dirección LAN del frontend para crear el primer administrador y continuar onboarding.

## Salud y capacidades

Los checks de STT/TTS, cámara, Android, MQTT y HA son condicionales a las opciones elegidas. Sin cámara no se ejecuta probe VAAPI; con cámara se usa `camera-acceleration.sh` y fallback libx264. Sin Android no se activan bridge ni adb; con Android se pide CIDR cuando corresponda. SSH permanece solo para acceso local; el instalador no abre puertos públicos ni modifica firewall/router agresivamente.

## Seguridad y límites

Producción requiere TPM real, nunca `SoftwareDeviceIdentityProvider`. El instalador no almacena ni imprime tokens, contraseñas, private keys o credenciales Edge. No re-enrola una instalación bound. `cloudflared` se instala como servicio de inicio automático y recuperación de fallos; su token se maneja exclusivamente durante la instalación. El contrato `claim-cloud-pairing.mjs` se conserva, incluida la necesidad de `edgeHostname` si aplica.

## Criterios de aceptación

- [x] AC1: un único comando abre un wizard legible con TTY y sin códigos ANSI en salida no TTY; cliente/instalación/hostname validados y confirmación previa.
- [x] AC2: detección y preparación base reutilizan paquetes y Docker existentes; nunca ejecutan limpieza global ni tocan otros proyectos.
- [x] AC3: las tres respuestas Home Assistant mapean a los perfiles históricos; cámaras son nativas e independientes; Android, MQTT y voz son realmente opcionales.
- [x] AC4: nueva instalación sin TPM 2.0 funcional falla; con TPM habilita overlay y enrollment explícito exactamente una vez tras salud y pairing.
- [x] AC5: Cloudflare usa solo Tunnel Token oculto para servicio cloudflared; Directory usa exclusivamente su pairing actual; ninguno imprime ni persiste secretos indebidamente.
- [x] AC6: Compose y salud se ajustan a las capacidades seleccionadas; STT/TTS no son obligatorios cuando voz está deshabilitada.
- [x] AC7: segunda ejecución preserva datos/configuración y ofrece opciones seguras sin reinstalar ni re-enrolar silenciosamente.
- [x] AC8: tests con operaciones simuladas cubren perfiles, opciones, cloudflared, TPM, binding, idempotencia y secretos; pasan checks de spec/Compose, suites de instalación, typecheck y build.

## Validación local

Jest: 287 suites y 2843 pruebas superadas (14 del wizard). Sintaxis Bash, `check:spec-coverage`, `check:bdd-traceability`, `check:module-test-coverage`, `check:docker-profiles`, `check:no-production-any`, `check:architecture-boundaries`, `check:tuya-policy`, `typecheck` y `build` superados. Compose se comprobó de forma declarativa; no se ejecutó ningún despliegue.

## Validación pendiente fuera de CI

La primera MiniPC requiere prueba operacional real de TPM, Docker, cloudflared, Directory y salud de hardware/red. Esta spec no autoriza ejecutar deploy en la máquina de desarrollo.
