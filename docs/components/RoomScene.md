# RoomScene

**Source:** `apps/operator-console/src/views/topology/RoomScene.tsx`
**Family spec:** `specs/operator-console-estancia-viva-design-v1.md`

## Purpose

Decorative room illustration shown at the top of the Spaces room details. It
restates state the room already exposes: whether a light is on and how far the
covers are open. It adds no function, text or interaction.

## Contract

Props: `lightsOn: boolean`, `curtainOpen: number | null`. Both come from
`buildRoomSceneState(devices)` (`roomSceneModel.ts`), which reuses
`getRoomDeviceState` for lights and the cover position keys
(`current_position`, `position`, attributes), honoring `invertState`.

- Unknown is not on: with no light known to be on, the lamp is drawn off.
- Unknown is not closed: with no known cover position, no curtains are drawn.
- Several covers are averaged.
- The element is `aria-hidden`, has no role, focus or visible text.
- Colors come from `--scene-*` tokens: dark renders night, light renders day.

## States and Acceptance

Lamp lit or off; curtains drawn at the known opening (0 closed, 100 open) or
omitted. Scales to the panel width without horizontal overflow at 320, 768 and
1440 px. No animation, so `prefers-reduced-motion` needs no special case.
