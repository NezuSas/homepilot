# NumberInput

Source: `apps/operator-console/src/components/ui/NumberInput.tsx`; family spec AC79.

Reuses Input's standard 44px surface, labels and messages. Props inherit Input except type/value/onChange; `value?: number`, `onValueChange(number)`, optional `onEmpty()` and `onValidityChange(boolean)`. Required by default; optional fields opt out.

Local string draft allows empty/sign/decimal replacement without forcing zero. Only finite numbers notify onValueChange; empty notifies onEmpty. Parent updates reset the draft. Native required/min/max/step/badInput constraints block form submission; button-based editors use onValidityChange. Empty required Modbus drafts invalidate preview/configuration rather than retaining a stale conversion. No global state, persistence or conversion policy.

Coverage: responsive Modbus table refinement AC79/AC80 (empty/replacement/native validation, common height), Sensor fixed scale AC42 (optional clearing, invalid bounds). Loading is inherited from the owning form, not a separate data fetch.
