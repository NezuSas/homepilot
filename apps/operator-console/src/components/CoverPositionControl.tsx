import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

interface CoverPositionControlProps {
  initialPosition?: number;
  onPositionChange: (position: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * CoverPositionControl
 * Control deslizante minimalista para ajustar la posición de persianas/cortinas.
 */
export const CoverPositionControl: React.FC<CoverPositionControlProps> = ({
  initialPosition = 0,
  onPositionChange,
  disabled = false,
  ariaLabel = 'Cover position'
}) => {
  const [value, setValue] = useState(initialPosition);
  const lastCommittedValue = useRef(initialPosition);

  // Sincronizar con el estado externo cuando cambie
  useEffect(() => {
    setValue(initialPosition);
    lastCommittedValue.current = initialPosition;
  }, [initialPosition]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseInt(e.target.value, 10);
    setValue(newVal);
  };

  const commitValue = () => {
    if (disabled) return;
    if (lastCommittedValue.current === value) return;
    lastCommittedValue.current = value;
    onPositionChange(value);
  };

  return (
    <div className="flex flex-col gap-2 w-full px-1">
      <input
        type="range"
        min="0"
        max="100"
        aria-label={ariaLabel}
        value={value}
        onChange={handleChange}
        onMouseUp={commitValue}
        onTouchEnd={commitValue}
        onBlur={commitValue}
        onKeyUp={commitValue}
        disabled={disabled}
        className={cn(
          "w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          "focus:outline-none focus:ring-2 focus:ring-primary/20"
        )}
      />
      <div className="flex justify-between text-nano font-black uppercase tracking-widest text-muted-foreground/40">
        <span>0%</span>
        <span>{value}%</span>
        <span>100%</span>
      </div>
    </div>
  );
};
