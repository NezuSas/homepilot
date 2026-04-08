# Specification: Dockerization & Edge Runtime V1

## Problem
HomePilot Edge needs to be easily deployable and reproducible as an Edge Appliance. Currently, it runs as a dispersed set of Node.js processes and a Vite development server, which is not suitable for production deployment on Edge devices (e.g., MiniPCs).

## Objective
Create a complete dockerized environment that bundles the HomePilot API, the Operator Console (UI), and an official Home Assistant instance into a single, cohesive stack.

## Architecture
The stack will consist of three main services managed by `docker-compose`:

1.  **homepilot-api**:
    -   Backend Node.js application (Service Name: `homepilot-api`).
    -   Exposes port `3000`.
    -   Manages the SQLite database and internal logic.
2.  **homepilot-ui**:
    -   Vite-based React frontend (Service Name: `homepilot-ui`).
    -   Served via **Nginx** (production build).
    -   Nginx configured for **SPA fallback** (redirecting all non-file requests to `index.html`).
    -   Exposes port `80` (mapped to `5173` locally or `80` in production).
3.  **homeassistant**:
    -   Official `ghcr.io/home-assistant/home-assistant` image (Service Name: `homeassistant`).
    -   Exposed on port `8123`.

## Networking Strategy
-   **Internal (Docker DNS)**:
    -   `homepilot-api` reaches `homeassistant` via `http://homeassistant:8123`.
-   **Public (Browser Resolution)**:
    -   Browser reaches `homepilot-ui` via `http://localhost:80` (or configured port).
    -   Browser reaches `homepilot-api` via `http://localhost:3000` (Directly, no reverse proxy in V1).

## Environment Variables
| Variable | Scope | Description | Default Value |
| :--- | :--- | :--- | :--- |
| `INTERNAL_HA_URL` | Backend | URL of HA for backend-to-backend integration | `http://homeassistant:8123` |
| `VITE_API_URL` | Frontend | Public API URL used by the browser to reach the backend | `http://localhost:3000` |

## Persistence Strategy
-   **homepilot-api**: A Docker volume will map the **entire data directory** (e.g., `./data`) to the container to ensure SQLite's `.db`, `-wal`, and `-shm` files survive restarts.
-   **homeassistant**: Standard volume for the `/config` directory.

## Healthchecks
-   **homepilot-api**: `curl -f http://localhost:3000/api/v1/system/setup-status` (Checks if the server is accepting requests).
-   **homeassistant**: `curl -f http://localhost:8123/` (Checks if HA is alive).

## Operational Flows
1.  **Boot**: `docker-compose up` initializes the stack.
2.  **Bootstrap Admin**: If the database is empty, the system automatically generates an `admin` user. The initial password is printed **only once** in the `homepilot-api` container logs.
3.  **Onboarding**: User enters the UI. During HA configuration, the UI suggests `http://homeassistant:8123` as the internal URL.
    -   *Note*: User is informed that `http://homeassistant:8123` is for internal backend use and not necessarily reachable from the browser.

## Out of Scope
-   Kubernetes orchestration.
-   Multi-node clusters.
-   Complex SSL/TLS (self-signed/external only).
-   Reverse Proxy for API in V1 (UI serves static files only).

## Acceptance Criteria
The implementation is correct if:
- [ ] `docker-compose up` starts all services without manual intervention.
- [ ] Login works in the dockerized environment.
- [ ] Onboarding detects the system status correctly.
- [ ] `testConnection()` against `http://homeassistant:8123` works from the API.
- [ ] **Data Persistence**: `docker-compose down` followed by `docker-compose up` preserves the DB, setup state, sessions, and HA configuration.
