# Tareas: Scene Lifecycle V1

## Implementado

- [x] Compartir explícitamente con varios usuarios activos: lectura/ejecución/favoritos, nunca edición/eliminación por receptor; revocación inmediata en solicitudes futuras.
- [x] Migración aditiva 034 con default privado y descripción dentro del payload existente; no atribuir escenas históricas sin creador.
- [ ] Backup SQLite y validación en MiniPC antes de aplicar la migración fuera del entorno temporal de pruebas.

- [x] CRUD local y ejecución mediante `SceneRoutes`.
- [x] Constructor de escenas y listado responsive en Operator Console.
- [x] Favoritos, validación de capacidades, auditoría y sincronización visual.
- [x] Persistir el ID del creador en escenas nuevas sin migración de tabla; filtrar listas, favoritos, asistente y operaciones por ID con denegación ante escenas ajenas o sin creador.
- [x] Cubrir dos usuarios del mismo hogar, acceso directo ajeno y persistencia del creador.

## Verificación obligatoria ante cambios

- [ ] Ejecutar pruebas de rutas de escenas y comandos de dispositivo.
- [ ] Validar permisos de ejecución y administración.
- [ ] Confirmar actualización por eventos en la consola.

