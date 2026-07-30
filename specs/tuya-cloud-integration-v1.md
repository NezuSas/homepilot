# Tuya Smart Direct Integration V1

## Objective

Connect compatible Tuya Smart curtains directly to HomePilot without using Home Assistant as an intermediary. HomePilot owns the local device representation after import and controls it through the Tuya sharing API.

## Scope

- The appliance is provisioned once with a HomePilot-owned Tuya sharing client ID and registered schema.
- An administrator links the household by entering only the Smart Life or Tuya Smart user code and scanning a QR code in the mobile application.
- Authorization tokens stay in the local HomePilot database and are never returned by HTTP APIs or rendered in the browser.
- HomePilot lists compatible covers, imports them once per home and supports open, close, stop and position commands.
- Home Assistant stays optional and unchanged by this integration.

## Out of scope

- Asking customers for Tuya OpenAPI client secrets, endpoints or account UID values.
- Managing the customer Tuya account outside the official Tuya Smart authorization flow.
- Importing non-cover categories in V1.

## Requirements

### REQ-01 — Appliance provisioning

The appliance MUST read `TUYA_SHARING_CLIENT_ID`, `TUYA_SHARING_SCHEMA` and optionally `TUYA_SHARING_AUTH_ENDPOINT` only from its private runtime environment. The UI MUST report that the integration is unavailable when the client ID is absent.

### REQ-02 — Customer authorization

An authenticated administrator MUST be able to submit a Smart Life or Tuya Smart user code. HomePilot MUST request a short-lived QR token from the Tuya sharing API and render the QR payload locally as `tuyaSmart--qrLogin?token=<token>`.

### REQ-03 — Completion and persistence

HomePilot MUST poll the authorization token until Tuya confirms it. Once confirmed, it MUST persist the user code, region endpoint, UID, terminal ID, access token, refresh token and expiration locally. Secrets MUST NOT be returned to the UI.

### REQ-04 — Session continuity

Before calling the Tuya customer API, HomePilot MUST refresh an authorization that expires within one minute and persist the refreshed credentials.

### REQ-05 — Local import and idempotency

Compatible curtains MUST be imported as local `cover` devices using `externalId = tuya:<deviceId>`. Importing the same curtain into the same home MUST return a duplicate error without creating a second local device.

### REQ-06 — Administration and security

All Tuya routes MUST require an authenticated administrator. Disconnecting MUST remove only the local authorization. It MUST NOT modify the physical device or the customer Tuya account.

## Acceptance criteria

- A customer sees one user-code field and a QR authorization step; no endpoint, client ID, client secret or UID field is visible.
- A non-provisioned appliance clearly reports that Tuya Smart is unavailable instead of presenting an unusable form or an unrelated loading error.
- A confirmed QR session can list and import compatible curtains without Home Assistant.
- Imported curtains appear in HomePilot inventory and can be assigned to rooms through the standard device flow.
- Access and refresh tokens never appear in API responses, logs or the browser.
- Tests cover QR session creation, pending authorization and successful authorization mapping.
