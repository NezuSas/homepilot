import React from 'react';
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
    onMouseUp,
    onTouchEnd,
    onBlur,
    onKeyUp,
    ...props
  }, ref) => {
    const commitValue = () => onValueCommit?.(value);

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
          onMouseUp={(event) => {
            onMouseUp?.(event);
            commitValue();
          }}
          onTouchEnd={(event) => {
            onTouchEnd?.(event);
            commitValue();
          }}
          onBlur={(event) => {
            onBlur?.(event);
            commitValue();
          }}
          onKeyUp={(event) => {
            onKeyUp?.(event);
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
