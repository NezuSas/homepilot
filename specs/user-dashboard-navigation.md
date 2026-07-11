# Spec: Navegación de Tableros por Usuario

## Problema
La consola mostraba "Paneles" como una pantalla única y además repetía una navegación interna de paneles dentro del contenido. Para un flujo similar a Home Assistant, los tableros deben vivir como una familia de navegación del sidebar, evitando llenar la navegación principal y evitando duplicar listas dentro de la pantalla.

## Alcance
- Cambiar la etiqueta visible de `Paneles` a `Tableros` en español y mantener `Dashboards` en inglés.
- Mostrar `Tableros/Dashboards` como un grupo colapsable del sidebar.
- Listar debajo los tableros disponibles para el usuario autenticado.
- Mostrar el logo visual de Nezu en la cabecera del sidebar.
- Mostrar las pestañas de cada tablero como una barra horizontal superior similar al patrón de Home Assistant.
- La pantalla de tableros no debe mostrar hero/banner grande permanente; la navegación y edición deben vivir en una barra superior compacta.
- El lápiz de una vista debe abrir un modal de configuración con secciones `Configuraciones`, `Fondo` y `Visibilidad`.
- La sección de `Tableros` en el sidebar debe poder abrirse/cerrarse sin forzar navegación al dashboard.
- Crear automáticamente un tablero base por usuario activo cuando no exista.
- Mantener la pantalla de tablero minimalista, responsiva y alineada al design system de HomePilot.

## Fuera de Alcance
- Implementar drag-and-drop nuevo o un motor de layout distinto.
- Crear dashboards multi-home avanzados.

## Requisitos Funcionales
1. La navegación principal debe mostrar `Tableros` como padre colapsable en español y `Dashboards` en inglés.
2. Al abrir el grupo, cada tablero visible debe aparecer como hijo de navegación sin duplicar una lista interna dentro de la pantalla.
3. Al cargar `/api/v1/dashboards`, el backend debe garantizar que el usuario autenticado tenga al menos un tablero base.
4. La visibilidad de dashboards y vistas debe resolverse por usuario: ser propietario o estar incluido explícitamente en `visibility.users`.
5. El rol `admin` no debe dar visibilidad automática a dashboards o vistas de otros usuarios.
6. La vista de tablero debe permitir seguir creando, renombrando, editando, agregando pestañas y eliminando con los flujos existentes.

## Criterios de Aceptación
- **AC1:** En español el sidebar muestra `Tableros`; en inglés muestra `Dashboards`.
- **AC2:** `Tableros` se comporta como sección colapsable y lista los dashboards debajo.
- **AC3:** Si el usuario autenticado no tiene tablero, `GET /api/v1/dashboards` crea y devuelve un tablero base para ese usuario, incluyendo usuarios con rol `guest`.
- **AC4:** La pantalla de dashboards no muestra una segunda lista lateral de tableros dentro del contenido.
- **AC5:** Seleccionar un tablero hijo desde el sidebar abre la vista `dashboards` y muestra ese tablero.
- **AC6:** La UI conserva comportamiento responsive en móvil, tablet y escritorio sin crear stores globales nuevos.
- **AC7:** El sidebar muestra el logo de Nezu sin depender de rutas absolutas del sistema operativo.
- **AC8:** Las pestañas del tablero se muestran como navegación horizontal con acciones de edición visibles cuando el tablero está en modo edición.
- **AC9:** El sidebar no muestra separadores ni encabezados de grupo para `Personalización`; los accesos se listan como items normales.
- **AC10:** Presionar la flecha del grupo `Tableros` abre o cierra sus hijos sin bloquearse por la navegación.
- **AC11:** Presionar el lápiz de una vista abre un modal de configuración con pestañas internas de configuración, fondo y visibilidad.
- **AC12:** Los placeholders de creación de widgets/secciones se alinean con el mismo CSS Grid que las tarjetas reales, sin posicionamiento absoluto que ignore los gaps del layout.
- **AC13:** Las tarjetas dentro de una sección son responsivas y accionables: luces/dispositivos/cortinas ejecutan su comando local y refrescan estado; cámaras abren el visor completo sin mantener doble reproducción.
- **AC14:** El catálogo de tarjetas de sección no expone la tarjeta legacy `system`; si existe data antigua persistida con esa tarjeta, la normalización debe ignorarla sin romper el tablero.
- **AC15:** El flujo de edición no expone el inspector legacy de widgets ni presets `XS/S/M/L/XL`; las tarjetas se gestionan desde secciones con dimensiones de filas/columnas.
- **AC16:** La configuración de vista no muestra opciones de diseño no implementadas para el usuario final; conserva el layout existente y permite configurar título, icono, fondo y visibilidad.
- **AC17:** La visibilidad de una vista se respeta en frontend filtrando pestañas por usuario; el propietario ve sus vistas y un usuario externo solo ve pestañas donde su id esté incluido en `visibility.users`.
- **AC18:** La visibilidad de dashboards se respeta en backend sin bypass por rol: un admin no ve dashboards de otro usuario salvo que sea propietario o esté incluido en `visibility.users`.
- **AC19:** Al borrar una pestaña de tablero o remover su fondo, los archivos físicos del fondo en `data/media/dashboards/<dashboardId>/<tabId>` se eliminan.
