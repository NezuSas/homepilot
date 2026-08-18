# Windows Local Runtime

## Supported Command

Use the same maintenance command as Linux. It detects Docker Desktop and adds
the matching Compose overlay for the selected installation profile.

```powershell
bash scripts/homepilot-maintenance.sh --deploy --yes
bash scripts/homepilot-maintenance.sh --profile ha_companion --deploy --yes
```

Open the Operator Console at `http://localhost:8080`.

## Manual Compose Equivalents

For `bridge_ha` or `native_only`:

```powershell
docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml up -d --build
```

For `ha_companion`:

```powershell
docker compose -f docker-compose.yml -f docker-compose.ha-companion.desktop.yml up -d --build
```

The Operator Console uses a same-origin proxy to reach the API. Browser clients
do not require a separately configured API URL.

## Ports and Networking

The Home Assistant companion profile normally uses host networking on Linux.
Docker Desktop does not provide identical host-network semantics, so the
Desktop overlay removes host networking and publishes the API on `13000` and
the UI on `8080` by default. `HOMEPILOT_API_PORT` and
`HOMEPILOT_UI_PORT` may override those values.

Use the canonical `data/homepilot.db` path for a given appliance. Windows and
Linux must not silently create separate databases for the same installation.