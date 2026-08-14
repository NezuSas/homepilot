# Tareas: Dashboard Layout and Widgets V1

## Implementado

- [x] CRUD de dashboards, pestañas, secciones, widgets y visibilidad de usuarios.
- [x] Canvas responsive, widgets tipados y catálogo MDI diferido.
- [x] Controles por capacidad, cámaras, sensores, reloj, escena y media player.
- [x] Tipografía de métricas de sensores centralizada en tokens responsive del design system.
- [x] Superficies claras de widgets con fondos activos: una veladura cálida y neutra reduce la competencia visual del fondo, mientras las tarjetas usan una escala mineral de piedra y arena, bordes serenos y elevación moderada sin alterar estados ni comandos.
- [x] Placeholder de nueva sección en flujo secuencial, siempre posterior a las secciones existentes.
- [x] Plantillas de título vinculadas únicamente al contexto autenticado local de HomePilot.
- [x] Tarjeta multimedia compacta, visor de cámara proporcional e inspector técnico adaptativo para celdas, modal y cajón angostos.
- [x] Reordenamiento de zonas por puntero y teclado, con limpieza del overlay al cancelar la interacción.
- [x] AC17: `DashboardsView` gatea el montaje del canvas con `LoadingState` hasta la primera carga del
      snapshot de dispositivos, eliminando el parpadeo de widgets "no configurados" antes de que
      llegue el estado real.

## Verificación obligatoria ante cambios

- [ ] Probar móvil, tablet y escritorio con contenido largo y fondos activos.
- [ ] Probar acceso directo de usuario autorizado y no autorizado.
- [ ] Probar reordenamiento vertical y horizontal sin placeholders superpuestos.
- [x] AC17: `npm run typecheck`/`build` en `apps/operator-console`, `check:i18n`,
      `check:ui-primitives` en verde. Verificación visual en navegador pendiente del usuario (sin
      herramienta de automatización de navegador disponible en este entorno).
