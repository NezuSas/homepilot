# Tareas — HomePilot effectiveActions v1

- [x] Definir el contrato versionado del manifest y su validación runtime estricta en `packages/cloud-gateway/application`.
- [x] Rechazar configuración de implementación remota, comandos desconocidos, acciones duplicadas y `sensitive` sin confirmación.
- [x] Implementar resolver puro con identidad UUID, estado asignado y capacidades locales existentes.
- [x] Derivar `controlType` desde el esquema local y excluir controles remotos incompatibles o no representables en V1.
- [x] Definir salida segura y orden determinístico por `key`.
- [x] Escribir pruebas del parser, intersección Smart Display, política local, esquema de volumen y ausencia de datos físicos/secretos.
- [x] Registrar alcance, límites y criterios de aceptación de la fundación local.
- [ ] Ejecutar tests y validaciones de calidad en una tarea expresamente autorizada; no se ejecutan en esta fase.
- [ ] Diseñar y validar autenticación, transporte, persistencia y ejecución semántica en fases posteriores.
- [ ] En la futura sincronización S2S, verificar `manifest.installationId === installationId` esperado localmente antes de usar el manifest.
