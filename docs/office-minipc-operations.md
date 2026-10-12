# Operación de la MiniPC de oficina

Guía operativa para quien mantenga el despliegue Linux de la oficina (personas o agentes). No contiene credenciales: el acceso se entrega por separado.

## Qué corre y dónde

- Repositorio en `~/homepilot`, proyecto de Compose `homepilot`.
- Archivos de Compose del despliegue: `docker-compose.office.yml` y `docker-compose.android-display.yml`; la API suma `docker-compose.tpm.yml`.
- Datos en `~/homepilot/data` (SQLite `homepilot.db`), copias en `~/homepilot/backups`.

## Rutinas

| Tarea | Comando | Notas |
| --- | --- | --- |
| Actualizar y desplegar | `git pull && bash scripts/homepilot-maintenance.sh --deploy` | Reconstruye y limpia la caché de Docker. No usar `docker compose up --build` a mano: omite la limpieza y llenó el disco una vez. |
| Limpiar la caché de build | `bash scripts/homepilot-maintenance.sh --gc-homepilot` | Seguro con el sistema en marcha. |
| Recuperar espacio de la base | `bash scripts/compact-database.sh` | Detiene la API 2 o 3 minutos, escribe una copia verificada tabla por tabla y solo entonces la intercambia. La base anterior queda en `data/homepilot.old.db`; bórrala cuando confirmes que todo funciona. |
| Copia de seguridad | `VACUUM INTO` desde el contenedor de la API | `db.backup` se atasca mientras la API escribe. |

## Qué cuida el propio sistema

- El registro de actividad se depura solo: 7 días para el ruido (`STATE_CHANGED`, `AUTOMATION_EXECUTED`) y 90 para el resto (`HOMEPILOT_ACTIVITY_NOISE_RETENTION_DAYS`, `HOMEPILOT_ACTIVITY_RETENTION_DAYS`).
- SQLite no devuelve a disco el espacio liberado: tras una limpieza grande hay que compactar.

## Comprobaciones de salud (solo lectura)

- `docker ps` y el estado `healthy` de `homepilot-api`.
- `df -h /` y tamaño de `data/homepilot.db`.
- Conteos de usuarios, dispositivos y migraciones aplicadas en la base.

## Reglas

- Cambios en la MiniPC: pequeños, con copia previa y plan de reversión.
- Pegar scripts largos en la terminal los corrompe: ejecutar siempre scripts del repositorio.
- Seguir `AGENTS.md`: sin `commit`, `push` ni despliegues en producción sin autorización explícita.
