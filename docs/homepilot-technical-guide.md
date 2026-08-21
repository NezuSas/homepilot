# HomePilot — Technical and Operations Guide

## Application purpose

HomePilot is Nezu's local console for operating a smart home from a local mini PC/Edge appliance. The application integrates devices imported from Home Assistant, organizes them by home and room, controls them from a web interface, executes scenes and automations, and provides a local voice assistant activated by **Ok Nezu**.

The current product objective is local, modular, and maintainable home control:

- The UI runs as a responsive web console.
- The backend exposes a local Fastify API.
- Persistence uses local SQLite.
- Home Assistant acts as the integration bridge for physical devices.
- STT and TTS run locally as separate services.
- Docker Compose starts the complete stack for development and local validation.

## Local runtime overview

| Service | Container | Host port | Role |
|---|---:|---:|---|
| HomePilot API | homepilot-api | 3000 | HTTP API, WebSocket, auth, devices, scenes, automations, assistant |
| HomePilot UI | homepilot-ui | 80 | Operator web console |
| Home Assistant | homeassistant | 18123 | Local bridge to physical devices |
| Piper TTS | homepilot-tts | 8088 | Local voice synthesis |
| Whisper STT | homepilot-stt | 8090 | Local audio transcription |

Useful local URLs:

~~~bash
http://localhost
http://localhost:3000/health
http://localhost:18123
http://localhost:8088/health
http://localhost:8090/health
~~~

## Main repository structure

| Path | Use |
|---|---|
| apps/api | HTTP gateway, API routes, and Fastify-compatible handlers |
| apps/operator-console | React/Vite operator-console frontend |
| packages/auth | Users, sessions, roles, and access guards |
| packages/devices | Device domain, scenes, automations, and executions |
| packages/integrations/home-assistant | Home Assistant client, configuration, and sync |
| packages/topology | Homes, rooms, and dashboards |
| packages/assistant | Assistant findings, memory, feedback, and learning |
| packages/system-vars | Persistent automation/context variables |
| packages/shared | Shared infrastructure: database, migrations, events, and errors |
| infrastructure/assemblers | Module assembly and dependency injection |
| migrations | SQLite schema evolution |
| services/stt-whisper | Local STT service |
| services/tts-piper | Local TTS service |
| docker | API/UI/service Dockerfiles |
| docs | Technical and operational documentation |
| specs | Functional specifications and acceptance criteria |

## Backend

The backend runs on Node.js with TypeScript and Fastify v5. The main gateway mounts route handlers in apps/api/routes without registering domain logic directly in ApiGateway.ts.

General request flow:

1. The UI calls an /api/v1/* endpoint.
2. The gateway applies CORS, parsing, and dispatches to the matching RouteHandler.
3. The route validates method, path, payload, and authorization.
4. The use case or application service executes the action.
5. Repositories persist or query SQLite.
6. When needed, an external driver/integration is called, such as Home Assistant.
7. The response returns updated state or a normalized error to the UI.

| Route | File | Responsibility |
|---|---|---|
| /api/v1/auth/* | AuthRoutes.ts | Login, logout, current session, and password changes |
| /api/v1/admin/users/* | AdminRoutes.ts | User and administrator-role management |
| /api/v1/devices/* | DeviceRoutes.ts | Inventory, import, refresh, control, and removal |
| /api/v1/devices/:id/camera/* | CameraRoutes.ts | Authenticated session and local proxy for HA/native camera snapshots, MJPEG, and HLS |
| /api/v1/scenes/* | SceneRoutes.ts | Create, list, and execute scenes |
| /api/v1/automations/* | AutomationRoutes.ts | Automation rules |
| /api/v1/executions/* | ExecutionRoutes.ts | Execution history |
| /api/v1/topology/* | TopologyRoutes.ts | Homes and rooms |
| /api/v1/dashboards/* | DashboardRoutes.ts | Configurable dashboards |
| /api/v1/settings/* | SettingsRoutes.ts | Home Assistant configuration |
| /api/v1/system/* | SystemRoutes.ts | Operational state, onboarding, and diagnostics |
| /api/v1/system-variables/* | SystemVariableRoutes.ts | Global or home-scoped persistent variables |
| /api/v1/assistant/* | AssistantRoutes.ts | Chat, STT, TTS, findings, and assistant actions |
| /api/v1/media/* | MediaRoutes.ts | Media resources served by the API |

## Authentication and roles

Authentication uses local SQLite users and opaque sessions.

| Role | Use |
|---|---|
| admin | Technical superuser with full access |
| operator | Legacy/support role with administrator-equivalent permissions for compatibility |
| parent | Home owner who manages home functions without full technical configuration |
| child | Family member with device and dashboard control |
| guest | Visitor with limited access |

The backend enforces one critical rule: at least one active administrator must always exist. The last administrator cannot be downgraded or disabled because that could lock access to the system.

### Why admin/admin exists

admin/admin is only a local development shortcut. It is not an acceptable customer-delivery strategy.

Local development can enable:

~~~bash
HOMEPILOT_DEV_BOOTSTRAP=true
~~~

When that variable is true and the database is empty, bootstrap creates:

~~~text
username: admin
password: admin
~~~

This speeds up Docker/WSL local testing, database resets, UI validation, and avoids depending on a one-time random password printed to logs. The backend emits a warning that it is unsafe for production.

When HOMEPILOT_DEV_BOOTSTRAP is not true and the database is empty, the system does not create a hidden administrator or print customer passwords to logs. The UI detects the absence of users and shows the first-run flow to create the local administrator.

Current operational rule:

- For internal development, HOMEPILOT_DEV_BOOTSTRAP=true is practical because it enables admin/admin.
- For real production, admin/admin must not be used.
- The customer/installer flow creates the first administrator in the UI.
- The first-administrator bootstrap endpoint works only while users.count() === 0; it closes afterward.
- The UI signs in automatically after first-admin creation and continues to protected Home Assistant onboarding.

In short, admin/admin is used only because Oscar's environment is local development and needs easy test access. It must not be sold or deployed to customers.
## Home Assistant integration

Home Assistant is the local bridge used to communicate with physical devices. In Docker Compose, the backend uses:

~~~bash
INTERNAL_HA_URL=http://homeassistant:8123
~~~

From a browser or Windows host, access Home Assistant at:

~~~bash
http://localhost:18123
~~~

### Home Assistant cameras

Entities in the camera.* domain resolve through the modular camera profile, including entities imported before that profile existed and stored with a generic type. The dashboard selects CameraDeviceTile by capability, not by brand or a specific name.

Media flow:

1. The UI requests GET /api/v1/devices/:id/camera/session using the HomePilot session.
2. CameraRoutes confirms the device is ha:camera.* and reads its current state.
3. HomePilot issues a short signed token for that device; the Home Assistant long-lived token remains on the backend.
4. HomePilot requests the HLS stream used by the Home Assistant frontend over WebSocket. When available, the session contains a local HLS route.
5. CameraRoutes rewrites manifests and records HLS segments with temporary identifiers; the internal HLS URL and the Home Assistant administrative token never reach the browser.
6. The UI plays HLS natively or with hls.js; on failure it tries MJPEG and finally periodic snapshots.
7. The expanded viewer temporarily replaces the card stream so two simultaneous connections are not kept.
8. Snapshot, MJPEG, and HLS use Cache-Control: no-store and are cancelled when the browser closes the connection.

The UI represents loading, error, and unavailable states without treating a camera as a switch. Selecting an available camera opens the responsive full-screen viewer; Escape closes it.

### Customer with an existing Home Assistant instance

In real customer deployments, HomePilot must not create or replace the customer's Home Assistant when one already works. The appliance deploys only HomePilot API, UI, STT, and TTS, then links to the existing Home Assistant through a local URL and long-lived token.

Recommended pattern when Home Assistant runs on the mini PC host or an existing container:

~~~bash
INTERNAL_HA_URL=http://host.docker.internal:8123
~~~

The customer compose file must include extra_hosts: host.docker.internal:host-gateway in homepilot-api. It must not add a new homeassistant service when the customer already has one.

Use this in HomePilot onboarding:

~~~text
Local URL: http://host.docker.internal:8123
Token: long-lived access token created in the customer's Home Assistant
~~~

When Home Assistant is reachable in the same Docker network and its container is called homeassistant, this can also be validated:

~~~text
http://homeassistant:8123
~~~

The customer's public or Cloudflare URL is used by the installer to access Home Assistant and create the token, but HomePilot should prefer the low-latency local route from the mini PC.
### SSH, Cloudflare, and ports

When accessing a remote mini PC with Cloudflare SSH, do not assume localhost:3000 or localhost:8123 on the laptop refer to the mini PC. They can be occupied by the installer's local services.

Recommended tunnel ports:

| Remote service | Remote port | Recommended local port | Installer local URL |
|---|---:|---:|---|
| HomePilot UI | 8080 | 8080 | http://localhost:8080 |
| Direct HomePilot API, diagnostics only | 3000 | 13000 | http://localhost:13000 |
| Existing Home Assistant | 8123 | 18123 | http://localhost:18123 |

Recommended HomePilot tunnel:

~~~bash
ssh -i ~/.ssh/codex_nezu_tmp \
  -o ProxyCommand="cloudflared access ssh --hostname %h" \
  -L 8080:127.0.0.1:8080 \
  nezu@ssh.nezuecuador.com
~~~

Recommended customer Home Assistant tunnel:

~~~bash
ssh -i ~/.ssh/codex_nezu_tmp \
  -o ProxyCommand="cloudflared access ssh --hostname %h" \
  -L 18123:127.0.0.1:8123 \
  nezu@ssh.nezuecuador.com
~~~

Production UI uses one origin for UI, API, and WebSocket. Nginx forwards /api/*, /health, and /ws to the homepilot-api container, so no second tunnel or local URL rebuild is necessary. VITE_API_URL must remain empty:

~~~bash
VITE_API_URL=
~~~

#### Publishing HomePilot through Cloudflare Tunnel

In the same tunnel that hosts ha-smart.nezuecuador.com, add a **Published application route** with:

| Cloudflare field | Recommended value |
|---|---|
| Subdomain | homepilot |
| Domain | nezuecuador.com |
| Path | empty |
| Service type | HTTP |
| URL | 127.0.0.1:8080 |

The resulting address is https://homepilot.nezuecuador.com. Do not publish port 3000: the hostname serves UI, API, HLS cameras, and WebSocket through Nginx. For a residential system, create a Cloudflare Access application for that hostname and permit only authorized identities; HomePilot login remains the second layer.

Validate the mini PC installation with:

~~~bash
bash scripts/check-edge-install.sh docker-compose.office.yml
~~~
### HomePilot installation profiles

HomePilot is installed through an explicit profile. The profile is stored in HOMEPILOT_INSTALLATION_PROFILE and onboarding applies only that profile's requirements.

On a new installation, the interactive installer asks whether the customer already uses Home Assistant. If yes, it preserves and connects that system. Otherwise, it offers a Home Assistant companion or a native-integration-only installation. Customers do not need to know the internal profile names.

| Profile | When to use | Compose | Home Assistant |
|---|---|---|---|
| bridge_ha | Customer already has Home Assistant | docker-compose.office.yml | Preserved and linked by token |
| native_only | Customer starts with native integrations | docker-compose.office.yml | Not installed or required |
| ha_companion | Customer explicitly requests Home Assistant with HomePilot | docker-compose.yml | Managed by that compose |

Do not change profile by editing a running system without reviewing topology and its environment file. The installer fails safely when --profile does not match the saved profile.

#### Guided checklist for technicians

A technician starts the guided installer, not the end customer. The command presents operational decisions and avoids manual .env editing:

~~~bash
bash scripts/install-edge-office.sh --wizard
~~~

For a new installation, the checklist offers:

1. Connect the customer's existing Home Assistant.
2. Include Home Assistant with HomePilot.
3. Install HomePilot with native integrations only.

It then offers deployment now, preparation without starting services, or diagnostics only. Profiles with Home Assistant offer a fourth path: install or repair HACS and SonoffLAN without rebuilding HomePilot. Before creating files, cleaning, or starting containers, the installer shows a full summary and requires one confirmation.

When .env already exists, the wizard preserves and displays its saved profile. It does not migrate or replace a customer topology accidentally. Remote support and automation retain explicit --profile, --clean, --start, and --status flags.

#### Existing Home Assistant customer: bridge_ha

The repository contains docker-compose.office.yml for customer appliances. It does not declare a homeassistant service, so it never creates, updates, or replaces the existing Home Assistant. Prepare from the mini PC repository root:

~~~bash
git pull --ff-only
bash scripts/install-edge-office.sh --profile bridge_ha --clean --start
~~~

The script shows free space and Docker usage, detects Home Assistant without mutation, checks HomePilot ports, creates .env from .env.office.example only if missing, and validates Compose. --clean removes only build cache and dangling Docker images; it never removes containers, volumes, databases, or the customer's Home Assistant. --start builds and starts HomePilot after confirmation. Controlled automation can use --clean --start --yes.

Legacy installations whose .env lacks HOMEPILOT_INSTALLATION_PROFILE are normalized automatically using the installer-resolved profile. No manual PowerShell, WSL, or Linux file edit is required. --status remains read-only.

Diagnostics report whether the existing Home Assistant already has HACS and SonoffLAN but do not install anything by default. To explicitly maintain those integrations without rebuilding HomePilot:

~~~bash
bash scripts/install-edge-office.sh --profile bridge_ha --community-integrations-only
~~~

This mode detects Linux, WSL, Windows with Docker Desktop, or macOS, displays the target container and equivalent commands, installs only HACS/SonoffLAN, and restarts Home Assistant. It does not run docker compose, rebuild images, or restart HomePilot. It is also available through the wizard maintenance option.

Afterward, configure eWeLink in Home Assistant through **Settings → Devices & services → Add integration → Sonoff**. HomePilot does not store eWeLink credentials.

#### Native installation without Home Assistant: native_only

For a mini PC without Home Assistant, HomePilot is ready to integrate compatible local protocols through its own console. Onboarding does not request a Home Assistant URL or token:

~~~bash
git pull --ff-only
bash scripts/install-edge-office.sh --profile native_only --clean --start
~~~

The script creates .env from .env.native.example when missing and uses the lightweight compose file with no homeassistant service.

#### Optional Home Assistant managed by HomePilot: ha_companion

Use this profile only when the customer explicitly requests the companion. It starts the service included in docker-compose.yml and uses .env.example:

~~~bash
git pull --ff-only
bash scripts/install-edge-office.sh --profile ha_companion --clean --start
~~~

Do not select this profile on a mini PC that already runs a customer Home Assistant without first reviewing ports, data, and existing topology. During first deployment, the installer provisions HACS and SonoffLAN if absent because this Home Assistant belongs to HomePilot compose. Components persist in ha-config/custom_components.

#### Operational diagnostics with --status

--status checks an existing installation without modifying it:

~~~bash
bash scripts/install-edge-office.sh --profile bridge_ha --status
~~~

It does not clean Docker, build images, create files, or start/restart containers. It checks:

- API, UI, STT, and TTS containers.
- Configured host ports for API, UI, STT, and TTS, plus Home Assistant where relevant.
- Available health checks for API, STT, and TTS.
- HTTP responses from API, UI, STT, and TTS.
- Home Assistant connectivity only in profiles that require it; native_only reports it as unnecessary.
- HACS and SonoffLAN presence when Home Assistant is configured, without installation or restart.

The command exits with code 0 only when every required component responds correctly; otherwise it exits non-zero for manual support, monitoring, or automation.

Do not combine --status with --clean, --start, or --api-url. Use --start to install or rebuild and --status for read-only health inspection.

After granting execute permission, both forms are equivalent:

~~~bash
chmod +x scripts/install-edge-office.sh
./scripts/install-edge-office.sh --status
~~~

The bash prefix is necessary only when the file has no execute permission or when the interpreter should be explicit.

#### Post-build maintenance

On mini PCs with limited disks, Docker can accumulate buildx cache, intermediate layers, old images, and stopped containers. Use:

~~~bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --deploy --yes
~~~

The command:

1. Shows available space and current Docker usage.
2. Cleans BuildKit/buildx cache while retaining a configurable maximum.
3. Removes unused images, stopped containers, and unused networks.
4. Builds and starts HomePilot with docker-compose.office.yml.
5. Repeats safe cleanup after the build.
6. Shows final available space.
7. Verifies API, UI, STT, TTS, and the Home Assistant bridge before declaring the installation healthy.

It preserves up to 2GB of useful cache by default:

~~~bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --deploy --keep-storage 2GB --yes
~~~

Clean without rebuilding:

~~~bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --clean --yes
~~~

Diagnose without making changes:

~~~bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --status
~~~

The script never runs docker volume prune and never deletes databases or volumes. To explicitly truncate oversized Docker logs:

~~~bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --clean --truncate-logs --yes
~~~

The truncate-logs command affects only *-json.log files, not containers or persistent data.

| Variable | Installation check |
|---|---|
| HOMEPILOT_INSTALLATION_PROFILE | Explicit bridge_ha, native_only, or ha_companion profile |
| INTERNAL_HA_URL | Use http://host.docker.internal:8123 when HA is reachable through the mini PC host; adjust only for a different customer topology |
| HOMEPILOT_HOME_ASSISTANT_CONTAINER | Inspected HA container name; default homeassistant |
| VITE_API_URL | Empty by default so UI, API, and WebSocket share origin; changing it requires a UI rebuild |
| HOMEPILOT_*_PORT | Published ports; adjust only for a diagnosed conflict |
| HOMEPILOT_DEV_BOOTSTRAP | Must remain false for a customer; first administrator is created in UI |
| HOMEPILOT_CORS_ORIGIN | Comma-separated authorized origins; production contains only actual HomePilot URLs |
| HOMEPILOT_AUTH_MAX_FAILURES | Allowed failures per user/origin before temporary lockout; default 5 |
| HOMEPILOT_AUTH_LOCKOUT_MS | Temporary lockout duration; default 900000 milliseconds |

After changing VITE_API_URL, rebuild the UI:

~~~bash
docker compose -f docker-compose.office.yml up --build -d homepilot-ui
~~~

Expected imported-device flow:

1. Configure Home Assistant URL and token in settings.
2. Discover available entities.
3. Import the entity as a HomePilot device.
4. Assign it to a room or leave it in the inbox.
5. Control it from dashboard, detail, scenes, automations, or voice.
6. If it fails or disappears in Home Assistant, HomePilot represents it as unavailable and permits refresh or removal where supported.

Important devices fields:

- external_id: Home Assistant entity or external identifier.
- integration_source: integration source, currently ha by default.
- last_known_state: persisted JSON state.
- invert_state: corrects inverted reporting, for example covers.
- semantic_type: modular interpretation such as switch, cover, light, or another category.
## Devices and modularity

The UI and backend must not assume every device is identical. The current design treats each device through its capabilities and profile:

- Smart switches: on/off.
- Lights: on/off and, when supported, brightness/color.
- Covers: open, close, stop, position, and possible state inversion.
- Future device types: add profiles/capabilities without breaking existing ones.

Rules for device extensions:

- Do not code brand rules directly into a screen.
- Prefer normalized capabilities.
- Keep raw Home Assistant state in last_known_state.
- Map brand differences in adapters or profiles, not generic visual components.
- If a device stops responding, show unavailable state instead of hiding it.
## Voice assistant

The assistant listens for the **Ok Nezu** wake phrase and then processes the command.

| Piece | Service | Responsibility |
|---|---|---|
| Wake/listener UI | GlobalWakeListener.tsx | Captures the wake phrase and browser audio |
| STT | homepilot-stt | Converts audio to text with local Whisper |
| Assistant API | AssistantRoutes.ts | Coordinates transcription, intent, response, and actions |
| TTS | homepilot-tts | Piper voice response |

Relevant Docker Compose variables:

| Variable | Use |
|---|---|
| STT_PROVIDER | STT provider, for example whisper-local |
| STT_BASE_URL | Internal STT service URL |
| STT_TIMEOUT_MS | Transcription timeout |
| WHISPER_HOTWORDS | Wake phrase hints, including Ok Nezu variants |
| TTS_PROVIDER | TTS provider, for example piper |
| TTS_BASE_URL | Internal TTS service URL |
| PIPER_VOICE_ES | Primary Piper voice for Latin American Spanish |
| PIPER_FALLBACK_VOICE_ES | Local Spanish fallback Piper voice |
| PIPER_VOICE_EN | English Piper voice |
## Frontend

The console is in apps/operator-console and uses React, TypeScript, and Vite. The UI is organized through views, reusable components, design tokens, and centralized API calls.

| Area | Path | Use |
|---|---|---|
| App shell | App.tsx | Global layout, navigation, and role gates |
| API configuration | config.ts | Endpoint URLs |
| Design tokens | design-system/tokens.ts | Colors, radii, shadows, and scales |
| Base components | components/ui | Buttons, cards, inputs, modals, and selects |
| Home | views/DashboardView.tsx and dashboard components | Home header, favorite scenes/automations, intelligent suggestions |
| Dashboards | views/DashboardsView.tsx and views/dashboards | User navigation, Home Assistant-style tabs, editable sections, modular cards |
| Devices/inbox | views/InboxView.tsx | Device import and management |
| Home Assistant | views/HomeAssistantSettingsView.tsx | Bridge configuration and discovery |
| Scenes | views/ScenesView.tsx | Scene listing and execution |
| Automations | views/AutomationsView.tsx and workbench | Rules and builder |
| Assistant | views/AssistantView.tsx | Assistant chat/actions |
| Users | views/UsersView.tsx | RBAC management |
| Diagnostics | views/DiagnosticsView.tsx | System health |

Current UI rules:

- Keep data visible during refresh.
- Do not show skeletons after initial load.
- Avoid unstable useEffect dependencies.
- Avoid Zustand selectors that return new arrays/objects on every render.
- Keep components responsive for phone, tablet, desktop, and kiosk.
- Use design-system tokens instead of standalone colors.
## Database

HomePilot uses local SQLite. In Docker:

~~~bash
HOMEPILOT_DB_PATH=/app/data/homepilot.db
~~~

The file lives in the mounted volume:

~~~bash
./data:/app/data
~~~

The host path is therefore:

~~~text
data/homepilot.db
~~~

Migrations are stored in migrations and recorded in _migrations. Do not edit the database manually for schema changes; schema changes must use migrations.

### Primary tables

| Table | Purpose |
|---|---|
| _migrations | Internal applied-migration registry |
| homes | Homes defined in the Edge appliance |
| rooms | Rooms associated with a home |
| devices | Device inventory, persisted state, room, and integration metadata |
| automation_rules | Automation rules with trigger/action JSON |
| activity_logs | Append-only audit of events and actions |
| ha_settings | Singleton Home Assistant configuration |
| users | Local users, roles, password hashes, and active state |
| sessions | Opaque token sessions |
| system_setup | Edge initialization/onboarding state |
| scenes | Scenes with JSON action arrays |
| dashboards | Configurable dashboards by user |
| assistant_findings | Proactive assistant findings/suggestions |
| assistant_feedback_events | Feedback that improves findings |
| assistant_drafts | Fingerprint-stabilized drafts |
| system_variables | Global or home-scoped variables for automation/context |
| execution_records | Historical manual, scene, and automation results |
| assistant_memory | Per-user conversational memory and preferences |
| assistant_learning_events | Assistant learning/correction events |

### Key columns by domain

| Domain | Tables | Notes |
|---|---|---|
| Topology | homes, rooms | rooms.home_id depends on homes.id |
| Devices | devices | UNIQUE(home_id, external_id) prevents discovery duplicates |
| Automation | automation_rules, system_variables, execution_records | Triggers/actions are persisted as JSON |
| Audit | activity_logs, execution_records | Investigates changes and executions |
| Auth | users, sessions | Local RBAC with opaque sessions |
| Home Assistant | ha_settings, devices | ha_settings stores bridge; devices.external_id points to entities |
| Assistant | assistant_findings, assistant_feedback_events, assistant_drafts, assistant_memory, assistant_learning_events | Persists suggestions, feedback, memory, and learning |
## Relevant environment variables

These are the safe production rollout defaults for Planner V2. A local operator may override them in an untracked environment file for controlled testing; never commit real secrets.

~~~bash
HOMEPILOT_DEV_BOOTSTRAP=true
HOMEPILOT_DB_PATH=./data/homepilot.db



TTS_PROVIDER=piper
TTS_BASE_URL=http://homepilot-tts:8088
PIPER_VOICE_ES=es_MX-claude-high
PIPER_FALLBACK_VOICE_ES=es_ES-sharvard-medium
PIPER_VOICE_EN=en_US-lessac-medium
PIPER_SYNTHESIS_TIMEOUT_SECONDS=20

STT_PROVIDER=whisper-local
STT_BASE_URL=http://homepilot-stt:8090
STT_TIMEOUT_MS=30000
WHISPER_MODEL=small
WHISPER_COMPUTE_TYPE=int8
WHISPER_BEAM_SIZE=3
WHISPER_VAD_MIN_SILENCE_MS=650
WHISPER_VAD_SPEECH_PAD_MS=400
WHISPER_MAX_AUDIO_BYTES=9000000
~~~

| Variable | Safe production rollout default | Description |
|---|---|---|
| HOMEPILOT_DEV_BOOTSTRAP | true | Creates admin/admin only when the database is empty; local development only |
| HOMEPILOT_DB_PATH | ./data/homepilot.db | SQLite path outside Docker/inside local WSL; containers normally use /app/data/homepilot.db |
| HOMEPILOT_SQLITE_JOURNAL_MODE | WAL | Use WAL on the Linux mini PC; use DELETE only when Docker mounts data from Windows |
| TTS_PROVIDER | piper | Voice synthesis engine |
| TTS_BASE_URL | http://homepilot-tts:8088 | Internal Docker URL for TTS |
| PIPER_VOICE_ES | es_MX-claude-high | Primary high-quality Latin Spanish Piper voice |
| PIPER_FALLBACK_VOICE_ES | es_ES-sharvard-medium | Local fallback when the primary voice is unavailable |
| PIPER_VOICE_EN | en_US-lessac-medium | English Piper voice |
| PIPER_SYNTHESIS_TIMEOUT_SECONDS | 20 | TTS generation timeout |
| STT_PROVIDER | whisper-local | Transcription engine |
| STT_BASE_URL | http://homepilot-stt:8090 | Internal Docker URL for STT |
| STT_TIMEOUT_MS | 30000 | API transcription timeout |
| WHISPER_MODEL | small | Whisper model used by STT |
| WHISPER_COMPUTE_TYPE | int8 | Compute type optimized for local performance |
| WHISPER_BEAM_SIZE | 3 | Whisper decoding beam size |
| WHISPER_VAD_MIN_SILENCE_MS | 650 | Minimum silence used to split voice segments |
| WHISPER_VAD_SPEECH_PAD_MS | 400 | Padding added around detected speech |
| WHISPER_MAX_AUDIO_BYTES | 9000000 | Maximum audio size accepted by STT |

Additional container variables:

| Variable | Typical local value | Description |
|---|---|---|
| NODE_ENV | production in container | Node runtime mode inside the Docker image |
| INTERNAL_HA_URL | http://homeassistant:8123 or http://host.docker.internal:8123 | Internal Home Assistant URL; use host.docker.internal for a customer HA outside HomePilot compose |
| VITE_API_URL | Empty | UI uses current origin and Nginx routes /api and /ws. An absolute URL is only for a separately published API |
## Windows and WSL workflow

This project is edited on Windows:

~~~text
C:\Users\ocuen\Developer\Nezu\homepilot
~~~

Oscar's local runtime is in WSL:

~~~text
/home/oscar/homepilot
~~~

Recommended workflow after a completed improvement:

1. Validate in Windows.
2. Commit.
3. Push to main.
4. Pull changes in WSL.
5. Start or rebuild Docker Compose.

Windows commands:

~~~bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
git status
git add .
git commit -m "Short description"
git push
~~~

WSL commands:

~~~bash
cd /home/oscar/homepilot
git pull --ff-only
docker compose up --build -d
docker compose ps
curl -fsS http://localhost:3000/health
~~~

Documentation-only changes do not require a runtime rebuild:

~~~bash
cd /home/oscar/homepilot
git pull --ff-only
~~~

For frontend or backend changes:

~~~bash
docker compose up --build -d homepilot-api homepilot-ui
~~~

For STT, TTS, Home Assistant, or image dependency changes:

~~~bash
docker compose up --build -d
~~~
## Mandatory validation commands

For frontend or full-stack changes:

~~~bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
~~~

For backend, API, runtime, auth, automation, or bootstrap changes:

~~~bash
npm run test
~~~

For real deployment validation:

~~~bash
docker compose up --build
docker compose ps
~~~

## Daily operation

### Start the complete stack

~~~bash
docker compose up --build -d
~~~

### Inspect state

~~~bash
docker compose ps
~~~

### Read API logs

~~~bash
docker compose logs homepilot-api
~~~

### Read UI logs

~~~bash
docker compose logs homepilot-ui
~~~

### Read Home Assistant logs

~~~bash
docker compose logs homeassistant
~~~

### Validate API

~~~bash
curl -fsS http://localhost:3000/health
~~~

## Troubleshooting

| Symptom | Recommended check |
|---|---|
| HA_UNREACHABLE while refreshing a device | Verify Home Assistant health, that INTERNAL_HA_URL is http://homeassistant:8123 or http://host.docker.internal:8123 for the deployment, and that the HA token is still valid |
| Duplicate device after re-import | Inspect devices.external_id; the unique constraint is scoped by home_id + external_id |
| Cover reports inverted state | Inspect devices.invert_state and the cover profile/capability |
| Device does not change on home view | Inspect state refresh, realtime events, and persisted last_known_state |
| admin/admin login does not work | Confirm the database was empty at startup and HOMEPILOT_DEV_BOOTSTRAP=true was active |
| STT returns an empty transcript | Inspect sent audio, homepilot-stt health, and concurrent calls blocking its queue |
| UI cannot connect to API | Confirm VITE_API_URL= and inspect http://localhost:8080/health; Nginx must reach homepilot-api:3000 |
| Public UI tries to connect to localhost | Rebuild homepilot-ui with VITE_API_URL= and publish only 127.0.0.1:8080 through Cloudflare Tunnel |
| Changes do not appear in WSL | Run git pull --ff-only inside /home/oscar/homepilot |

## Maintenance rules

- Do not document behavior the code does not implement.
- Do not change API contracts without updating consumers.
- Do not commit real secrets.
- Do not edit data/homepilot.db manually for schema changes.
- Add migrations for persistent changes.
- Keep docs/documentation-index.md updated when important documentation is added.
- For new brands or device types, map capabilities modularly and avoid special logic in generic components.
