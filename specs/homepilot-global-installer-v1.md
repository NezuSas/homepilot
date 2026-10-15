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
- [x] AC7: segunda ejecución preserva datos/configuración y ofrece opciones seguras sin reinstalar ni re-enrolar silenciosamente. El diagnóstico global conserva una única cabecera, resume módulos configurados, ofrece detalles técnicos solo por petición y verifica la API desde el contenedor, no desde el puerto 3000 del host.
- [x] AC8: tests con operaciones simuladas cubren perfiles, opciones, cloudflared, TPM, binding, idempotencia y secretos; pasan checks de spec/Compose, suites de instalación, typecheck y build.

## Validación local

### Extensión local: consola de administración unificada (AC9–AC11)

El requisito de Issue queda exceptuado por autorización del usuario para este ajuste local. El punto de entrada `homepilot-install.sh` conserva el wizard de instalación nueva y abre un menú persistente al detectar una instalación existente. La cabecera NEZU/HomePilot pertenece exclusivamente a la consola global. Los motores históricos de instalación y mantenimiento siguen disponibles sin logos ni limpieza de terminal propios; reutilizan la paleta, separadores y mensajes de `homepilot-terminal-ui.sh`.

- **AC9:** Menú con diagnóstico, actualización, componentes, almacenamiento, consulta de backups/rollback, reparación y completar pendientes; opción volver/salir y reintento de selección inválida. `--status`, `--deploy`, `--clean`, `--gc-homepilot`, `--components`, `--storage`, `--recovery` y `--help` delegan en el mismo contrato. `--yes` solo aplica a deploy/clean/GC. Los motores existentes conservan confirmaciones; no se activa limpieza automática. Cada operación se ejecuta en un proceso Bash estricto independiente para que el menú pueda capturar errores sin desactivar `errexit` ni heredar secretos o decisiones mutables. Un fallo muestra código no cero, vuelve al menú y conserva ese resultado al salir si no se ejecuta posteriormente otra operación.
- **AC10:** Una sola cabecera, español, estados diferenciados y adaptación de texto/identificadores a terminales estrechas; logo compacto sin TTY o por debajo de 44 columnas. Logs no TTY mantienen mensajes completos, sin ANSI ni movimientos de terminal. Pasos numerados admiten total variable; la administración usa vistas sin numeración de instalación. INT/TERM restauran la terminal al salir. Servicio Cloudflare activo no se presenta como conexión verificada; configuración Directory persistida no acredita conectividad. Consulta de backups/rollback no crea ni restaura backups ni elimina etiquetas pendientes: no se ofrece una recuperación automática no implementada.
- **AC11:** La consulta de identidad es exclusivamente `readonly`/`query_only`, compartida con el preflight, sin bootstrap ni enrollment; no cambia el proceso explícito de vinculación. Wake-on-LAN `--help`/`--list` no escribe configuración/registro. MQTT resuelve la raíz del checkout. El mantenimiento verifica Home Assistant administrado en `ha_companion`, preservando la topología. La ayuda técnica deja de anunciar argumentos de pairing no admitidos.

Tests: `__tests__/homepilot-admin-console.test.ts`, `__tests__/homepilot-global-installer.test.ts` y `__tests__/homepilot-runtime-preservation.test.ts`. La aprobación operacional requiere validación posterior en terminal/SSH y MiniPC reales. Esta extensión no cambia Modbus, bindings, contratos API ni formato persistido; no implementa nuevas políticas de borrado, backup o restauración.

Jest: 287 suites y 2843 pruebas superadas (14 del wizard). Sintaxis Bash, `check:spec-coverage`, `check:bdd-traceability`, `check:module-test-coverage`, `check:docker-profiles`, `check:no-production-any`, `check:architecture-boundaries`, `check:tuya-policy`, `typecheck` y `build` superados. Compose se comprobó de forma declarativa; no se ejecutó ningún despliegue.

### Endurecimiento del instalador en MiniPC nueva (AC14–AC17)

Ampliación acotada por revisión del instalador (2026-10-15). No cambia contratos de API, perfiles, Compose, persistencia ni la política de TPM obligatorio.

- **AC14:** el sistema base (Ubuntu, arquitectura, espacio, red) y el dispositivo TPM se validan **antes** de pedir datos al técnico. El preflight de red comprueba, además de Docker, el registry de imágenes y el de paquetes npm como requisitos; los repositorios opcionales (Cloudflare, PyPI) producen solo una advertencia.
- **AC15:** `.env` queda siempre con permisos `600`, no solo cuando se habilita Android Display.
- **AC16:** si `HOMEPILOT_INTEGRATION_API_KEY` está vacía y la ejecución no es de solo estado, el instalador genera una clave aleatoria (`openssl rand -hex 32`) sin imprimirla; nunca reemplaza una clave existente. Sin esa clave las rutas M2M (discovery, state-sync, gateways MQTT) rechazan toda petición.
- **AC17:** si Cloudflare, pairing o binding TPM fallan después del despliegue, el instalador indica que HomePilot quedó desplegado y cómo completar los pasos pendientes (opción «Completar configuración pendiente» del menú), conservando el código de salida distinto de cero. Con acceso remoto configurado y `DIRECTORY_SSO_PUBLIC_KEY` vacía, el resumen final lo señala como pendiente; el instalador **no** descarga la llave automáticamente (evita una conexión externa no autorizada y un PEM multilínea en `.env`). El login local sigue funcionando.

Quedan fuera de esta ampliación, por ser decisiones de producto: sustituir el TPM obligatorio por un fallback, y distribuir imágenes ya construidas en lugar de construirlas en cada MiniPC.

## Validación pendiente fuera de CI

### Preparación completa de dependencias del host (AC12)

- AC12: el instalador Ubuntu instala únicamente paquetes faltantes: certificados, curl, jq, SSH cliente/servidor, Git, Python 3, OpenSSL, iproute2 y utilidades Unix utilizadas por los motores. Comprueba ejecutables, módulos estándar de Python y OpenSSL antes de iniciar Docker/desplegar. No instala npm/Python de aplicación en el host: los Dockerfiles y lockfiles/requirements siguen siendo la fuente de sus dependencias.
- El CIDR Android se valida al recoger datos si Python existe; de lo contrario se informa la validación pendiente y se verifica después de preparar Python, antes de Docker, credenciales MQTT y despliegue. No se instalan paquetes antes de la confirmación general.
- Entradas técnicas y diagnósticos resuelven la raíz del checkout. Argumentos incompletos de readiness/MQTT fallan con mensaje explícito; alta MQTT no exige un TTY inexistente.
- La cobertura de sintaxis incluye todos los scripts Bash de `scripts/` y `scripts/lib/`. Las pruebas de paquetes usan mocks: no acreditan una instalación real, acceso a repositorios ni salud del hardware.
- Linux Agent remoto requiere playerctl/pactl en el PC objetivo, no en la MiniPC. Playwright y Node/npm locales son requisitos de desarrollo/QA, no del appliance Docker. No se instalan herramientas de desarrollo ni agentes remotos automáticamente.

### Progreso operativo compacto (AC13)

- AC13: conservar paleta, cabecera y pasos existentes; instalación de paquetes y build/inicio Compose no interactivos muestran indicador ámbar con tiempo transcurrido en TTY. El indicador expresa actividad, nunca un porcentaje inventado. Completar un comando no equivale a certificar salud: los checks existentes siguen ejecutándose.
- `--verbose` en la consola principal o la opción 8 del menú conserva salida técnica. Sin TTY se mantiene la salida completa y sin animación/ANSI. No se capturan ni ejecutan en background prompts, credenciales, pairing o enrollment.
- La operación sigue en foreground con los mismos argumentos, variables de entorno y código de salida. Solo la animación es background; se detiene al finalizar y al cerrar/interrumpir la consola. Los motores conservan reintentos y rollback existentes.
- No se guardan logs crudos: pueden contener URLs privadas o valores de entorno. El modo resumido muestra etapa y código de error e indica cómo habilitar diagnóstico; no muestra colas de salida sin sanitización. El modo técnico conserva el flujo anterior y no se comparte sin revisión.
- Pruebas simuladas cubren éxito/error, código, limpieza de indicador, TTY/no TTY, terminal estrecha, selección de detalle y CLI. Validación visual en SSH real pendiente.

La primera MiniPC requiere prueba operacional real de TPM, Docker, cloudflared, Directory y salud de hardware/red. Esta spec no autoriza ejecutar deploy en la máquina de desarrollo.
