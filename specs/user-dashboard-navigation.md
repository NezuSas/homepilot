# Spec: Navegación de Tableros por Usuario

## Problema
La consola mostraba "Paneles" como una pantalla única y además repetía una navegación interna de paneles dentro del contenido. Para un flujo similar a Home Assistant, los tableros deben vivir como una familia de navegación del sidebar, evitando llenar la navegación principal y evitando duplicar listas dentro de la pantalla.

## Alcance
- Cambiar la etiqueta visible de `Paneles` a `Tableros` en español y mantener `Dashboards` en inglés.
- Mostrar `Tableros/Dashboards` como un grupo colapsable del sidebar.
- Listar debajo los tableros disponibles para el usuario autenticado.
- Crear automáticamente un tablero base por usuario activo cuando no exista.
- Mantener la pantalla de tablero minimalista, responsiva y alineada al design system de HomePilot.

## Fuera de Alcance
- Cambiar el modelo de permisos de dashboards.
- Implementar drag-and-drop nuevo o un motor de layout distinto.
- Crear dashboards multi-home avanzados.

## Requisitos Funcionales
1. La navegación principal debe mostrar `Tableros` como padre colapsable en español y `Dashboards` en inglés.
2. Al abrir el grupo, cada tablero visible debe aparecer como hijo de navegación sin duplicar una lista interna dentro de la pantalla.
3. Al cargar `/api/v1/dashboards`, el backend debe garantizar que cada usuario activo relevante tenga al menos un tablero base.
4. Para un administrador, la garantía aplica a todos los usuarios activos visibles por gestión de usuarios.
5. Para un usuario no administrador, la garantía aplica únicamente a su propio usuario.
6. La vista de tablero debe permitir seguir creando, renombrando, editando, agregando pestañas y eliminando con los flujos existentes.

## Criterios de Aceptación
- **AC1:** En español el sidebar muestra `Tableros`; en inglés muestra `Dashboards`.
- **AC2:** `Tableros` se comporta como sección colapsable y lista los dashboards debajo.
- **AC3:** Si existen usuarios activos Oscar y Gustavo sin tablero, un `GET /api/v1/dashboards` desde admin crea y devuelve un tablero para cada usuario.
- **AC4:** La pantalla de dashboards no muestra una segunda lista lateral de tableros dentro del contenido.
- **AC5:** Seleccionar un tablero hijo desde el sidebar abre la vista `dashboards` y muestra ese tablero.
- **AC6:** La UI conserva comportamiento responsive en móvil, tablet y escritorio sin crear stores globales nuevos.
