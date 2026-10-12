# TASK BREAKDOWN: Operator Console Estancia Viva Design V1

- [x] Estudio de competidores y descarte del vidrio como lenguaje base.
- [x] Retirar la exploración de vidrio (tokens, reglas CSS, variante del shell, átomos y piloto sin consumidores).
- [x] Incluir Inter (OFL) y ponerla primera en `--font-sans`.
- [x] Tokens `--tile-*` y `--scene-*` en oscuro y claro.
- [x] Estado encendido iluminado para tarjetas de habitación, rutinas y dashboards (solo CSS, sin capa y con especificidad igualada).
- [x] Estado encendido iluminado para `DeviceWidget`.
- [x] `roomSceneModel` con pruebas (luces y persiana reales; desconocido ≠ cerrado).
- [x] `RoomScene` decorativa con pruebas e integración en `TopologyRoomDetailPanel`.
- [x] Documentación `docs/components/RoomScene.md` y matriz de cobertura (988 archivos).
- [x] Validación: Jest 86/86 suites (750), typecheck, lint, build y controles de spec/BDD/módulo/UI/any/arquitectura.
- [x] Revisión visual en navegador: oscuro y claro, escritorio, tablet horizontal y vertical, luces encendidas y apagadas.
- [ ] Suite responsive completa (en curso al redactar).
- [x] Diseños: lienzo de Claude Design (tablet horizontal ×3, vertical, móvil, escritorio) y Figma páginas A y B (fundamentos, Light Tile, Curtain Tile, Camera Tile, Room Scene, detalle de habitación).
- [ ] Aprobación visual humana.
- [ ] Fase 2 (no incluida): restilar `CurtainDeviceTile`, `CameraDeviceTile` y sensor; riel lateral en tablet; fotos por estancia (requiere persistencia).

> 2026-10-12: la tarea de la escena de habitación quedó retirada; ver `operator-console-spaces-clarity-v1.tasks.md`.
