# Tareas: Media Player Local Control V1

## Control modular de volumen — AC9 (2026-10-03)

- [x] Reutilizar MediaVolumeSlider en Clásico y Premium, manteniendo botones de volumen y permisos existentes.
- [x] Rango accesible 0–100 con valor local durante movimiento y envío único al confirmar; cancelación no envía comando y volumen desconocido permanece deshabilitado.
- [x] Cubrir ambos reproductores con Jest focalizado y dos escenarios responsive de transición idle y volumen por puntero/teclado. Validación conjunta: 429/429 Jest y 22/22 escenarios responsive únicos PASS.
- [x] Sin cambio de API multimedia, comandos soportados, progreso de reproducción ni permisos; no se conectó un reproductor real.


## Implementado

- [x] Modelo importado de media player y controles por capacidad.
- [x] Tarjeta responsive con portada mediante proxy protegido y fallback.
- [x] Actualización de estado en tiempo real para dashboard y dispositivos.
- [x] Asistente determinista para consultas de reproducción y control de volumen exacto o relativo en reproductores autorizados.
- [x] Manejo explícito de reproductor apagado, no disponible, operación no soportada y fallo de ejecución.
- [x] Seguimiento contextual de un único reproductor recién consultado para encendido explícito.
- [x] Variantes naturales de consulta y control de audio, con filtrado por estancia y respuesta explícita para estancias sin reproductores importados.
- [x] La importación y los comandos de reproductores conservan los atributos multimedia obtenidos de Home Assistant.
- [x] Mostrar progreso y duración únicamente cuando Home Assistant los reporta, con actualización visual durante reproducción.
- [x] Mantener el reloj visual para integraciones que omiten `media_position_updated_at`, anclándolo localmente entre estados reales.
- [x] Reemplazar el fallback plano de portada por un campo de audio estático acorde al sistema visual de HomePilot.
- [x] Presentar el único Media Player con composición premium, artwork 1:1 y placeholder neutral; conservar el renderer anterior solo como referencia interna sin añadir campos persistidos.
- [x] Ocultar la sesión multimedia heredada cuando Home Assistant informa un estado inactivo, conservando `paused` cuando el origen mantiene su sesión.

## Verificación obligatoria ante cambios

- [ ] Validar externamente el renderer HomePilot Premium en reproducción, pausa, idle y sin artwork, además del cambio de canción, los comandos actuales y responsive. Tests escritos, no ejecutados por restricción de esta tarea.

- [ ] Validar token vencido, artwork no disponible y reproducción sin portada.
- [ ] Validar que los selectores no mezclen dispositivos de media con luces u otros tipos.
- [x] Validar la transición `playing → idle` con metadatos heredados y `playing → paused` en la tarjeta.
