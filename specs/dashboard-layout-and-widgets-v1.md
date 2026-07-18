# SPEC: Dashboard Layout and Widgets V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17  
**Código trazado:** `apps/api/routes/DashboardRoutes.ts`, `packages/topology`, `apps/operator-console/src/views/DashboardView.tsx`, `apps/operator-console/src/views/dashboards/`

## 1. Declaración del Problema

Los usuarios necesitan tableros personales, locales y configurables que agrupen controles, cámaras, métricas, habitaciones, escenas y reproductores sin exponer información de otros usuarios.

## 2. Alcance

- Gestionar dashboards, pestañas, secciones, orden y widgets por usuario.
- Configurar título, visibilidad, fondo, icono y disposición responsive.
- Renderizar widgets de dispositivo, cámara, escena, habitación, sensor, reloj y media player.
- Filtrar la navegación y acceso a vistas por usuario autorizado, independientemente de su rol.

## 3. Fuera de Alcance

- Sincronización de diseños con Home Assistant.
- Edición colaborativa simultánea.
- Dashboards Cloud o compartidos entre hogares.

## 4. Requisitos Funcionales

- **REQ-01:** Cada dashboard pertenece a un hogar y conserva una política explícita de visibilidad por usuario.
- **REQ-02:** Solo el propietario o administrador autorizado puede modificar su configuración, secciones y widgets.
- **REQ-03:** Cada widget solo puede asociarse a entidades compatibles con su tipo.
- **REQ-04:** Reordenar secciones o widgets debe persistir su orden sin superposición de placeholders.
- **REQ-05:** El fondo cubre el viewport visible del tablero sin alterar el scroll de contenido.
- **REQ-06:** Las tarjetas de control reflejan el estado real y ejecutan solo acciones soportadas por su entidad.

## 5. Requisitos No Funcionales

- **NFR-01:** El canvas debe responder correctamente en móvil, tablet y escritorio, conservando scroll vertical.
- **NFR-02:** El encabezado del tablero permanece accesible durante scroll normal y de edición.
- **NFR-03:** Ningún widget debe introducir cadenas visibles fuera de i18n ES/EN.
- **NFR-04:** Los iconos se resuelven a través del catálogo MDI cargado bajo demanda.

## 6. Criterios de Aceptación

- [x] AC1: Un usuario no ve ni accede por URL a un dashboard sin visibilidad asignada.
- [x] AC2: Crear, editar, mover y eliminar pestañas, secciones y widgets persiste al recargar.
- [x] AC3: El selector de entidad muestra solo tipos compatibles con la tarjeta elegida.
- [x] AC4: Los placeholders aparecen al final de la grilla disponible y no cubren tarjetas existentes.
- [x] AC5: Cámara, media, reloj, sensor y control mantienen una presentación válida en los tres breakpoints.

## 7. Notas Técnicas y Arquitectura

- API: `/api/v1/dashboards/*` mediante `DashboardRoutes`.
- Las estructuras de dashboard pertenecen al contexto de topología; los widgets no contienen reglas de negocio de dispositivos.
- `DashboardCanvas` y el catálogo de widgets son el único punto de montaje visual de tarjetas.

## 8. Preguntas Abiertas y TODOs

- TODO: Definir exportación/importación versionada de dashboards.
