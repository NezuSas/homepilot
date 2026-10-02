# Tareas — Modbus TCP local V1

- [x] Alcance, compatibilidad, seguridad y reversión aprobados/documentados.
- [x] AC1/AC6: repositorio SQLite y migración aditiva con inventario transaccional.
- [x] AC2: validación de configuración, autorización Admin/hogar y rutas modulares.
- [x] AC3: cliente TCP con pruebas de PLC simulado y decodificación.
- [x] AC4/AC5: driver compartido, polling, backoff y lifecycle.
- [x] AC7: configuración modular Sistema, traducciones y skeleton específico.
- [x] Validación focalizada, typecheck, lint/build y controles de trazabilidad.
- [ ] Verificar mapa/firmware/puerto del PLC real con autorización separada; fuera de validación simulada.

## Evidencia local — 2026-10-02

- Jest focalizado: 6 suites, 102/102 PASS (67 Modbus y 35 regresión de comandos/servidor). Cliente TCP únicamente en loopback simulado; SQLite temporal aislada.
- Responsive `Native Modbus configuration`: 5/5 PASS, móvil, tablet portrait/landscape, desktop, claro/oscuro y navegación no-Admin. Guardar completamente visible después del scroll interno del formulario móvil. Capturas asentadas en `.impeccable/review/modbus-v1/`.
- Typecheck, lint de Operator Console, build raíz y build de Operator Console PASS; spec coverage, BDD, cobertura por módulo, i18n, límites de arquitectura y no-production-any PASS.
- No Jest completo, responsive completo, Docker, Git/GitHub ni deploy. Sin conexión ni comandos al PLC físico. Warnings no bloqueantes: Browserslist desactualizado y tamaño de chunks existentes; WebSocket de realtime sin servidor en fixtures responsive.
- Revisión visual fresca: SHIP para la UI Modbus, tras corregir contraste heredado y repetir capturas asentadas; no equivale a aprobación de release/hardware. Documento modular `docs/components/ModbusConnectionCard.md`. La altura táctil heredada de Input/Toggle no se rediseñó globalmente.
- Antes de instalar en MiniPC: backup SQLite, verificar mapa/firmware/puerto y aislamiento LAN, reconstruir API + UI. No se certifica hardware a partir del simulador.
