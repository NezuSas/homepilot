# Tasks — HomePilot Global Installer v1

- [x] T17 (AC14–AC17): sistema/TPM antes de las preguntas, preflight de red ampliado, `.env` 600, clave M2M generada y ayuda de recuperación tras un fallo posterior al despliegue.
- [ ] T27 (AC36–AC42): paquete de entrega con imágenes ya construidas: constructor, modo precompilado en instalador y mantenimiento, pruebas y matriz desde el paquete en MiniPC real.
- [x] T25 (AC32–AC35): modo desatendido `--answers`, opción de solo túnel, Home Assistant con versión exacta y matriz de instalación guardada como herramienta del repo.
- [ ] T26 (AC32–AC35): ejecutar la matriz del repo completa en una MiniPC de pruebas tras cada cambio del instalador.
- [x] T24 (AC29–AC31): paquete de instalación reproducible con revisión y suma de verificación, y revisión de imágenes sin `.git`.
- [x] T23 (AC27–AC28): alineación en caracteres con locale UTF-8 forzado y pausa tras la detección en terminal interactivo.
- [x] T22 (AC25–AC26): configuración de proxy de confianza de Home Assistant administrado para operar detrás del túnel, idempotente y sin sobrescribir configuración existente.
- [x] T21 (AC22–AC24): detección informativa de componentes existentes, conflicto de fuentes apt de Docker y puertos ocupados antes de cambiar el sistema.
- [x] T19 (AC18–AC21): dependencia TTS fijada, Mosquitto con versión exacta y credenciales del broker, puerto de UI de `ha_companion` y chequeo en `check:docker-profiles`; matriz de nueve escenarios verificada en MiniPC real.
- [ ] T20 (AC14–AC17): probar acceso remoto (Cloudflare Tunnel, pairing y binding TPM) en hardware con un Directory vigente.
- [ ] T18 (AC14–AC17): validar T17 en una MiniPC Ubuntu real y limpia; no sustituir por mocks.

- [x] T15 (AC13): progreso modular ámbar y tiempo transcurrido en apt/build/inicio, modo técnico explícito, códigos de error y limpieza del indicador sin logs crudos ni porcentajes ficticios.
- [ ] T16 (AC13): comprobar animación, resize e interrupción en terminal SSH real; ejecutar regresión completa actualizada antes de publicar.

- [x] T13 (AC12): completar paquetes del host y comprobaciones previas, diferir CIDR hasta Python disponible, resolver raíz de motores/diagnósticos, validar argumentos MQTT/readiness y cubrir sintaxis de todos los Bash.
- [ ] T14 (AC12): validar instalación limpia Ubuntu y actualización de MiniPC existente en entorno autorizado; verificar repositorios externos, TPM y servicios reales. No sustituir esta validación por mocks.

- [x] T9 (AC9): consola persistente y aliases CLI; delegación en motores existentes, operaciones aisladas y códigos de error sin falsos éxitos.
- [x] T10 (AC10): cabecera única, presentación modular compartida, terminal estrecha/no TTY, selección validada y estados que distinguen servicio activo de conexión comprobada.
- [x] T11 (AC11): diagnóstico de identidad read-only compartido, consultas WOL sin efectos secundarios, raíz MQTT y verificación de HA administrado.
- [ ] T12 (AC9–AC11): ejecutar regresión completa del candidato y validar interacción/resize en terminal SSH real y operación autorizada en MiniPC. No se declara comprobado desde simulaciones.

- [x] T1: inventariar/reutilizar instalador histórico, Compose, checks, claim y enrollment (AC2–AC6).
- [x] T2: implementar wizard global con salida TTY/no TTY, validación y confirmación (AC1).
- [x] T3: validar sistema base, Docker y TPM con operaciones simulables (AC2, AC4).
- [x] T4: orquestar perfiles HA y overlays opcionales de cámaras, Android, MQTT y voz (AC3, AC6).
- [x] T5: instalar/verificar cloudflared sin divulgar token; integrar pairing Directory y enrollment TPM una vez (AC4, AC5).
- [x] T6: preservar instalación existente y mantener compatibilidad con install-edge-office/maintenance (AC7).
- [x] T7: cubrir el wizard con mocks y ejecutar la validación autorizada (AC8).
- [x] T8: evitar rangos de colación dependientes de locale en nombres de cliente/instalación; cubrir nombres ASCII y acentuados con `C.UTF-8`, manteniendo longitud máxima y rechazo de caracteres inseguros (AC1, AC8). La validación global del candidato permanece pendiente de ejecución por el usuario.
