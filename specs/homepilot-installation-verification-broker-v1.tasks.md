# Tareas — HomePilot Installation Verification Broker v1

- [x] Extraer la lectura existente de la identidad cloud a un proveedor compartido sin alterar el formato provisionado.
- [x] Crear un servicio efímero que valide estrictamente el challenge, derive Directory desde WSS y solicite la atestación con timeout de 10 segundos.
- [x] Validar respuesta Directory y mapear errores estables sin exponer secretos.
- [x] Añadir ruta local `POST /api/v1/system/installation-verification/attest` protegida por sesión y rol admin, con `Cache-Control: no-store`.
- [x] Escribir pruebas de input, identidad cloud, URL, request HTTP, timeout, respuestas y autorización de ruta.
- [x] Documentar el límite de confianza y la responsabilidad posterior de IntentFlow.
- [x] Declarar estado y criterios de aceptación de la implementación local, con mapping específico de spec coverage.
- [ ] Ejecutar pruebas y validaciones de calidad en una tarea posterior autorizada. Esta tarea prohibió toda ejecución.
- [ ] Validar el flujo físico completo con Directory e IntentFlow en una fase posterior; sin deploy en esta tarea.
