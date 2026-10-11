# SPEC: Opción del instalador «Conversar con mi casa» V1

**Estado:** Implementado
**Fecha:** 2026-10-11

## Problema

El técnico que instala HomePilot decide qué capacidades opcionales lleva cada cliente (cámaras, pantalla Android, MQTT, voz, acceso remoto), pero el chat con el asistente («Conversar con mi casa») siempre estaba presente. Un cliente que no lo quiere no podía instalarlo sin él, y la voz local (STT y TTS) se ofrecía aunque no hubiera con quién hablar.

## Alcance

- Una pregunta nueva en el instalador global: ¿habilitar «Conversar con mi casa»? Por defecto sí.
- La voz local solo se pregunta cuando el chat está habilitado; sin chat no se instalan STT ni TTS.
- La elección se guarda en `.env`, se conserva al reanudar o mantener la instalación y la respetan la API y la consola.
- Sin cambios en el resto del asistente (sugerencias, acciones, hallazgos), en los contratos existentes ni en las instalaciones ya hechas, que siguen con el chat habilitado.

## Requisitos

- **REQ-01:** El instalador global pregunta «¿Habilitar «Conversar con mi casa»?» entre las capacidades opcionales, con sí por defecto, y muestra la elección en el resumen, al finalizar y en el diagnóstico.
- **REQ-02:** Con el chat deshabilitado el instalador no pregunta por la voz, la fija en no y no despliega STT ni TTS. Con el chat habilitado pregunta por la voz como hasta ahora.
- **REQ-03:** La elección se guarda como `HOMEPILOT_HOME_CHAT_ENABLED` (`true` o `false`), se valida al reanudar un despliegue guardado y al mantener una instalación, aparece en el menú de componentes y llega a la API como variable de entorno de Compose. Un valor ausente equivale a `true`.
- **REQ-04:** Con el chat deshabilitado la API responde 403 `FEATURE_DISABLED` a `POST /assistant/converse`, `/assistant/tts` y `/assistant/stt` sin invocar ningún servicio; el resto de rutas del asistente no cambia.
- **REQ-05:** `GET /api/v1/system/features` devuelve `{ homeChat }` a cualquier usuario autenticado y no responde sin sesión.
- **REQ-06:** Con el chat deshabilitado la consola oculta la entrada del menú, redirige la ruta de conversación al tablero, apaga la escucha de la palabra de activación y omite el paso de conversación de la guía de demostración. Mientras la instalación no responde, o si falla la lectura, se asume habilitado para que nada desaparezca por error.

## Criterios de aceptación

- [x] **AC1:** El asistente del instalador con respuestas por defecto despliega con chat y voz habilitados; con el chat en no, despliega con ambos en `false`, sin la pregunta de voz.
- [x] **AC2:** El instalador histórico recibe `HOMEPILOT_INSTALL_CHAT_ENABLED` y guarda `HOMEPILOT_HOME_CHAT_ENABLED` en `.env`; mantenimiento y menú de componentes lo leen y validan.
- [x] **AC3:** `AssistantRoutes.home-chat.test.ts` cubre el 403 en las tres rutas, el funcionamiento con el chat habilitado, el endpoint de opciones y su protección por sesión.
- [x] **AC4:** `installedFeatures.test.ts` y `appDemoSteps.test.ts` cubren la vista oculta, la escucha global y la guía de demostración.
- [x] **AC5:** Los scripts del instalador pasan `bash -n` y sus pruebas.

## Evidencia

- `scripts/lib/homepilot-global-installer.sh`, `scripts/install-edge-office.sh`, `scripts/homepilot-maintenance.sh` y `scripts/lib/homepilot-admin-menu.sh`.
- `docker-compose.yml` y `docker-compose.office.yml` (variable del API), `packages/shared/config/getInstallationProfile.ts`, `apps/api/routes/AssistantRoutes.ts` y `SystemRoutes.ts`.
- `apps/operator-console/src/lib/installedFeatures.ts`, `useInstalledFeatures.ts` y `App.tsx`.
- Documentación: `docs/homepilot-technical-guide.md`.
