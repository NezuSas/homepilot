# Tareas: Roles del hogar y acceso por habitación V1

- [x] Migración `036_user_access_scope.sql` y repositorio de usuarios con alcance y vencimiento.
- [x] Dominio y servicio de gestión de usuarios: validación de alcance y vencimiento, auditoría `USER_ACCESS_CHANGED`.
- [x] Autenticación: rechazo y revocación de sesiones vencidas (`ACCOUNT_EXPIRED`).
- [x] Política de alcance y su aplicación en dispositivos, habitaciones, cámaras, reproductores, escenas, asistente y eventos en tiempo real.
- [x] Endpoint `PATCH /admin/users/:id/access`, DTO y `GET /auth/me`.
- [x] Consola: nombres y descripciones de rol, selector de alcance y de vencimiento, tarjeta de resumen.
- [x] Pruebas unitarias, de API y de extremo a extremo; documentación y matriz de cobertura.
- [x] Retiro del rol `operator`: migración `038_retire_operator_role.sql`, dominio, API, consola, textos y pruebas.
