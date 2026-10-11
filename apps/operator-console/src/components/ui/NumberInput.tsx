import { useEffect, useState, type ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils';
import { Input } from './Input';

export interface NumberInputProps extends Omit<ComponentPropsWithoutRef<typeof Input>, 'type' | 'value' | 'onChange'> {
  value?: number;
  onValueChange: (value: number) => void;
  onEmpty?: () => void;
  onValidityChange?: (valid: boolean) => void;
}

/** Keep an editable draft: deleting or entering a sign must not force zero.
 * Native form constraints validate the draft before submission. */
export function NumberInput({ value, onValueChange, onEmpty, onValidityChange, required = true, className, ...props }: NumberInputProps) {
  const [draft, setDraft] = useState(value === undefined || !Number.isFinite(value) ? '' : String(value));
  useEffect(() => { setDraft(value === undefined || !Number.isFinite(value) ? '' : String(value)); }, [value]);
  return <Input {...props} className={cn(className)} type="number" required={required} value={draft} onChange={event => {
    const text = event.target.value;
    setDraft(text);
    onValidityChange?.(event.target.validity.valid);
    if (!text) { onEmpty?.(); return; }
    const next = event.target.valueAsNumber;
    if (Number.isFinite(next)) onValueChange(next);
  }} />;
}
