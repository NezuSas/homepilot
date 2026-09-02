# Tareas — Colecciones Bruno para la API HTTP de HomePilot v1

**Spec:** `bruno-api-collections-v1.md`  
**Issue:** NezuSas/homepilot#9

## Implementación

- [ ] Inventariar los endpoints de cada `RouteHandler` y asociarlos con sus grupos Bruno.
- [ ] Crear la colección, el entorno de ejemplo y las reglas de exclusión de secretos.
- [ ] Documentar rutas de lectura y rutas mutantes con muestras sintéticas.
- [ ] Añadir una guía de uso, secretos y mantenimiento.
- [ ] Verificar que no existan secretos ni valores de instalación en los archivos Bruno.

## Validación

- [ ] Ejecutar `npm run check:spec-coverage`.
- [ ] Ejecutar `npm run check:bdd-traceability`.
- [ ] Ejecutar `npm run check:module-test-coverage`.
- [ ] Revisar `git status` y confirmar que no se incorporaron artefactos temporales.
