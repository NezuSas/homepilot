# SPEC: Specialized Domestic Agent V1

**Status:** Implemented

- Date: 2026-08-20
- Owner: HomePilot
- Related specifications: `nezu-domestic-assistant-v1.md`, `assistant-planner-v2-production-rollout-v1.md`, `assistant-home-isolation-and-bulk-parity-v1.md`

## 1. Problem

HomePilot already performs safe direct control and deterministic household queries. Natural, goal-oriented requests such as "make the living room cozy" or "what can I do tonight" can fall through to a generic language-model response or clarification. A generic chatbot is not an acceptable solution: it can be slow, invent unavailable actions, or answer outside the customer's home.

## 2. Goal

Make HomePilot a natural-language domestic agent for the user's authorized HomePilot scope. It must understand a bounded set of household goals, derive recommendations only from real HomePilot entities and state, and keep all execution decisions in deterministic services.

## 3. Scope

- Add a typed domestic-skill result before generic small talk and before optional Planner V2 execution.
- Support factual home insights, room comfort recommendations, night preparation recommendations, targeted scene discovery, and available-scene inventory from authorized device, room, and scene data.
- Preserve conversational references through the existing short-term memory contract.
- Add an executable Spanish and English evaluation corpus for the supported skills.

## 4. Non-goals

- General knowledge, web search, or non-household conversation.
- Automatic execution of a recommendation.
- New permissions, a new global store, or a public HTTP contract change.
- Enabling Planner V2 live execution before its production rollout criteria are met.
- Replacing the existing deterministic command, query, confirmation, or scene flows.

## 5. Architecture

```text
Natural request
      |
Domestic skill resolver (fast, authorized, typed)
      |                 \
known household goal    unsupported/ambiguous request
      |                                  |
real home graph + state                  existing safe conversation pipeline
      |
typed recommendation/query result
      |
existing confirmation and executor, only when the user chooses an action
```

The language model may interpret commands through the existing shadow/live-gated Planner V2 path, but it is never the source of truth for facts, permissions, target resolution, or execution. The domestic-skill resolver is intentionally local and deterministic for its first release so latency remains bounded on CPU-only Edge hardware.

## 6. Functional requirements

### FR-01 Authorized home graph

Every skill reads devices, rooms, and scenes only through the existing authorization gate. A result never includes an entity from another home or an entity the current user cannot access.

### FR-02 Supported skills

The first release supports these typed skills:

| Skill | Examples | Result boundary |
| --- | --- | --- |
| `home_insight` | "tell me something interesting about my home" | A verifiable fact derived from the current home state. |
| `room_comfort` | "make the living room cozy", "help me create a relaxing atmosphere" | A recommendation based on real scenes or controllable room entities; it does not execute. |
| `night_options` | "what can I do tonight", "prepare the home for sleep" | Available real scenes, controllable covers, and active lights relevant to night preparation; it does not execute. |
| `scene_discovery` | "what scene can I use for a movie" | Authorized scenes matching the requested goal, or a transparent no-match response. |
| `scene_inventory` | "what scenes are available", "¿qué escenas tengo disponibles?" | A concise list of authorized available scenes; it does not execute one. |

### FR-03 Truthful recommendations

- A recommendation may name only authorized real entities.
- If no scene or suitable controllable entity exists, the response says so and does not imply that an action is available.
- A recommendation includes a next action only when the existing command or scene flow can safely perform it.
- Recommendations never claim that a home is "calm", "cozy", or "ready" without measurable supporting state.

### FR-04 Natural household phrasing

Room-comfort detection accepts common Spanish and English expressions for a relaxed, calm, pleasant, cozy, or movie-oriented room experience. If an activity is named, matching real room scenes take precedence over generic comfort scenes. The assistant must not require an exact canned sentence.

### FR-05 Conversation context

- A domestic result records the resolved room and referenced entities in existing short-term memory.
- A follow-up asking for a recommendation or additional options revalidates those referenced entities through the authorization gate before replying and never executes an action.
- Existing follow-up and confirmation rules remain authoritative.
- New domestic skills never clear or consume a pending confirmation.

### FR-06 Presentation

- The response remains usable as plain text and is formatted as short heading-plus-list content where multiple state groups are present.
- No UI parser may infer safety, targets, or state from the response text.

### FR-07 Latency and degradation

- The supported domestic skills do not wait for Ollama.
- Existing direct commands and household-status queries keep their current fast paths.
- Unsupported requests continue through the existing safe flow; a model timeout must not block or weaken a deterministic response.

## 7. Acceptance criteria

- [x] AC-01: Spanish and English home-insight requests return only data derived from the authorized device scope.
- [x] AC-02: A room-comfort request resolves a unique authorized room reference and recommends only real scenes or controllable room entities.
- [x] AC-03: An ambiguous or unavailable room produces a concise clarification/no-match response and performs no action.
- [x] AC-04: A night request reports only actionable authorized scenes, active lights, or controllable covers and never executes them automatically.
- [x] AC-05: Scene discovery returns only scenes available to the user and does not expose foreign-home scenes.
- [x] AC-06: A domestic skill stores safe room/entity context without overwriting pending confirmation state.
- [x] AC-07: Supported domestic skills do not invoke the LLM and remain available while Ollama is unavailable.
- [x] AC-08: Existing deterministic commands, confirmation tickets, and Planner V2 rollout gates retain their behavior.
- [x] AC-09: A versioned Spanish/English evaluation corpus covers supported phrases, expected skill classification, authorization isolation, and no-execution behavior.
- [x] AC-10: Common Spanish and English room-comfort and scene-inventory phrasing resolves deterministically, prioritizes matching authorized scenes, and performs no action.
- [x] AC-11: A domestic follow-up returns only still-authorized and available prior options, without execution.

## 8. Validation

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run build --prefix apps/operator-console`
- `npm run check:spec-coverage`
- `docker compose up --build`
