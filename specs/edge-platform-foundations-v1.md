# SPEC: Edge Platform Foundations V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17

## 1. Declaración del Problema

El Edge local requiere contratos de API, eventos, persistencia y runtime comunes para que los bounded contexts operen de forma modular y segura.

## 2. Alcance

- Fastify gateway, contrato `RouteHandler`, servidor de consola y WebSocket local.
- Utilidades compartidas de HTTP, eventos, tiempo, configuración y SQLite.
- Reglas de persistencia, backup y migraciones locales.

## 3. Fuera de Alcance

- Cloud, multi-tenant remoto o eventos distribuidos obligatorios.

## 4. Requisitos Funcionales

- **REQ-01:** Las rutas de dominio se implementan en handlers, no en `ApiGateway`.
- **REQ-02:** Persistencia y migraciones mantienen compatibilidad y configuración explícita de journal SQLite.
- **REQ-03:** Eventos y errores comunes se expresan mediante contratos compartidos.
- **REQ-04:** Un administrador puede consultar y crear copias manuales de la base local desde Diagnósticos. La interfaz muestra únicamente metadatos operativos (nombre, fecha y tamaño); nunca expone rutas internas ni permite restauraciones automáticas.
- **REQ-04a:** La copia manual de SQLite debe usar el mecanismo de backup en línea de SQLite, incluir transacciones confirmadas en WAL y producir un archivo independiente que supere `PRAGMA integrity_check`. Tras cerrar la verificación, debe retirar los sidecars `.partial-wal` y `.partial-shm` antes de consolidar el `.db`; ante error debe intentar retirar los tres artefactos temporales y comunicar explícitamente cualquier fallo de limpieza. Un fallo no debe dejar una copia parcial visible como válida. La restauración se verifica en una base de prueba aislada; no se incorpora restauración automática al producto.

## 5. Requisitos No Funcionales

- **NFR-01:** El Edge funciona sin Cloud.
- **NFR-02:** La API no expone secretos de configuración.
- **NFR-03:** Las migraciones y backups son verificables localmente.
- **NFR-04:** La gestión de copias conserva los datos visibles durante una actualización, comunica progreso y error de forma accesible, y no crea operaciones duplicadas mientras una copia está en curso.

## 6. Criterios de Aceptación

- [x] AC1: Cada ruta de dominio se resuelve por un `RouteHandler`.
- [x] AC2: La base SQLite aplica migraciones y journal mode configurado al iniciar.
- [x] AC3: El runtime puede levantar API y consola mediante Compose.
- [x] AC4: El bus de eventos en memoria entrega eventos a los suscriptores, aísla fallos de un suscriptor y no añade ruido de diagnóstico durante pruebas automatizadas.
- [x] AC5: Diagnósticos permite a un administrador crear una copia local y revisar las copias disponibles mediante los endpoints protegidos existentes, sin revelar paths del host.
- [x] AC6: Una ruta que envía un archivo como cuerpo de la respuesta lo hace mediante `streamFileToResponse`, que atiende el evento `error` del stream: un archivo que desaparece entre la comprobación de existencia y la apertura destruye esa respuesta y registra el motivo, pero no termina el proceso. `.pipe()` no propaga errores y un `ReadStream` sin oyente de `error` lanza, de modo que sin esto ver una cámara podía apagar el Edge completo —ffmpeg borra segmentos HLS de forma continua por diseño—. Al cerrarse la respuesta el stream se cierra también, sin dejar descriptores abiertos.
- [x] AC7: El proceso registra con su causa toda excepción o promesa rechazada que nadie atienda, y termina con código distinto de cero para que el runtime lo reinicie. No se silencian: el estado del proceso ya no es fiable, pero deja de desaparecer sin diagnóstico.

## 7. Notas Técnicas y Arquitectura

- Código: `apps/api/ApiGateway.ts`, `RouteHandler.ts`, `OperatorConsoleServer.ts`, `streamFileToResponse.ts`, `main.ts`, `packages/shared`.
- La arquitectura detallada se mantiene en `docs/architecture.md`.

## 8. Preguntas Abiertas y TODOs

- TODO: Definir estrategia definitiva para Event Bus persistente local.
