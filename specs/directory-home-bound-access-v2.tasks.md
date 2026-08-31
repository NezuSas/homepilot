# Tareas — Acceso Directory vinculado al hogar Edge V2

**Base:** `specs/directory-home-bound-access-v2.md`  
**Issue:** NezuSas/homepilot#7, coordinada con NezuSas/nezu-homepilot-directory#1.

## 1. Dominio y persistencia

- [ ] Definir puertos para identidad de Edge emparejado, claves públicas versionadas
  y sesiones de procedencia Directory.
- [ ] Crear migraciones SQLite aditivas para configuración de hogar/Edge, `jti`
  consumidos y metadatos de sesión con purga segura.
- [ ] Extender `DirectorySsoVerifier` para exigir emisor, audiencia, `homeId`,
  `edgeId`, `kid` y rol, antes de consumir el `jti`.

## 2. Aplicación y red

- [ ] Implementar servicio de sesión Directory que aplique rol explícito y TTL
  sin depender de red a Directory.
- [ ] Mantener el adaptador V1 de enlaces locales como ruta de compatibilidad.
- [ ] Adaptar `AuthRoutes` como adaptador HTTP, sin lógica de autorización en la
  ruta ni exposición de token en logs/respuestas.
- [ ] Definir respuestas de error seguras y estables para emparejamiento faltante,
  hogar/audiencia incorrecta, rol ausente, expiración y replay.

## 3. Interfaz

- [ ] Manejar retorno Directory V2 limpiando la URL y preservando el login local
  ante un fallo no recuperable.
- [ ] Mostrar una explicación accesible de acceso no habilitado sin datos internos.
- [ ] Mantener intactas las vistas y ajustes de enlaces V1 durante la transición.

## 4. Calidad y seguridad

- [ ] TDD de firma, emisor, audiencia, hogar/Edge, rol, `kid`, TTL y replay.
- [ ] Pruebas de integración de migración SQLite y sesión Directory vs. local.
- [ ] Prueba de aislamiento entre dos hogares y regresión de SSO V1/login local.
- [ ] Ejecutar controles obligatorios de HomePilot y una prueba de integración
  autorizada antes de mover la Issue a QA.
