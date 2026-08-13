# Tareas: Single-Home Shared Access V1

## Implementación

- [x] Modelar la resolución de hogares como alcance de instalación única y fallar cerrada ante múltiples hogares.
- [x] Reemplazar la validación de propietario por validación del hogar único local en los puertos de dispositivos y topología.
- [x] Impedir crear un segundo hogar desde la API.
- [x] Cubrir repositorio y adaptador de topología con pruebas de acceso compartido y configuración inválida.

## Verificación

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run build --prefix apps/operator-console`
- [x] `npm run test`