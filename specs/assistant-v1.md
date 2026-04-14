# Specification: HomePilot Assistant V1

## 1. Goal
Introduce an intelligent assistant layer that detects system issues and suggests actionable improvements to the user.

## 2. Requirements
- Detect new devices (not imported).
- Detect devices missing room assignments.
- Detect technical naming (snake_case, HA prefixes).
- Detect duplicate device names.
- Provide a dedicated UI to resolve or dismiss these findings.
- No autonomous changes; user must confirm every action.

## 3. Domain Model: `AssistantFinding`

| Field | Type | Description |
|---|---|---|
| id | string | UUID |
| type | string | Finding type |
| severity | string | high \| medium \| low |
| title | string | User-friendly title |
| description | string | User-friendly description |
| relatedEntityType | string \| null | e.g., "device" |
| relatedEntityId | string \| null | ID of the entity |
| status | string | open \| dismissed \| resolved |
| metadata | json | Extra context for the rule |
| createdAt | datetime | ISO timestamp |
| updatedAt | datetime | ISO timestamp |
| dismissedAt | datetime \| null | ISO timestamp |
| resolvedAt | datetime \| null | ISO timestamp |

### Types
- `new_device_available` (high)
- `device_missing_room` (high)
- `device_name_technical` (medium)
- `device_name_duplicate` (medium)

## 4. Detection Rules

### R1: New Device Available
- **Logic**: HA entity exists in discovery but not in local `DeviceRepository`.
- **Severity**: High.

### R2: Device Missing Room
- **Logic**: `device.roomId` is null or undefined.
- **Severity**: High.

### R3: Technical Name
- **Logic**: `device.name` contains `snake_case`, HA prefixes (`light.`, `switch.`, `cover.`), or numeric-only suffixes.
- **Severity**: Medium.

### R4: Duplicate Name
- **Logic**: Two or more devices have the same `name`.
- **Severity**: Medium.

## 5. Persistence
- Store in SQLite via `AssistantFindingRepository`.
- Fingerprint logic: `type` + `relatedEntityId` should be unique for "open" findings.

## 6. Actions
- **Resolve**: Redirects user to the appropriate UI (import, rename, assign room).
- **Dismiss**: Set status to "dismissed". Dismissed findings should not be re-detected for the same entity unless a new condition arises (though for V1, we just keep them dismissed).

## 7. UX / UI
- **View**: `/assistant` (Asistente).
- **Sidebar**: Badge showing count of "open" findings.
- **Cards**: Each finding has a title, description, and action buttons.

## 8. i18n
- Full support for ES and EN.
- No hardcoded strings in services.
