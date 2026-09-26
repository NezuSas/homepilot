# Tareas: Edge Platform Foundations V1

- [x] Gateway Fastify, handler contract, WebSocket y utilidades compartidas.
- [x] Persistencia SQLite, migraciones, backups y journal configurable.
- [x] Backup manual consistente con WAL mediante la API de backup de SQLite; prueba de apertura/restauración aislada y limpieza de archivo parcial en caso de error.
- [x] Regresión de sidecars temporales: cerrar la verificación, retirar `.partial-wal` y `.partial-shm` antes de publicar el backup, limpiar los tres artefactos ante error y comprobar su ausencia antes de reabrir el `.db` en pruebas.
- [x] Runtime Docker local.
- [ ] Evaluar Event Bus persistente local cuando el volumen de eventos lo requiera.
