# Tareas: Media Player Local Control V1

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
- [x] Reemplazar el fallback plano de portada por un campo de audio estático acorde al sistema visual de HomePilot.

## Verificación obligatoria ante cambios

- [ ] Validar token vencido, artwork no disponible y reproducción sin portada.
- [ ] Validar que los selectores no mezclen dispositivos de media con luces u otros tipos.
