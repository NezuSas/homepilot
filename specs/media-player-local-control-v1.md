- [x] AC8: Consultas naturales de parlantes, sonido y reproducción resuelven solo reproductores `media_player` autorizados de HomePilot; por estancia, listan únicamente los asignados y comunican claramente cuando no hay ninguno importado. Evidencia: `assistant_media_player_control.test.ts`.
# SPEC: Media Player Local Control V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17  
**Código trazado:** `apps/api/routes/MediaPlayerRoutes.ts`, `apps/api/routes/MediaRoutes.ts`, `packages/devices`, `apps/operator-console/src/views/dashboards/widgets/MediaPlayerCard.tsx`

## 1. Declaración del Problema

Los reproductores importados deben operar como dispositivos locales de HomePilot y mostrar información de reproducción, controles disponibles y portada sin exponer directamente la autenticación de Home Assistant.

## 2. Alcance

- Importar reproductores como dispositivos HomePilot.
- Leer estado, título, artista, progreso, volumen y arte cuando estén disponibles.
- Ejecutar controles compatibles: encendido, reproducción/pausa, anterior, siguiente y volumen.
- Servir la portada mediante proxy autenticado de corta duración.

## 3. Fuera de Alcance

- Biblioteca musical, colas o proveedores de streaming propios.
- Almacenamiento permanente de carátulas remotas.
- Control de dispositivos no importados en HomePilot.

## 4. Requisitos Funcionales

- **REQ-01:** El reproductor se representa como dispositivo importado con capacidades explícitas.
- **REQ-02:** Una acción no disponible no se presenta como control interactivo.
- **REQ-03:** El proxy de artwork debe validar token, dispositivo y vencimiento antes de solicitar recursos remotos.
- **REQ-04:** Ante falta de imagen o error del proxy, la tarjeta conserva información y muestra fallback visual sin romper el layout.
- **REQ-05:** El estado actualizado se propaga a tablero y gestor de dispositivos, preservando los atributos multimedia disponibles de Home Assistant (título, artista, posición, duración, volumen y artwork).
- **REQ-06:** El asistente doméstico resuelve de forma determinista las consultas sobre reproducción, título, artista, estado y volumen de reproductores `media_player` autorizados.
- **REQ-07:** El asistente acepta volumen exacto entre 0 y 100, así como incrementos y reducciones porcentuales contra el volumen sincronizado localmente; no inventa valores cuando esa lectura no existe.
- **REQ-08:** Antes de controlar un reproductor, el asistente informa si está no disponible. Si está apagado y admite encendido, lo enciende antes de completar una orden compatible; ante fallo indica revisar alimentación y conexión.
- **REQ-09:** Tras informar exactamente un reproductor autorizado, el asistente conserva ese contexto para interpretar de forma determinista referencias inmediatas de encendido como ‘enciéndelo’ o ‘quiero usarlo’; sin un único contexto no ejecuta una orden implícita.
- **REQ-10:** El asistente reconoce variantes naturales de consulta, pausa, encendido y ajuste de volumen para reproductores importados, y puede filtrar por una estancia autorizada. Si la estancia no tiene reproductores importados, lo informa sin consultar entidades externas.

## 5. Requisitos No Funcionales

- **NFR-01:** No se filtran token ni URL privada de Home Assistant al navegador.
- **NFR-02:** El feedback de una acción es compacto y no aplica blur al tablero.
- **NFR-03:** Los controles, textos y estados están traducidos ES/EN.

## 6. Criterios de Aceptación

- [x] AC1: Un reproductor importado aparece como entidad seleccionable solo para tarjetas de media.
- [x] AC2: Reproducir, pausar, avanzar y cambiar volumen actualiza su estado visible sin descartar los atributos multimedia ya disponibles.
- [x] AC3: Una portada válida se muestra como fondo sin ocultar los controles.
- [x] AC4: Un fallo de artwork no afecta los demás datos ni genera error de UI.
- [x] AC8: Cuando Home Assistant informa posición y duración, la tarjeta muestra el tiempo transcurrido, duración y una barra de progreso; cuando no los informa, conserva el layout sin inventar datos.
- [x] AC9: Sin portada, la tarjeta muestra un campo de audio estático de grafito y cobre que conserva el contraste de controles y texto.
- [x] AC5: El asistente informa título, artista, estado y volumen de un reproductor autorizado sin invocar interpretación no determinista. Evidencia: `assistant_media_player_control.test.ts`.
- [x] AC6: El asistente fija y ajusta volumen porcentual mediante el contrato `volume_set`, preservando el rango 0–100. Evidencia: `assistant_media_player_control.test.ts`.
- [x] AC7: Un reproductor no disponible no recibe comandos; un reproductor apagado se enciende antes de un comando compatible y un fallo informa revisar conexión. Evidencia: `assistant_media_player_control.test.ts`.

## 7. Notas Técnicas y Arquitectura

- API: `/api/v1/media*` y rutas de `MediaPlayerRoutes`.
- La comunicación externa sigue el bridge configurado; la UI no consulta Home Assistant directamente.

## 8. Preguntas Abiertas y TODOs

- TODO: Definir cache local acotada de artwork con invalidación por entidad.
