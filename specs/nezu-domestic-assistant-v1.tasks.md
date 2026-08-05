# Tareas: Asistente Doméstico Nezu V1

Especificación principal: [nezu-domestic-assistant-v1.md](./nezu-domestic-assistant-v1.md)

## Preparación de producto

- [x] Definir identidad residencial Nezu sin introducir un asistente paralelo.
- [x] Delimitar alcance, exclusiones y fuente de verdad HomePilot.
- [x] Definir ciclo de interacción, cancelación y prevención de respuestas obsoletas.
- [x] Definir requisitos de permisos, confirmación, privacidad, i18n y accesibilidad.
- [x] Registrar criterios de aceptación y decisiones pendientes.

## Fase A — Contratos y ciclo

- [ ] Inventariar los estados actuales de chat, activador, STT, TTS y ejecución contra RF-01 y RF-02.
- [ ] Definir el contrato interno de turno sin cambiar rutas HTTP públicas.
- [ ] Centralizar invalidación de callbacks por `turnId` y origen.
- [ ] Añadir pruebas para cancelación y carreras de respuestas tardías.

## Fase B — Voz robusta

- [ ] Verificar una solicitud STT por captura aceptada.
- [ ] Cubrir 409, timeout, transcript vacío e interrupción sin dejar bloqueos.
- [ ] Verificar que el activador limpia el turno previo y emite un solo sonido.
- [ ] Confirmar fallback escrito ante fallo de TTS.

## Fase C — Contexto y seguridad

- [ ] Verificar que el contexto solo contenga entidades autorizadas.
- [ ] Validar la política de confirmación por origen y sensibilidad.
- [ ] Reducir auditorías técnicas repetitivas y conservar datos accionables.
- [ ] Asegurar que secretos, audio y prompts no lleguen a la UI ni a logs ordinarios.

## Fase D — Experiencia residencial

- [ ] Definir el contrato de resultado semántico y el catálogo de claves de respuesta, sin frases completas en servicios de dominio.
- [ ] Migrar textos de éxito, error, aclaración, confirmación y cancelación del asistente a catálogos i18n centrales con parámetros tipados.
- [ ] Añadir validación que detecte claves del asistente ausentes en español o inglés y textos literales nuevos fuera de los catálogos autorizados.
- [ ] Verificar que las variantes de tono no alteren el resultado confirmado ni revelen datos fuera de contexto.

- [ ] Aplicar respuestas concisas y sin inventario no solicitado.
- [ ] Confirmar traducción completa en español e inglés, incluido TTS.
- [ ] Verificar compositor de chat y voz en escritorio, tableta, móvil y teclado virtual.
- [ ] Validar sincronización de estados en todas las superficies relevantes.

## Fase E — Proveedores y calidad de voz

- [ ] Inventariar el activador, Whisper local y Piper contra los contratos de proveedor definidos en la spec.
- [ ] Centralizar `turnId`, cancelación e invalidación de callbacks en todos los orígenes de interacción.
- [ ] Añadir configuración administrativa explícita y segura para proveedores premium opcionales.
- [ ] Verificar fallback a Piper ante proveedor premium ausente, fallido o sin cuota.
- [ ] Prohibir clonación, imitación o atribución de voces de terceros en configuración y documentación.
- [ ] Ejecutar evaluación controlada de `Ok Nezu` en español: precisión, falsos positivos, silencio y ruido residencial.
- [ ] Verificar que el idioma de HomePilot gobierne texto y TTS sin depender del navegador.

## Fase F — Calidad y despliegue

- [ ] Añadir pruebas de integración para casos UC-01 a UC-07.
- [ ] Ejecutar `npm run typecheck`.
- [ ] Ejecutar `npm run build`.
- [ ] Ejecutar `npm run build --prefix apps/operator-console`.
- [ ] Ejecutar `npm run test`.
- [ ] Validar `docker compose up --build` en un entorno de instalación soportado.
