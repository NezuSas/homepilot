# Release Readiness V1

## Current Hardening Baseline

HomePilot has standardized API errors, role enforcement, local session
security, modular UI composition, and appliance runtime validation.

### API and Runtime

- Public and administrative APIs use a consistent JSON error shape.
- Route adapters use shared parsing and response helpers.
- Setup and onboarding flows are idempotent where retries are expected.

### Security

- Setup status requires an authorized session.
- The minimum-administrator rule prevents administrative lockout.
- User DTOs and sessions never expose password hashes or integration secrets.

### UI

- Critical views use state-based feedback rather than browser alerts.
- Shared primitives cover common controls and states.
- The desktop sidebar retains a usable icon rail while collapsed.

### Documentation and Operations

- `README.md` is the project entry point.
- `docs/command-reference.md` is the operational command reference.
- `docs/local-wsl-workflow.md` documents the development-to-appliance path.
- `docs/documentation-index.md` maps current engineering references.

## Contract Verification

| Endpoint class | Expected behavior |
|---|---|
| Protected setup status | returns a JSON authentication error without a session |
| Login validation | returns a JSON client error for invalid input |
| Unknown API route | returns a JSON not-found error |

## Known Future Work

- A dedicated session-expired UI surface.
- More decorative frontend validation where it improves clarity.
- Deployment-specific TLS termination outside the local appliance boundary.

## Authenticated Release Verification

`npm run verify:release` is read-only with respect to users and configuration.
It reads these environment variables without printing their values:

- `HOMEPILOT_RELEASE_BASE_URL`
- `HOMEPILOT_RELEASE_USERNAME`
- `HOMEPILOT_RELEASE_PASSWORD`
- `HOMEPILOT_RELEASE_HA_URL`
- `HOMEPILOT_RELEASE_HA_TOKEN`

It verifies API error contracts, authentication, setup, diagnostics, Home
Assistant reachability, user-directory sanitization, and session revocation.