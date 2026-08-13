# Specification: Voice Catalog V1

**Estado:** Borrador

## Objetivo

Dar a cada dispositivo y escena un perfil de voz explícito y auditable, de modo que HomePilot exponga al asistente sólo controles autorizados, con nombres naturales y acciones acordes al riesgo.

## Requisitos

- Un dispositivo tiene un nombre visible independiente de su nombre para conversación y voz.
- Cada dispositivo puede habilitarse o excluirse del catálogo de voz sin afectar los controles manuales, automatizaciones o escenas existentes.
- Los nombres y alias de voz deben ser únicos dentro del hogar; las colisiones se rechazan con una explicación accionable.
- El catálogo debe mostrar acciones compatibles por dispositivo, derivadas de sus capabilities, sin inventar acciones.
- Toda acción sensible conserva confirmación persistida y autorización por hogar; excluir un dispositivo de voz no permite eludir estas reglas desde texto, voz ni selección de interfaz.
- El catálogo debe soportar alcance por usuario sólo mediante alias personales existentes; el perfil base pertenece al hogar y sólo un administrador puede modificarlo.
- La consola debe permitir revisar y editar el perfil de voz sin exponer secretos ni datos de terceros.

## Criterios de aceptación

- [ ] AC-01: Un administrador puede activar o desactivar la exposición conversacional de un dispositivo propio.
- [ ] AC-02: Un administrador puede establecer un nombre de voz válido y único por hogar.
- [ ] AC-03: El asistente excluye dispositivos deshabilitados de todas sus resoluciones y aclaraciones.
- [ ] AC-04: El asistente resuelve el nombre de voz antes del nombre técnico del dispositivo, manteniendo las aliases personales como capa adicional.
- [ ] AC-05: Las capabilities limitan las acciones mostradas y ejecutables por catálogo.
- [ ] AC-06: Acciones masivas, escenas y controles sensibles conservan la confirmación y autorización existentes.
- [ ] AC-07: Las rutas de catálogo validan sesión, rol y pertenencia al hogar.
- [ ] AC-08: La interfaz es usable en escritorio, tableta y móvil y no altera el flujo manual existente.