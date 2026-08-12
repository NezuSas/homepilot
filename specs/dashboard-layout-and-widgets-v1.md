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
- **REQ-07:** Las variables de identidad del título se resuelven exclusivamente desde el contexto autenticado de HomePilot.
- **REQ-08:** El propietario puede exportar un tablero como un archivo versionado e importar una copia en su propia cuenta, sin sobrescribir tableros existentes.
- **REQ-09:** Cada actualización de tablero crea una revisión local recuperable por su propietario; la restauración debe crear otra revisión del estado actual antes de aplicar la elegida.

## 5. Requisitos No Funcionales

- **NFR-01:** El canvas debe responder correctamente en móvil, tablet y escritorio, conservando scroll vertical.
- **NFR-02:** El encabezado del tablero permanece accesible durante scroll normal y de edición.
- **NFR-03:** Ningún widget debe introducir cadenas visibles fuera de i18n ES/EN.
- **NFR-04:** Los iconos se resuelven a través del catálogo MDI cargado bajo demanda.
- **NFR-05:** Las métricas de sensores usan tokens tipográficos responsive con nombre semántico; los widgets no definen escalas de texto arbitrarias en línea.
- **NFR-06:** La grilla conserva flujo secuencial: el placeholder final no rellena huecos ni se superpone visualmente a otras zonas.
- **NFR-07:** Los iconos comunes del tablero se resuelven sin cargar el catálogo MDI completo; los iconos personalizados mantienen compatibilidad mediante carga diferida al requerirse.
- **NFR-08:** La transferencia excluye propietario, visibilidad y fondos locales; la copia importada usa identificadores nuevos y solo es visible para quien la importa.
- **NFR-09:** El historial no guarda ni restaura imágenes de fondo locales; las revisiones no deben exponer secretos, permisos de otros usuarios ni rutas de archivos de otra instalación.
- **NFR-10:** Las tarjetas multimedia deben adaptarse a la celda que ocupan: en celdas compactas conservan sus comandos soportados en una composición envolvente, sin recortar controles, títulos o progreso. El visor ampliado de cámara prioriza la proporción del medio y aprovecha el viewport sin crear una columna vertical vacía.
- **NFR-11:** En edición, el lienzo ocupa como mínimo el área visible restante del viewport, incluso cuando una pestaña todavía no contiene widgets.
- **NFR-12:** El reordenamiento de zonas funciona mediante puntero y teclado desde el control de arrastre. Si una interacción se cancela, el estado visual transitorio se limpia sin alterar el orden persistido.

## 6. Criterios de Aceptación

- [x] AC1: Un usuario no ve ni accede por URL a un dashboard sin visibilidad asignada.
- [x] AC2: Crear, editar, mover y eliminar pestañas, secciones y widgets persiste al recargar.
- [x] AC3: El selector de entidad muestra solo tipos compatibles con la tarjeta elegida.
- [x] AC4: Los placeholders aparecen al final de la grilla disponible y no cubren tarjetas existentes.
- [x] AC5: Cámara, media, reloj, sensor y control mantienen una presentación válida en los tres breakpoints.
- [x] AC6: Los valores, porcentajes y títulos de sensores conservan una jerarquía legible mediante tokens responsive compartidos.
- [x] AC7: El saludo del tablero utiliza el nombre visible o usuario de la sesión autenticada y conserva un fallback traducido.
- [x] AC8: Un tablero con iconos comunes conserva sus controles visibles en móvil, tablet y escritorio sin requerir la carga inicial del catálogo MDI completo.
- [x] AC9: Exportar un tablero produce un paquete `homepilot-dashboard` con versión explícita y sin referencias a fondos locales ni políticas de acceso.
- [x] AC10: Importar un paquete compatible crea una copia privada, con pestañas y widgets de nuevos identificadores, sin modificar el tablero de origen.
- [x] AC11: Cada guardado de tablero deja una revisión local que su propietario puede restaurar sin perder la posibilidad de deshacer la restauración.
- [x] AC12: Restaurar una revisión no restituye referencias de imágenes de fondo locales eliminadas.
- [x] AC13: Las tarjetas multimedia compactas, el visor ampliado de cámara y el inspector técnico preservan contenido y acciones legibles en móvil, tablet y escritorio, sin desborde ni áreas vacías desproporcionadas.
- [x] AC14: Una pestaña nueva en edición conserva el fondo cuadriculado y los placeholders hasta el borde inferior del viewport visible.
- [x] AC15: Una zona puede reordenarse desde su control de arrastre mediante teclado y una cancelación no deja overlay ni opacidad residual.
- [x] AC16: Las tarjetas de sensor, clima y cortina mantienen jerarquía visual, controles táctiles y ausencia de overflow horizontal a 320px, 768px y 1440px. Las lecturas y porcentajes siguen siendo legibles sin alterar sus contratos de datos ni comandos.

## 7. Notas Técnicas y Arquitectura

- API: `/api/v1/dashboards/*` mediante `DashboardRoutes`.
- Las estructuras de dashboard pertenecen al contexto de topología; los widgets no contienen reglas de negocio de dispositivos.
- `DashboardCanvas` y el catálogo de widgets son el único punto de montaje visual de tarjetas.

## 8. Preguntas Abiertas y TODOs

- El paquete de transferencia no incluye fondos locales. Estos dependen del almacenamiento de cada Edge y se vuelven a configurar después de importar.
