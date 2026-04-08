# Tasks: Dockerization & Edge Runtime V1

## Phase 1: Dockerfile Preparation
- [ ] Create `.dockerignore` to exclude `node_modules`, `dist`, and SQLite local files.
- [ ] Create `docker/api/Dockerfile` for the Node.js backend.
- [ ] Create `docker/ui/Dockerfile` for the React/Vite frontend (Multi-stage build).
- [ ] Verify build of both images locally.

## Phase 2: Orchestration
- [ ] Create `docker-compose.yml` in the root.
- [ ] Define `homepilot-api`, `homepilot-ui`, and `homeassistant` services.
- [ ] Configure networking (bridge mode).
- [ ] Setup volumes for persistent storage (API: entire `./data` folder; HA: `./ha-config`).

## Phase 3: Environment Configuration
- [ ] Map environment variables: `INTERNAL_HA_URL` (API) and `VITE_API_URL` (UI).
- [ ] Ensure API can reach HA container via `http://homeassistant:8123`.

## Phase 4: Integration testing
- [ ] Run `docker-compose up`.
- [ ] Perform a manual walkthrough of the onboarding process.
- [ ] **Data Persistence**:
    - [ ] `docker-compose down`.
    - [ ] `docker-compose up` again.
    - [ ] Verify that setup state, user sessions, and HA configuration are preserved.
