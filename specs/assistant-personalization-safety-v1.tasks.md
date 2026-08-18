# Assistant Personalization Safety V1 — Tasks

Primary specification: [assistant-personalization-safety-v1.md](./assistant-personalization-safety-v1.md)

## Contract

- [x] Define the presentation-only boundary for response style and conversation tone.
- [x] Preserve existing command, confirmation, authorization, and execution behavior.
- [x] Reuse the existing per-user preference store without adding a permission path.

## Verification

- [x] Test neutral, warm, and formal profiles against the same confirmed command.
- [x] Assert response-detail preferences cannot alter the execution result.
- [x] Assert a control request never enters the general-conversation formatter.
- [x] Run the required workspace validation suite.