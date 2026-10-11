import type { LucideIcon } from 'lucide-react';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';

/** Small segmented control used for text alignment / width / block position pickers. */
export function TitleOptionGroup<TValue extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: TValue;
  onChange: (value: TValue) => void;
  options: Array<{ value: TValue; label: string; icon?: LucideIcon }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro font-semibold uppercase tracking-label-wider text-muted-foreground">{label}</span>
      <div onClick={(event) => event.stopPropagation()}>
        <SegmentedControl
          value={value}
          options={options}
          onChange={onChange}
          label={label}
          className="gap-0.5 rounded-lg border-0 bg-muted/40 p-0.5"
          optionClassName="min-h-8 min-w-8 flex-none rounded px-2 py-1 text-micro font-black"
        />
      </div>
    </div>
  );
}
