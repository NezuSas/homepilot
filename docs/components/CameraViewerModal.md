# CameraViewerModal

**Source:** `apps/operator-console/src/components/CameraViewerModal.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Presents a camera in an expanded surface with stream state, close control, and
full-screen viewing guidance.

## Contract

Receives HLS, stream, and snapshot URLs together with preferred mode. It
delegates playback to `CameraMediaFrame` and only keeps local loading, error,
and active-mode state.

## Usage

Open from camera cards and use `Modal` for portal, focus, Escape, scroll lock,
and backdrop close. The viewer retains its own header and fixed footer so video
space remains available.

## States and Acceptance

Shows connecting, streaming, or error without replacing controls. Content fits
inside the viewport on mobile, tablet, and desktop, and close remains available
through icon, Escape, and backdrop.