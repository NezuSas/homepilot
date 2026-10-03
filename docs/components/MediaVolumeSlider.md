# MediaVolumeSlider

Shared by Classic and Premium MediaPlayerCard; media-player-local-control-v1 AC9.
Uses the existing primary token and native accessible range, 0–100; no new store.
Props: value (number or null), disabled, onCommit(number). Null disables the slider.
Draft changes are local; pointer release, keyboard release or blur commits once.
Pointer cancellation discards the draft. The shared model bounds the command and
checks availability/permissions, using the existing volume_set contract.
The slider never makes an API call. Existing +/- controls share the same setter.
Tests: MediaPlayerPremium.test.tsx and responsive Media player idle, both designs.
