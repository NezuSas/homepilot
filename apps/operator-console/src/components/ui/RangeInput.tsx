import React, { useRef } from 'react';
import { cn } from '../../lib/utils';

export interface RangeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'min' | 'max' | 'step' | 'onChange'> {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  formatValue?: (value: number) => React.ReactNode;
  showBounds?: boolean;
  trackClassName?: string;
}

export const RangeInput = React.forwardRef<HTMLInputElement, RangeInputProps>(
  ({
    className,
    trackClassName,
    value,
    min,
    max,
    step = 1,
    onValueChange,
    onValueCommit,
    formatValue = (nextValue) => nextValue,
    showBounds = false,
    disabled,
    onBlur,
    onPointerUp,
    ...props
  }, ref) => {
    const lastCommittedValueRef = useRef(value);
    const commitValue = () => {
      if (lastCommittedValueRef.current === value) {
        return;
      }

      lastCommittedValueRef.current = value;
      onValueCommit?.(value);
    };

    return (
      <div className={cn('flex min-w-0 w-full flex-col gap-2', className)}>
        <input
          {...props}
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange(Number(event.target.value))}
          onPointerUp={(event) => {
            onPointerUp?.(event);
            commitValue();
          }}
          onBlur={(event) => {
            onBlur?.(event);
            commitValue();
          }}
          className={cn(
            'h-1.5 min-w-0 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary',
            'focus:outline-none focus:ring-2 focus:ring-primary/20',
            'disabled:cursor-not-allowed disabled:opacity-30',
            trackClassName,
          )}
        />
        {showBounds && (
          <div className="flex min-w-0 items-center justify-between gap-2 text-nano font-black uppercase tracking-widest text-muted-foreground/40">
            <span className="min-w-0 truncate">{formatValue(min)}</span>
            <span className="min-w-0 flex-1 truncate text-center">{formatValue(value)}</span>
            <span className="min-w-0 truncate text-right">{formatValue(max)}</span>
          </div>
        )}
      </div>
    );
  },
);

RangeInput.displayName = 'RangeInput';
