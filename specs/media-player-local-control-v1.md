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
- **REQ-05:** El estado actualizado se propaga a tablero y gestor de dispositivos.

## 5. Requisitos No Funcionales

- **NFR-01:** No se filtran token ni URL privada de Home Assistant al navegador.
- **NFR-02:** El feedback de una acción es compacto y no aplica blur al tablero.
- **NFR-03:** Los controles, textos y estados están traducidos ES/EN.

## 6. Criterios de Aceptación

- [x] AC1: Un reproductor importado aparece como entidad seleccionable solo para tarjetas de media.
- [x] AC2: Reproducir, pausar, avanzar y cambiar volumen actualiza su estado visible.
- [x] AC3: Una portada válida se muestra como fondo sin ocultar los controles.
- [x] AC4: Un fallo de artwork no afecta los demás datos ni genera error de UI.

## 7. Notas Técnicas y Arquitectura

- API: `/api/v1/media*` y rutas de `MediaPlayerRoutes`.
- La comunicación externa sigue el bridge configurado; la UI no consulta Home Assistant directamente.

## 8. Preguntas Abiertas y TODOs

- TODO: Definir cache local acotada de artwork con invalidación por entidad.
