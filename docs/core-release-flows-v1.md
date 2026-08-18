# Core Release Flows V1

This document defines critical release flows for HomePilot Edge.

## Initial Administrator

On first boot, the appliance exposes the first-administrator flow exactly once.
Existing users are never duplicated by a restart.

## Onboarding and Home Assistant Connection

The setup flow stores a Home Assistant connection only after a live validation
succeeds. Repeated completion requests preserve the initialized state without
repeating expensive validation unnecessarily.

## Identity and Sessions

Login creates an opaque local session. Password changes revoke the affected
user's existing sessions, and logout invalidates the current session. Password
hashes never leave the server.

## Administrative Controls

Administrators manage user access. The minimum-admin rule prevents an action
from leaving the appliance without an active administrator. Suspending a user
revokes active sessions.

## Realtime Continuity

Home Assistant realtime updates synchronize device state. A reconnect triggers
state reconciliation so the local Edge state is restored after a connector
interruption.

## Automation Reliability

Automation rules respond to eligible device events, execute authorized actions,
and record execution outcomes for diagnostics.

## System Visibility

Diagnostics expose a consistent appliance health snapshot. Audit records retain
administrative actor identity without exposing secrets.

## Validation

```bash
npm run verify:release
npm run verify:quality
```