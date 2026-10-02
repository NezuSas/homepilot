import { useEffect, useState } from 'react';
import { Input, type InputProps } from './Input';

export interface NumberInputProps extends Omit<InputProps, 'type' | 'value' | 'onChange'> {
  value?: number;
  onValueChange: (value: number) => void;
  onEmpty?: () => void;
  onValidityChange?: (valid: boolean) => void;
}

/** Keep an editable draft: deleting or entering a sign must not force zero.
 * Native form constraints validate the draft before submission. */
export function NumberInput({ value, onValueChange, onEmpty, onValidityChange, required = true, ...props }: NumberInputProps) {
  const [draft, setDraft] = useState(value === undefined || !Number.isFinite(value) ? '' : String(value));
  useEffect(() => { setDraft(value === undefined || !Number.isFinite(value) ? '' : String(value)); }, [value]);
  return <Input {...props} type="number" required={required} value={draft} onChange={event => {
    const text = event.target.value;
    setDraft(text);
    onValidityChange?.(event.target.validity.valid);
    if (!text) { onEmpty?.(); return; }
    const next = event.target.valueAsNumber;
    if (Number.isFinite(next)) onValueChange(next);
  }} />;
}
